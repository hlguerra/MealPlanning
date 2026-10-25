const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const https = require("https");
const dns = require("dns").promises;
const net = require("net");

initializeApp();

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

// The client can't pick these — anything it sends for model/tools/system is ignored.
const MODEL          = "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 4000;
const ALLOWED_ORIGINS = [
  "https://hlguerra.github.io",
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

// Only signed-in members of a household may use the proxy.
// Client sends:  Authorization: Bearer <Firebase ID token>,  X-Household-Id: <id>
async function verifyMember(req) {
  const m = (req.get("Authorization") || "").match(/^Bearer (.+)$/);
  const householdId = (req.get("X-Household-Id") || "").trim();
  if (!m || !householdId || !/^[A-Za-z0-9]{1,64}$/.test(householdId)) return false;
  try {
    const { uid } = await getAuth().verifyIdToken(m[1]);
    const member = await getFirestore().doc(`households/${householdId}/members/${uid}`).get();
    return member.exists;
  } catch {
    return false;
  }
}

exports.anthropicProxy = onRequest(
  { secrets: [anthropicKey], cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    if (!(await verifyMember(req))) { res.status(401).json({ error: "Not authorized" }); return; }

    const apiKey = anthropicKey.value();
    if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }

    const { messages, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) { res.status(400).json({ error: "messages required" }); return; }

    try {
      const body = JSON.stringify({
        model:      MODEL,
        max_tokens: Math.min(Math.max(1, parseInt(max_tokens, 10) || 1500), MAX_TOKENS_CAP),
        messages,
      });
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      };
      const proxyReq = https.request(options, proxyRes => {
        let data = "";
        proxyRes.on("data", chunk => { data += chunk; });
        proxyRes.on("end", () => {
          if (proxyRes.statusCode >= 400) console.error("Anthropic error", proxyRes.statusCode, data.slice(0, 500));
          res.status(proxyRes.statusCode).set("Content-Type", "application/json").send(data);
        });
      });
      proxyReq.on("error", err => { console.error(err); res.status(500).json({ error: "Proxy failed" }); });
      proxyReq.write(body);
      proxyReq.end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ── Recipe page fetch (for "Import from URL") ─────────────────────────────────
// Claude can't open links, so the server downloads the page and hands back the
// recipe's structured data (schema.org JSON-LD, which most recipe sites include)
// or, failing that, the page's visible text.
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_CHARS = 30000;

// Blocks localhost / private-network addresses so the function can't be pointed inward
const isPrivateIp = ip => {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
};

const checkPublicUrl = async raw => {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  try {
    const addrs = await dns.lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) return null;
  } catch { return null; }
  return url;
};

// Every JSON-LD node of @type Recipe on the page (handles @graph and arrays)
const findRecipeJsonLd = html => {
  const out = [];
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const type = node["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) out.push(node);
    if (node["@graph"]) visit(node["@graph"]);
  };
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) { try { visit(JSON.parse(m[1].trim())); } catch { /* skip bad block */ } }
  return out;
};

const pageText = html => html
  .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|tr)>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&frac12;/g, "1/2").replace(/&frac14;/g, "1/4").replace(/&frac34;/g, "3/4")
  .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

exports.fetchRecipePage = onRequest(
  { cors: ALLOWED_ORIGINS, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
    if (!(await verifyMember(req))) { res.status(401).json({ error: "Not authorized" }); return; }

    let url = await checkPublicUrl(String(req.body?.url || "").trim());
    if (!url) { res.status(400).json({ error: "That doesn't look like a public web address." }); return; }

    try {
      // Follow redirects by hand so each hop gets the same public-address check
      let resp;
      for (let hop = 0; hop < 5; hop++) {
        resp = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        const next = resp.status >= 300 && resp.status < 400 && resp.headers.get("location");
        if (!next) break;
        url = await checkPublicUrl(new URL(next, url).href);
        if (!url) { res.status(400).json({ error: "The page redirected somewhere it can't be read from." }); return; }
      }
      if (!resp.ok) { res.status(502).json({ error: `The site responded with ${resp.status}.` }); return; }

      const buf = Buffer.from(await resp.arrayBuffer());
      const html = buf.subarray(0, MAX_PAGE_BYTES).toString("utf8");
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
      const recipes = findRecipeJsonLd(html);
      res.json({
        url: url.href,
        title,
        jsonLd: recipes.length ? recipes[0] : null,
        text: recipes.length ? "" : pageText(html).slice(0, MAX_TEXT_CHARS),
      });
    } catch (err) {
      console.error("fetchRecipePage", url?.href, err);
      res.status(502).json({ error: "Couldn't download that page." });
    }
  }
);

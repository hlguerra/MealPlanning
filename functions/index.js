const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const https = require("https");

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

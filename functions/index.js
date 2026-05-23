const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const https = require("https");

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

exports.anthropicProxy = onRequest(
  { secrets: [anthropicKey], cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

    const apiKey = anthropicKey.value();
    if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }

    try {
      const body = JSON.stringify(req.body);
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

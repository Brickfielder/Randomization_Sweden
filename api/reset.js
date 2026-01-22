import pool from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = parseBody(req.body);
  if (String(body?.confirm || "") !== "RESET") {
    res.status(400).json({
      error: "Confirmation required. Send {\"confirm\":\"RESET\"} in body."
    });
    return;
  }

  await pool.query("DELETE FROM allocations");
  res.status(200).json({ ok: true, reset: true, count: 0 });
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function isAuthorized(req) {
  const required = process.env.VCARE_API_TOKEN;
  if (!required) return true;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token && token === required;
}

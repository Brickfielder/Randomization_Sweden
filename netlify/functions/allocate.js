import { getStore } from "@netlify/blobs";
import { RANDOM_SEQUENCE, LABELS } from "./lib/sequence.js";

const STORE = "vcare-sweden";
const KEY = "allocations.json";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== (process.env.VCARE_API_TOKEN || "")) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body; 
  try { body = await req.json(); } catch { body = {}; }
  const pid = (body?.participant_id || "").trim();
  if (!pid) return json({ error: "participant_id required" }, 400);
  if (/[,\\n\\r]/.test(pid)) return json({ error: "participant_id cannot contain commas/newlines" }, 400);

  const store = getStore(STORE);
  const raw = await store.get(KEY, { type: "json" });
  const log = Array.isArray(raw) ? raw : [];

  if (log.some(r => r.participant_id.toLowerCase() === pid.toLowerCase())) {
    return json({ error: "Duplicate participant_id" }, 409);
  }

  const position = log.length;
  if (position >= RANDOM_SEQUENCE.length) {
    return json({ error: "Sequence exhausted" }, 409);
  }

  const seq = position + 1;
  const condition = LABELS[RANDOM_SEQUENCE[position]];
  const timestamp = new Date().toISOString();

  const prevHash = log.length ? log[log.length - 1].hash : "";
  const enc = new TextEncoder().encode(JSON.stringify({ seq, participant_id: pid, condition, timestamp, prevHash }));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");

  const record = { seq, participant_id: pid, condition, timestamp, prevHash, hash };
  const newLog = [...log, record];

  await store.set(KEY, JSON.stringify(newLog, null, 2), { metadata: { contentType: "application/json" } });

  return json({ record, position: seq, remaining: RANDOM_SEQUENCE.length - seq });
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}


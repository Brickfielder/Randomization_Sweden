import crypto from "crypto";
import pool from "./db.js";
import { LABELS, RANDOM_SEQUENCE } from "./sequence.js";

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
  const participantId = String(body?.participant_id || "").trim();

  if (!participantId) {
    res.status(400).json({ error: "participant_id required" });
    return;
  }

  if (/[,\n\r]/.test(participantId)) {
    res.status(400).json({ error: "participant_id cannot contain commas/newlines" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE allocations IN EXCLUSIVE MODE");

    const dupCheck = await client.query(
      "SELECT 1 FROM allocations WHERE participant_id_lc = lower($1) LIMIT 1",
      [participantId]
    );
    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Duplicate participant_id" });
      return;
    }

    const seqResult = await client.query(
      "SELECT COALESCE(MAX(seq), 0) AS max_seq FROM allocations"
    );
    const nextSeq = Number(seqResult.rows[0]?.max_seq || 0) + 1;

    if (nextSeq > RANDOM_SEQUENCE.length) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Sequence exhausted" });
      return;
    }

    const prevResult = await client.query(
      "SELECT hash FROM allocations ORDER BY seq DESC LIMIT 1"
    );
    const prevHash = prevResult.rows[0]?.hash || "";

    const condition = LABELS[RANDOM_SEQUENCE[nextSeq - 1]];
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      seq: nextSeq,
      participant_id: participantId,
      condition,
      timestamp,
      prevHash
    });
    const hash = crypto.createHash("sha256").update(payload).digest("hex");

    const insertResult = await client.query(
      `INSERT INTO allocations
        (seq, participant_id, condition, timestamp_utc, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING seq, participant_id, condition, timestamp_utc, prev_hash, hash`,
      [nextSeq, participantId, condition, timestamp, prevHash, hash]
    );

    await client.query("COMMIT");

    const row = insertResult.rows[0];
    res.status(200).json({
      record: {
        seq: row.seq,
        participant_id: row.participant_id,
        condition: row.condition,
        timestamp: new Date(row.timestamp_utc).toISOString(),
        prevHash: row.prev_hash || "",
        hash: row.hash
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Allocation failed" });
  } finally {
    client.release();
  }
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

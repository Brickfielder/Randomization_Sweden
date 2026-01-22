import pool from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET" });
    return;
  }

  const format = String(req.query?.format || "csv").toLowerCase();

  const result = await pool.query(
    "SELECT seq, participant_id, condition, timestamp_utc, prev_hash, hash FROM allocations ORDER BY seq ASC"
  );

  const log = result.rows.map((row) => ({
    seq: row.seq,
    participant_id: row.participant_id,
    condition: row.condition,
    timestamp: new Date(row.timestamp_utc).toISOString(),
    prevHash: row.prev_hash || "",
    hash: row.hash
  }));

  if (format === "json") {
    res.status(200).json({ log, count: log.length });
    return;
  }

  const header = "seq,participant_id,condition,timestamp,hash\n";
  const body = log
    .map((row) => [
      row.seq,
      csvSafe(row.participant_id),
      row.condition,
      row.timestamp,
      row.hash
    ].join(","))
    .join("\n");
  const csv = `${header}${body}\n`;

  res.setHeader("content-type", "text/csv");
  res.setHeader(
    "content-disposition",
    `attachment; filename=vcare_sweden_export_${new Date().toISOString().slice(0, 10)}.csv`
  );
  res.status(200).send(csv);
}

function csvSafe(value) {
  return String(value).replaceAll(",", " ");
}

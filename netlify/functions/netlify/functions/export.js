import { getStore } from "@netlify/blobs";

const STORE = "vcare-sweden";
const KEY = "allocations.json";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url = new URL(req.url);
  const fmt = (url.searchParams.get("format") || "csv").toLowerCase();

  const store = getStore(STORE);
  const data = await store.get(KEY, { type: "json" });
  const log = Array.isArray(data) ? data : [];

  if (fmt === "json") {
    // JSON export
    return new Response(JSON.stringify({ log, count: log.length }), {
      headers: { "content-type": "application/json" }
    });
  }

  // CSV export (default)
  const header = "seq,participant_id,condition,timestamp,hash\n";
  const body = log
    .map((r) => [r.seq, csvSafe(r.participant_id), r.condition, r.timestamp, r.hash].join(","))
    .join("\n");
  const csv = header + body + "\n";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename=vcare_sweden_export_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    }
  });
};

function csvSafe(s) {
  return String(s).replaceAll(",", " ");
}

import { getStore } from "@netlify/blobs";

const STORE = "vcare-sweden";
const KEY = "allocations.json";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return respond({ error: "Use POST" }, 405);

  // Auth
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== (process.env.VCARE_API_TOKEN || "")) {
    return respond({ error: "Unauthorized" }, 401);
  }

  // Confirmation
  let body = {};
  try { body = await req.json(); } catch {}
  if ((body.confirm || "") !== "RESET") {
    return respond({ error: 'Confirmation required. Send {"confirm":"RESET"} in body.' }, 400);
  }

  // Reset the log
  const store = getStore(STORE);
  await store.set(KEY, JSON.stringify([], null, 2), {
    metadata: { contentType: "application/json" }
  });

  return respond({ ok: true, reset: true, count: 0 });
};

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

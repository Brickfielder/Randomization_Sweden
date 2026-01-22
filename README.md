# V-CARE Sweden Randomization

Static frontend with Vercel serverless functions (in `api/`) for allocation, export, and reset.

## Smoke test (post-deploy)

1. Export should be empty:
   - `GET /api/export?format=json` returns `{ "count": 0, "log": [] }`.
2. Allocate one participant:
   - `POST /api/allocate` with JSON body `{ "participant_id": "TEST-0001" }` returns `seq = 1`.
3. Export should show one record:
   - `GET /api/export?format=json` returns `count = 1`.

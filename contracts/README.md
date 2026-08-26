# Personal Coach contracts

Stable API surface for a future Personal Coach module (not implemented in the FastAPI backend yet):

- `GET /api/coach/personal/home`
- `GET /api/coach/entities/:id/bills`
- `GET /api/coach/entities/:id/envelopes`
- `POST /api/coach/personal/loop-actions/:actionId/execute`

LOOP consumption is **contextual**: unpaid bills with paybill metadata → `Pay To Paybill`; otherwise → `Send Money - M-Pesa`. Investment advice is blocked until runway + emergency rules pass.

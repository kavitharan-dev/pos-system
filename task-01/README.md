# Task 01 — POS Order & Inventory System

**Live deployment:** _add URL here_  
**Tech stack:** Node.js, Express, PostgreSQL, React (Vite)

Concurrency-safe POS: product CRUD, cart → checkout stock reservation (5 minutes), mock payment (success / failure / timeout), duplicate-submission rejection, and an enforced order lifecycle.

## Environment variables

Copy `.env.example` to `.env` in this folder:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://pos:pos@localhost:5432/pos_task01` |
| `PORT` | API port | `4001` |
| `RESERVATION_MINUTES` | Checkout stock lock | `5` |
| `PAYMENT_TIMEOUT_MS` | Mock gateway timeout delay | `2500` |
| `CORS_ORIGIN` | Allowed frontend origin | `*` |
| `SEED_ON_START` | Seed demo products if the table is empty | `true` |

## Setup

If PostgreSQL is not installed, the backend starts an embedded local database automatically.

```bash
docker compose up -d
cd task-01
copy .env.example .env
npm run install:all
```

Run API and UI in two terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

- API: http://localhost:4001/api/health
- UI: http://localhost:5173

Production (serves the built React app from Express):

```bash
npm run build
npm start
```

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/products` | List products and current available stock |
| POST | `/api/products` | Create product `{ name, price, stock }` |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/inventory` | Accurate stock snapshot for every product |
| POST | `/api/carts` | Create a cart |
| POST | `/api/carts/:id/items` | Add item `{ productId, quantity }` |
| PATCH | `/api/carts/:id/items/:productId` | Set quantity |
| POST | `/api/checkout` | Reserve stock, create order (`pending` → `reserved`, 5-minute expiry) `{ cartId }` |
| POST | `/api/orders/:id/pay` | Mock pay `{ outcome: "success" \| "failure" \| "timeout" }` |
| POST | `/api/orders/:id/cancel` | Cancel reserved or paid order and restore stock |
| GET | `/api/orders` | List orders with status history |
| GET | `/api/meta` | Reservation length and allowed transitions |

## How to test each feature

### Product & inventory
1. Open Products. Seeded items should appear with live stock badges.
2. Add / edit / delete a product.
3. Open Inventory and confirm the same stock counts.

### Cart & overselling
1. Add items to the cart, then **Proceed to Checkout**.
2. Stock on Products/Inventory drops immediately (reservation).
3. From `task-01/backend` with the API running:

```bash
npm run test:concurrency
```

This fires 20 parallel checkouts against a product with `stock = 1`. Expected: **1 reserved, 19 INSUFFICIENT_STOCK, remaining stock 0**, and a parallel double-pay of the winner rejects the duplicate.

### 5-minute reservation
1. Checkout a cart and leave the payment modal open.
2. Timer counts down from 05:00.
3. After expiry (or set `RESERVATION_MINUTES=0.08` for a ~5s demo), status becomes `expired` and stock returns.

### Mock payment
From checkout, choose:
- **Success** → order `paid`, stock stays deducted
- **Failure** → order `failed`, stock released
- **Timeout** → order `expired`, stock released

Click pay twice quickly (or run the concurrency script) to see **Duplicate Submission Detected**.

### Order lifecycle
Valid transitions are enforced:

`pending → reserved → paid | failed | expired | cancelled`  
`paid → cancelled` (stock restored)

Open an order to see the status history. Cancel a reserved or paid order and confirm inventory increases.

## Deploy (Render / Railway)

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Root directory: `task-01`
3. Build: `npm run install:all && npm run build`
4. Start: `npm start`
5. Set `PORT` from the host. Put the public URL at the top of the root README.

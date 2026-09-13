# Task 02 — E-Commerce Checkout & Payment System

**Live deployment:** https://techloom-task-02.onrender.com  
**Tech stack:** Node.js, Express, PostgreSQL, React (Vite)

Customer-facing storefront: search and filters, product details, cart, checkout stock reservation, mock payment, simulated refunds, and order history with status timeline.

## Environment variables

Copy `.env.example` to `.env` in this folder:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://pos:pos@localhost:5432/pos_task02` |
| `PORT` | API port | `4002` |
| `RESERVATION_MINUTES` | Checkout stock lock | `5` |
| `PAYMENT_TIMEOUT_MS` | Mock gateway timeout delay | `2500` |
| `CORS_ORIGIN` | Allowed frontend origin | `*` |
| `SEED_ON_START` | Seed demo catalog if empty | `true` |

## Setup

If PostgreSQL is not installed, the backend starts an embedded local database automatically.

```bash
docker compose up -d
cd task-02
copy .env.example .env
npm run install:all
```

```bash
npm run dev:backend
npm run dev:frontend
```

- API: http://localhost:4002/api/health
- UI: http://localhost:5174

Production:

```bash
npm run build
npm start
```

## API extras vs Task 01

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/products?q=&category=&minPrice=&maxPrice=&availability=` | Search and filter |
| GET | `/api/products/categories` | Distinct categories |
| GET | `/api/products/:id` | Product details |
| POST | `/api/checkout` | `{ cartId, customerName, customerEmail }` — reserves stock |
| GET | `/api/orders?email=` | Order history for a customer |
| POST | `/api/orders/:id/cancel` | Cancel; if paid, simulate a refund and restore stock |

Payment outcomes are still `success`, `failure`, and `timeout`. Duplicate payment or duplicate checkout of the same cart returns `409 DUPLICATE_SUBMISSION`.

## How to test each feature

### Discovery UX
1. Use the search box (`mouse`, `chair`, `usb`).
2. Filter by category chips, min/max price, and in-stock vs out-of-stock.
3. Open **Details** for a product and confirm name, price, category, description, and stock.

### Cart, reservation, payment
1. Add items, open Cart, enter name + email, **Reserve stock & checkout**.
2. Inventory drops; a 5-minute timer starts.
3. Pay with Success / Failure / Timeout and confirm:
   - success keeps stock deducted and status `paid`
   - failure/timeout releases stock (`failed` / `expired`)
4. Submit payment twice to see duplicate-payment rejection.

### Refunds & cancellation
1. Pay successfully, open the order, **Cancel order**.
2. Confirm a `simulated` refund appears and stock returns.
3. Cancelling a reserved (unpaid) order restores stock without a refund.

### Order history
1. Open **Order history** with the same checkout email.
2. Each order shows current status plus the full `pending → reserved → …` timeline.

```bash
cd backend
npm run test:concurrency
npm run test:flow
```

## Deploy (Render / Railway)

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Root directory: `task-02`
3. Build: `npm run install:all && npm run build`
4. Start: `npm start`
5. Put the public URL at the top of the root README.

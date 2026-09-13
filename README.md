# Techloom Intern Assessment

**Repository:** https://github.com/kavitharan-dev/pos-system  
**Task 01 live URL:** https://techloom-task-01.onrender.com  
**Task 02 live URL:** https://techloom-task-02.onrender.com

This repository contains both sections of the Techloom.ai Software Engineer Intern Practical Assessment.

| Folder | Section | What it is |
| --- | --- | --- |
| [`/task-01`](./task-01) | POS Order & Inventory System | Concurrency-safe POS backend + React UI |
| [`/task-02`](./task-02) | E-Commerce Checkout & Payment System | Storefront with search, reservation, mock payments, refunds, order history |

Stack for both tasks: **Node.js, Express, PostgreSQL, React (Vite)**.

## Local setup

1. Node.js 20+.
2. PostgreSQL is optional locally. If `DATABASE_URL` is unreachable, each task starts an embedded PostgreSQL instance automatically. Docker Compose is still recommended for a production-like setup.

```bash
docker compose up -d
```

This creates databases `pos_task01` and `pos_task02`.

Then follow each task README:

- [Task 01 setup and test plan](./task-01/README.md)
- [Task 02 setup and test plan](./task-02/README.md)

## Environment Variables

Copy each task’s `.env.example` to `.env` inside `/task-01` and `/task-02` before starting the backends.

### Task 01 (`task-01/.env.example`)

| Variable | Description |
| --- | --- |
| `PORT` | API server port (default `4001`) |
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `DATABASE_URL` | PostgreSQL connection string (default `postgres://pos:pos@localhost:5432/pos_task01`) |
| `RESERVATION_MINUTES` | How long checkout stock stays reserved before expiry (default `5`) |
| `PAYMENT_TIMEOUT_MS` | Mock payment gateway delay for the `timeout` outcome (default `2500`) |
| `CORS_ORIGIN` | Allowed frontend origin for CORS (default `*`) |
| `SEED_ON_START` | When `true`, seed demo products if the catalog is empty |

### Task 02 (`task-02/.env.example`)

| Variable | Description |
| --- | --- |
| `PORT` | API server port (default `4002`) |
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `DATABASE_URL` | PostgreSQL connection string (default `postgres://pos:pos@localhost:5432/pos_task02`) |
| `RESERVATION_MINUTES` | How long checkout stock stays reserved before expiry (default `5`) |
| `PAYMENT_TIMEOUT_MS` | Mock payment gateway delay for the `timeout` outcome (default `2500`) |
| `CORS_ORIGIN` | Allowed frontend origin for CORS (default `*`) |
| `SEED_ON_START` | When `true`, seed demo products if the catalog is empty |

## Design notes

- Available stock lives on `products.stock`. Checkout decrements it inside a transaction using `SELECT ... FOR UPDATE`.
- Reservations expire after **5 minutes**. A worker plus lazy expiry on read/pay/cancel release stock exactly once (compare-and-swap on `status = reserved`).
- Mock payments accept `success`, `failure`, or `timeout`.
- Duplicate checkout of the same cart, and duplicate payment of the same order, return `409 DUPLICATE_SUBMISSION`.
- Order statuses: `pending → reserved → paid | failed | expired | cancelled`. Paid orders may be cancelled (stock restored; Task 02 also simulates a refund).

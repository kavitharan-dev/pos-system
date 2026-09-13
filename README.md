# Techloom Intern Assessment

**Repository:** _add public GitHub URL here_  
**Task 01 live URL:** _add deployment URL here_  
**Task 02 live URL:** _add deployment URL here_

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

## Design notes

- Available stock lives on `products.stock`. Checkout decrements it inside a transaction using `SELECT ... FOR UPDATE`.
- Reservations expire after **5 minutes**. A worker plus lazy expiry on read/pay/cancel release stock exactly once (compare-and-swap on `status = reserved`).
- Mock payments accept `success`, `failure`, or `timeout`.
- Duplicate checkout of the same cart, and duplicate payment of the same order, return `409 DUPLICATE_SUBMISSION`.
- Order statuses: `pending → reserved → paid | failed | expired | cancelled`. Paid orders may be cancelled (stock restored; Task 02 also simulates a refund).

/**
 * Fires many parallel checkouts against a product with stock=1.
 * Exactly one order must become reserved; the rest must fail with INSUFFICIENT_STOCK.
 *
 * Usage (server must already be running):
 *   node scripts/concurrency-test.js
 */
const BASE_URL = process.env.API_URL || "http://localhost:4001";
const PARALLEL = Number(process.env.CONCURRENCY || 20);

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
}

async function main() {
  const health = await fetch(`${BASE_URL}/api/health`);
  if (!health.ok) {
    throw new Error(`API not reachable at ${BASE_URL}`);
  }

  const productRes = await fetch(`${BASE_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Concurrency Probe ${Date.now()}`,
      price: 1,
      stock: 1,
    }),
  });
  const productJson = await json(productRes);
  const product = productJson.body.product;
  if (!product) {
    throw new Error(`Could not create product: ${JSON.stringify(productJson.body)}`);
  }

  const carts = [];
  for (let i = 0; i < PARALLEL; i += 1) {
    const cartRes = await fetch(`${BASE_URL}/api/carts`, { method: "POST" });
    const cartJson = await json(cartRes);
    const cart = cartJson.body.cart;
    await fetch(`${BASE_URL}/api/carts/${cart.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
    });
    carts.push(cart.id);
  }

  const results = await Promise.all(
    carts.map((cartId) =>
      fetch(`${BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId }),
      }).then(json)
    )
  );

  const reserved = results.filter(
    (r) => r.status === 201 && r.body.order?.status === "reserved"
  );
  const insufficient = results.filter((r) => r.body.error === "INSUFFICIENT_STOCK");
  const other = results.filter(
    (r) => r.status !== 201 && r.body.error !== "INSUFFICIENT_STOCK"
  );

  const stockRes = await json(await fetch(`${BASE_URL}/api/products/${product.id}`));
  const remaining = stockRes.body.product.stock;

  console.log(`Parallel checkouts: ${PARALLEL}`);
  console.log(`Reserved (should be 1): ${reserved.length}`);
  console.log(`Insufficient stock: ${insufficient.length}`);
  console.log(`Other failures: ${other.length}`);
  console.log(`Remaining stock (should be 0): ${remaining}`);
  if (other.length) console.log(other);

  const ok =
    reserved.length === 1 &&
    remaining === 0 &&
    insufficient.length === PARALLEL - 1;

  if (!ok) {
    console.error("FAIL: overselling or unexpected results detected");
    process.exit(1);
  }

  const orderId = reserved[0].body.order.id;
  const [firstPay, secondPay] = await Promise.all([
    fetch(`${BASE_URL}/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "success" }),
    }).then(json),
    fetch(`${BASE_URL}/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "success" }),
    }).then(json),
  ]);

  const payments = [firstPay, secondPay];
  const paid = payments.filter((p) => p.body.order?.status === "paid").length;
  const duplicates = payments.filter((p) => p.body.error === "DUPLICATE_SUBMISSION").length;
  console.log(`Parallel payments — paid: ${paid}, duplicates rejected: ${duplicates}`);

  if (paid !== 1 || duplicates !== 1) {
    console.error("FAIL: duplicate payment was not rejected correctly");
    process.exit(1);
  }

  console.log("PASS: no overselling; duplicate payment rejected");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

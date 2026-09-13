/**
 * End-to-end Task 02 API checks: search/filter, reservation, payment, refund, history.
 */
const BASE_URL = process.env.API_URL || "http://localhost:4002";

async function json(res) {
  const body = await res.json();
  return { status: res.status, body };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const search = await json(
    await fetch(`${BASE_URL}/api/products?q=mouse&category=Electronics&availability=in_stock`)
  );
  assert(search.status === 200, "search failed");
  assert(
    search.body.products.some((p) => p.name === "Wireless Mouse"),
    "search did not return Wireless Mouse"
  );

  const filteredOut = await json(
    await fetch(`${BASE_URL}/api/products?minPrice=100&maxPrice=160`)
  );
  const names = filteredOut.body.products.map((p) => p.name);
  assert(names.includes("Gaming Chair"), "price filter missed Gaming Chair");
  assert(!names.includes("USB-C Cable"), "price filter included cheap cable");

  const detail = await json(
    await fetch(`${BASE_URL}/api/products/${search.body.products[0].id}`)
  );
  assert(detail.body.product.description, "product details missing description");

  const cart = (await json(await fetch(`${BASE_URL}/api/carts`, { method: "POST" }))).body.cart;
  await fetch(`${BASE_URL}/api/carts/${cart.id}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: search.body.products[0].id, quantity: 1 }),
  });

  const before = (await json(await fetch(`${BASE_URL}/api/products/${search.body.products[0].id}`)))
    .body.product.stock;

  const checkout = await json(
    await fetch(`${BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cart.id,
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
      }),
    })
  );
  assert(checkout.status === 201, `checkout failed: ${JSON.stringify(checkout.body)}`);
  assert(checkout.body.order.status === "reserved", "checkout did not reserve");

  const afterReserve = (
    await json(await fetch(`${BASE_URL}/api/products/${search.body.products[0].id}`))
  ).body.product.stock;
  assert(afterReserve === before - 1, "stock was not reserved at checkout");

  const dupCheckout = await json(
    await fetch(`${BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cart.id,
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
      }),
    })
  );
  assert(dupCheckout.body.error === "DUPLICATE_SUBMISSION", "duplicate checkout not rejected");

  const paid = await json(
    await fetch(`${BASE_URL}/api/orders/${checkout.body.order.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "success" }),
    })
  );
  assert(paid.body.order.status === "paid", "payment success did not mark paid");

  const cancelled = await json(
    await fetch(`${BASE_URL}/api/orders/${checkout.body.order.id}/cancel`, {
      method: "POST",
    })
  );
  assert(cancelled.body.order.status === "cancelled", "cancel failed");
  assert(cancelled.body.order.refunds?.length >= 1, "refund was not simulated");

  const restored = (
    await json(await fetch(`${BASE_URL}/api/products/${search.body.products[0].id}`))
  ).body.product.stock;
  assert(restored === before, "stock was not restored after refund/cancel");

  const history = await json(await fetch(`${BASE_URL}/api/orders?email=ada@example.com`));
  const found = history.body.orders.find((o) => o.id === checkout.body.order.id);
  assert(found, "order history missing the order");
  assert(found.history?.some((h) => h.to === "paid"), "history missing paid");
  assert(found.history?.some((h) => h.to === "cancelled"), "history missing cancelled");

  console.log("PASS: search, reservation, duplicate checkout, payment, refund, history");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { useEffect, useState } from "react";
import { api } from "./api.js";
import { money } from "./catalog.js";
import { ProductThumb } from "./ProductThumb.jsx";
import { Modal, ResultCard, TimerRing } from "./ui.jsx";

const RESERVATION_MS = 5 * 60 * 1000;

function stockBadge(stock) {
  if (stock <= 0) return { cls: "out", text: "Out of Stock" };
  if (stock <= 5) return { cls: "low", text: `Low Stock · ${stock}` };
  return { cls: "in", text: `In Stock · ${stock}` };
}

function remainingMs(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function loadCustomer() {
  try {
    return JSON.parse(localStorage.getItem("shop_customer") || "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const [view, setView] = useState("shop");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    availability: "",
  });
  const [detail, setDetail] = useState(null);
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customer, setCustomer] = useState({
    customerName: loadCustomer().customerName || "",
    customerEmail: loadCustomer().customerEmail || "",
  });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [paymentPhase, setPaymentPhase] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [now, setNow] = useState(Date.now());

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }

  async function refreshCart(id = cart?.id) {
    if (!id) return;
    const data = await api.carts.get(id);
    setCart(data.cart);
  }

  async function refreshProducts(nextFilters = filters) {
    const data = await api.products.list(nextFilters);
    setProducts(data.products);
  }

  async function refreshOrders(email = customer.customerEmail) {
    if (!email) {
      setOrders([]);
      return;
    }
    const data = await api.orders.list(email);
    setOrders(data.orders);
  }

  useEffect(() => {
    (async () => {
      try {
        let cartId = localStorage.getItem("shop_cart_id");
        if (cartId) {
          try {
            await refreshCart(cartId);
          } catch {
            cartId = null;
          }
        }
        if (!cartId) {
          const created = await api.carts.create();
          localStorage.setItem("shop_cart_id", created.cart.id);
          setCart(created.cart);
        }
        const cats = await api.products.categories();
        setCategories(cats.categories);
        await refreshProducts();
        await refreshOrders();
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!checkoutOrder?.reservationExpiresAt) return;
    if (remainingMs(checkoutOrder.reservationExpiresAt) === 0 && checkoutOrder.status === "reserved") {
      api.orders.get(checkoutOrder.id).then((data) => {
        setCheckoutOrder(data.order);
        if (data.order.status === "expired") {
          setResult({ type: "expired", order: data.order });
          refreshProducts();
        }
      });
    }
  }, [now, checkoutOrder]);

  function saveCustomer(next) {
    setCustomer(next);
    localStorage.setItem("shop_customer", JSON.stringify(next));
  }

  async function applyFilters(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    await refreshProducts(next);
  }

  async function openProduct(id) {
    const data = await api.products.get(id);
    setDetail(data.product);
    setView("detail");
  }

  async function addToCart(product, quantity = 1) {
    try {
      setError("");
      const data = await api.carts.addItem(cart.id, product.id, quantity);
      setCart(data.cart);
      notify(`${product.name} added to cart`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeQty(productId, quantity) {
    const data = await api.carts.setQty(cart.id, productId, quantity);
    setCart(data.cart);
  }

  async function startCheckout() {
    try {
      setBusy(true);
      setError("");
      if (!customer.customerName || !customer.customerEmail) {
        throw new Error("Enter your name and email before checkout");
      }
      saveCustomer(customer);
      const data = await api.checkout(cart.id, customer);
      setCheckoutOrder(data.order);
      setPaymentPhase("ready");
      setResult(null);
      const created = await api.carts.create();
      localStorage.setItem("shop_cart_id", created.cart.id);
      setCart(created.cart);
      await refreshProducts();
      await refreshOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function pay(outcome) {
    if (!checkoutOrder) return;
    try {
      setBusy(true);
      setPaymentPhase("processing");
      const data = await api.orders.pay(checkoutOrder.id, outcome);
      setCheckoutOrder(data.order);
      const type =
        data.order.status === "paid"
          ? "success"
          : data.order.status === "failed"
            ? "failed"
            : "expired";
      setResult({ type, order: data.order });
      setPaymentPhase(null);
      await refreshProducts();
      await refreshOrders();
    } catch (err) {
      if (err.code === "DUPLICATE_SUBMISSION") {
        setResult({ type: "duplicate", message: err.message, order: checkoutOrder });
        setPaymentPhase(null);
      } else {
        setError(err.message);
        setPaymentPhase("ready");
      }
    } finally {
      setBusy(false);
    }
  }

  async function doCancel(orderId) {
    try {
      const data = await api.orders.cancel(orderId);
      setConfirmCancel(null);
      setSelectedOrder(data.order);
      if (checkoutOrder?.id === orderId) {
        setCheckoutOrder(data.order);
        setResult({
          type: "cancelled",
          order: data.order,
          message: data.order.refunds?.length
            ? "Cancellation complete. A simulated refund was issued and stock was restored."
            : "Order cancelled and reserved stock was restored.",
        });
      }
      await refreshProducts();
      await refreshOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  const reservationLeft = remainingMs(checkoutOrder?.reservationExpiresAt);
  const reservationTotal = RESERVATION_MS;
  const pageKey = view === "detail" ? "detail" : view;

  return (
    <div className="app-shell">
      <div className="page-ambient" aria-hidden="true">
        <span className="amb-orb a1" />
        <span className="amb-orb a2" />
        <span className="amb-orb a3" />
        <span className="amb-wave w1" />
        <span className="amb-wave w2" />
        <span className="amb-spark s1" />
        <span className="amb-spark s2" />
        <span className="amb-spark s3" />
        <span className="amb-spark s4" />
      </div>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NovaPOS</strong>
            <small>Storefront checkout</small>
          </div>
        </div>
        <nav className="nav">
          <button
            className={`nav-btn ${view === "shop" || view === "detail" ? "active" : ""}`}
            onClick={() => setView("shop")}
          >
            Shop
          </button>
          <button className={`nav-btn ${view === "cart" ? "active" : ""}`} onClick={() => setView("cart")}>
            Cart ({cart?.itemCount || 0})
          </button>
          <button className={`nav-btn ${view === "orders" ? "active" : ""}`} onClick={() => setView("orders")}>
            Order history
          </button>
        </nav>
        <div className="sidebar-foot">
          Search, reserve at checkout, mock payment, refunds
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <input
            className="search"
            placeholder="Search products"
            value={filters.q}
            onChange={(e) => applyFilters({ q: e.target.value })}
          />
          <div className="clock">{new Date(now).toLocaleString()}</div>
        </div>
        {error && <p className="error-text">{error}</p>}

        <div key={pageKey} className="page-enter">
        {view === "shop" && (
          <section className="panel glass">
            <div className="page-head">
              <div>
                <h1>Products</h1>
                <p>Search and filter by category, price, or availability.</p>
              </div>
            </div>
            <div className="chip-row">
              <button className={`chip ${filters.category === "" ? "active" : ""}`} onClick={() => applyFilters({ category: "" })}>
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={`chip ${filters.category === category ? "active" : ""}`}
                  onClick={() => applyFilters({ category })}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="filters">
              <label>
                Min price
                <input
                  value={filters.minPrice}
                  onChange={(e) => applyFilters({ minPrice: e.target.value })}
                  type="number"
                  min="0"
                />
              </label>
              <label>
                Max price
                <input
                  value={filters.maxPrice}
                  onChange={(e) => applyFilters({ maxPrice: e.target.value })}
                  type="number"
                  min="0"
                />
              </label>
              <label>
                Availability
                <select
                  value={filters.availability}
                  onChange={(e) => applyFilters({ availability: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </label>
            </div>
            <div className="product-grid">
              {products.map((product) => {
                const badge = stockBadge(product.stock);
                return (
                  <article className="product-card" key={product.id}>
                    <div className="thumb">
                      <ProductThumb name={product.name} size="lg" />
                    </div>
                    <h3>{product.name}</h3>
                    <div className="price">{money(product.price)}</div>
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    <small className="card-cat">{product.category}</small>
                    <div className="card-actions">
                      <button className="btn ghost" onClick={() => openProduct(product.id)}>
                        Details
                      </button>
                      <button
                        className="btn primary"
                        disabled={product.stock < 1}
                        onClick={() => addToCart(product)}
                      >
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {!products.length && <div className="empty">No products match those filters</div>}
          </section>
        )}

        {view === "detail" && detail && (
          <section className="panel glass">
            <button className="btn ghost" onClick={() => setView("shop")}>
              Back to shop
            </button>
            <div className="detail" style={{ marginTop: 16 }}>
              <ProductThumb name={detail.name} size="lg" />
              <div>
                <h1>{detail.name}</h1>
                <p className="price">{money(detail.price)}</p>
                <p>{detail.description}</p>
                <p>
                  Category: {detail.category} · {stockBadge(detail.stock).text}
                </p>
                <button className="btn primary" disabled={detail.stock < 1} onClick={() => addToCart(detail)}>
                  Add to cart
                </button>
              </div>
            </div>
          </section>
        )}

        {view === "cart" && (
          <section className="panel glass cart-page">
            <div className="page-head">
              <div>
                <h1>Your Cart ({cart?.itemCount || 0})</h1>
                <p>Stock is reserved when you enter checkout — not while items sit in the cart.</p>
              </div>
            </div>

            <div className="cart-layout">
              <div className="cart-panel">
                <div className="cart-list">
                  {!cart?.items?.length && <div className="empty">Cart is empty</div>}
                  {cart?.items?.map((item) => (
                    <div className="cart-item" key={item.productId}>
                      <ProductThumb name={item.name} size="sm" />
                      <div className="cart-item-meta">
                        <strong>{item.name}</strong>
                        <div className="price">{money(item.price)}</div>
                      </div>
                      <div className="qty">
                        <button onClick={() => changeQty(item.productId, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeQty(item.productId, item.quantity + 1)}>+</button>
                      </div>
                      <div className="cart-line">{money(item.price * item.quantity)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="checkout-side">
                <h3>Checkout details</h3>
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={customer.customerName}
                      onChange={(e) => saveCustomer({ ...customer, customerName: e.target.value })}
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={customer.customerEmail}
                      onChange={(e) => saveCustomer({ ...customer, customerEmail: e.target.value })}
                      placeholder="you@email.com"
                    />
                  </label>
                </div>
                <div className="totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(cart?.subtotal || 0)}</strong>
                  </div>
                </div>
                <button
                  className="btn primary full"
                  disabled={!cart?.items?.length || busy}
                  onClick={startCheckout}
                >
                  Reserve stock & checkout
                </button>
                <p className="checkout-hint">Reservations expire in 5 minutes after checkout.</p>
              </aside>
            </div>
          </section>
        )}

        {view === "orders" && (
          <section className="panel glass">
            <div className="page-head">
              <div>
                <h1>Order history</h1>
                <p>Current and past statuses for the email used at checkout.</p>
              </div>
              <button className="btn ghost" onClick={() => refreshOrders()}>
                Refresh
              </button>
            </div>
            <div className="form-grid">
              <label>
                Email
                <input
                  value={customer.customerEmail}
                  onChange={(e) => saveCustomer({ ...customer, customerEmail: e.target.value })}
                />
              </label>
            </div>
            <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="actions"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{money(order.subtotal)}</td>
                    <td className={`status ${order.status}`}>{order.status}</td>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                    <td className="actions">
                      <button className="btn ghost sm" onClick={() => setSelectedOrder(order)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {!orders.length && <div className="empty">No orders for this email yet</div>}
          </section>
        )}
        </div>
      </main>

      {checkoutOrder && paymentPhase === "ready" && (
        <Modal className="modal-pay">
          <div className="steps">
            <div className="step">1. Cart</div>
            <div className="step on">2. Payment</div>
            <div className="step">3. Confirmation</div>
          </div>
          <h2>Checkout — Mock Payment</h2>
          <p className="muted-line">Simulate a payment gateway outcome for this reserved order.</p>
          <div className="pay-center">
            <TimerRing remaining={reservationLeft} total={reservationTotal} />
            <p className="pay-order-id">{checkoutOrder.orderNumber}</p>
          </div>
          <div className="pay-actions">
            <button className="btn pay-success" disabled={busy} onClick={() => pay("success")}>
              Success
            </button>
            <button className="btn pay-failure" disabled={busy} onClick={() => pay("failure")}>
              Failure
            </button>
            <button className="btn pay-timeout" disabled={busy} onClick={() => pay("timeout")}>
              Timeout
            </button>
          </div>
          <div className="pay-footer">
            <button
              className="btn ghost"
              onClick={() => {
                setPaymentPhase(null);
                setView("orders");
              }}
            >
              Back
            </button>
            <button className="btn ghost" onClick={() => setConfirmCancel(checkoutOrder)}>
              Cancel order
            </button>
          </div>
        </Modal>
      )}

      {paymentPhase === "processing" && (
        <Modal>
          <div className="process-card">
            <div className="pay-orb">⏳</div>
            <h2>Payment Processing</h2>
            <p style={{ color: "var(--muted)" }}>Talking to the mock payment gateway…</p>
          </div>
        </Modal>
      )}

      {result && (
        <Modal
          onClose={() => setResult(null)}
          ambient={result.type === "expired" ? "timeout" : result.type}
          className={`modal-result modal-result-${result.type === "expired" ? "timeout" : result.type}`}
        >
          <ResultCard
            type={result.type}
            title={
              result.type === "success"
                ? "Payment Successful!"
                : result.type === "failed"
                  ? "Payment Failed"
                  : result.type === "expired"
                    ? "Payment Timeout"
                    : result.type === "duplicate"
                      ? "Duplicate Submission Detected"
                      : "Order Cancelled"
            }
            body={
              result.message ||
              (result.type === "success"
                ? "Your order has been placed successfully."
                : result.type === "failed"
                  ? "Your payment could not be processed."
                  : result.type === "duplicate"
                    ? "This cart/order has already been submitted or is currently being processed."
                    : result.type === "cancelled"
                      ? "Order cancelled and stock was restored."
                      : "Payment timed out. Reservation expired.")
            }
            order={result.order}
            actions={
              <>
                {result.type === "success" && (
                  <button
                    className="btn outline-blue"
                    onClick={() => {
                      setResult(null);
                      setCheckoutOrder(null);
                      setPaymentPhase(null);
                      setView("orders");
                    }}
                  >
                    View Order
                  </button>
                )}
                {result.type === "failed" && (
                  <button
                    className="btn outline-red"
                    onClick={() => {
                      setResult(null);
                      setCheckoutOrder(null);
                      setPaymentPhase(null);
                    }}
                  >
                    Try Again
                  </button>
                )}
                {result.type === "expired" && (
                  <button
                    className="btn outline-amber"
                    onClick={() => {
                      setResult(null);
                      setCheckoutOrder(null);
                      setPaymentPhase(null);
                      setView("shop");
                    }}
                  >
                    View Stock
                  </button>
                )}
                {(result.type === "duplicate" || result.type === "cancelled") && (
                  <button
                    className="btn outline-purple"
                    onClick={() => {
                      setResult(null);
                      setCheckoutOrder(null);
                      setPaymentPhase(null);
                      setView("orders");
                    }}
                  >
                    View Order
                  </button>
                )}
              </>
            }
          />
        </Modal>
      )}

      {selectedOrder && (
        <Modal wide onClose={() => setSelectedOrder(null)} className="modal-order">
          <div className="modal-head between">
            <h2>{selectedOrder.orderNumber}</h2>
            <span className={`status ${selectedOrder.status}`}>{selectedOrder.status}</span>
          </div>
          <p className="muted-line">
            {selectedOrder.customerName} · {selectedOrder.customerEmail}
          </p>
          <div className="modal-section">
            {selectedOrder.items?.map((item) => (
              <div key={item.productId} className="cart-item compact">
                <ProductThumb name={item.name} size="sm" />
                <div className="cart-item-meta">
                  <strong>
                    {item.name} × {item.quantity}
                  </strong>
                </div>
                <strong>{money(item.lineTotal)}</strong>
              </div>
            ))}
          </div>
          <div className="modal-section">
            <h3>Status history</h3>
            <ul className="history">
              {selectedOrder.history?.map((event, index) => (
                <li key={index}>
                  <span>
                    {event.from || "—"} → {event.to}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </span>
                  <span>{new Date(event.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
          {selectedOrder.refunds?.length > 0 && (
            <div className="modal-section">
              <h3>Refunds</h3>
              {selectedOrder.refunds.map((refund) => (
                <p key={refund.id}>
                  {money(refund.amount)} · {refund.status} · {refund.reason}
                </p>
              ))}
            </div>
          )}
          <div className="modal-actions">
            {(selectedOrder.status === "reserved" || selectedOrder.status === "paid") && (
              <button className="btn danger" onClick={() => setConfirmCancel(selectedOrder)}>
                Cancel order
              </button>
            )}
            {selectedOrder.status === "reserved" && (
              <button
                className="btn primary"
                onClick={() => {
                  setCheckoutOrder(selectedOrder);
                  setPaymentPhase("ready");
                  setSelectedOrder(null);
                }}
              >
                Continue payment
              </button>
            )}
            <button className="btn ghost" onClick={() => setSelectedOrder(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {confirmCancel && (
        <Modal onClose={() => setConfirmCancel(null)} className="modal-cancel">
          <h2>Cancel order?</h2>
          <p className="muted-line">
            {confirmCancel.status === "paid"
              ? "A simulated refund will be issued and stock will be restored."
              : "Reserved stock will be returned to inventory."}
          </p>
          <div className="modal-actions">
            <button className="btn danger" onClick={() => doCancel(confirmCancel.id)}>
              Confirm cancellation
            </button>
            <button className="btn ghost" onClick={() => setConfirmCancel(null)}>
              Back
            </button>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

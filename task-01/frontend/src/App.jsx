import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Target,
  Users,
  BarChart3,
  Heart,
  X,
} from "lucide-react";
import { api } from "./api.js";
import {
  FILTERS,
  formatWhen,
  money,
  remainingMs,
  statusTone,
  stockMeta,
  withTax,
} from "./catalog.js";
import { ProductThumb } from "./ProductThumb.jsx";
import {
  CancelOrderModal,
  Modal,
  ResultCard,
  StockReservedCard,
  StockValidCard,
  TimerRing,
} from "./ui.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "customers", label: "Customers", icon: Users, disabled: true },
  { id: "reports", label: "Reports", icon: BarChart3, disabled: true },
  { id: "settings", label: "Settings", icon: Settings, disabled: true },
];

const RESERVATION_MS = 5 * 60 * 1000;

export default function App() {
  const [view, setView] = useState("products");
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState(null);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [productForm, setProductForm] = useState(null);
  const [validateProduct, setValidateProduct] = useState(null);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [paymentPhase, setPaymentPhase] = useState(null);
  const [processStep, setProcessStep] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [orderPage, setOrderPage] = useState(0);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [now, setNow] = useState(Date.now());

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }

  async function refreshProducts() {
    const data = await api.products.list();
    setProducts(data.products);
  }

  async function refreshCart(id = cart?.id) {
    if (!id) return;
    const data = await api.carts.get(id);
    setCart(data.cart);
  }

  async function refreshOrders() {
    const data = await api.orders.list();
    setOrders(data.orders);
  }

  async function refreshInventory() {
    const data = await api.inventory();
    setInventory(data.inventory);
  }

  async function refreshAll() {
    await Promise.all([refreshProducts(), refreshOrders(), refreshInventory()]);
  }

  useEffect(() => {
    (async () => {
      try {
        let cartId = localStorage.getItem("pos_cart_id");
        if (cartId) {
          try {
            await refreshCart(cartId);
          } catch {
            cartId = null;
          }
        }
        if (!cartId) {
          const created = await api.carts.create();
          localStorage.setItem("pos_cart_id", created.cart.id);
          setCart(created.cart);
        }
        const metaData = await api.meta();
        setMeta(metaData);
        await refreshAll();
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
    if (!checkoutOrder?.reservationExpiresAt || checkoutOrder.status !== "reserved") return;
    if (remainingMs(checkoutOrder.reservationExpiresAt) > 0) return;
    api.orders.get(checkoutOrder.id).then((data) => {
      setCheckoutOrder(data.order);
      if (data.order.status === "expired") {
        setCheckoutStep(null);
        setPaymentPhase(null);
        setResult({
          type: "timeout",
          title: "Payment Timeout",
          body: "Payment timed out. Reservation expired and stock was released.",
          order: data.order,
        });
        refreshAll();
      }
    });
  }, [now, checkoutOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "All" && (p.category || "Other") !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [products, query, category]);

  const categoryCounts = useMemo(() => {
    const counts = { All: products.length };
    for (const p of products) {
      const key = p.category || "Other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [products]);

  const cartTotals = withTax(cart?.subtotal || 0);
  const reservationLeft = remainingMs(checkoutOrder?.reservationExpiresAt);
  const reservationTotal =
    (meta?.reservationMinutes || 5) * 60 * 1000 || RESERVATION_MS;

  const pagedOrders = orders.slice(orderPage * 8, orderPage * 8 + 8);
  const orderPages = Math.max(1, Math.ceil(orders.length / 8));
  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((row) => row.name.toLowerCase().includes(q));
  }, [inventory, inventoryQuery]);

  const dashboardStats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").length;
    const reserved = orders.filter((o) => o.status === "reserved").length;
    const failed = orders.filter((o) => ["failed", "expired", "cancelled"].includes(o.status)).length;
    const low = inventory.filter((i) => i.stock > 0 && i.stock <= 5).length;
    return { paid, reserved, failed, low, total: orders.length };
  }, [orders, inventory]);

  async function addToCart(product, qty = 1) {
    try {
      setError("");
      const data = await api.carts.addItem(cart.id, product.id, qty);
      setCart(data.cart);
      notify(`${product.name} added to cart`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeQty(productId, quantity) {
    try {
      const data = await api.carts.setQty(cart.id, productId, quantity);
      setCart(data.cart);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startCheckout() {
    try {
      setBusy(true);
      setError("");
      const data = await api.checkout(cart.id);
      setCheckoutOrder(data.order);
      setCheckoutStep("reserved");
      setPaymentPhase(null);
      setResult(null);
      const created = await api.carts.create();
      localStorage.setItem("pos_cart_id", created.cart.id);
      setCart(created.cart);
      await refreshAll();
    } catch (err) {
      if (err.code === "DUPLICATE_SUBMISSION") {
        setResult({
          type: "duplicate",
          title: "Duplicate Submission Detected",
          body: "This cart/order has already been submitted or is currently being processed.",
          order: err.details ? { orderNumber: err.details.orderId, id: err.details.orderId } : null,
        });
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function pay(outcome) {
    if (!checkoutOrder) return;
    try {
      setBusy(true);
      setPaymentPhase("processing");
      setProcessStep(0);
      setError("");

      const advance = setInterval(() => {
        setProcessStep((s) => Math.min(2, s + 1));
      }, 450);

      const data = await api.orders.pay(checkoutOrder.id, outcome);
      clearInterval(advance);
      setProcessStep(2);
      await new Promise((r) => setTimeout(r, 350));

      setCheckoutOrder(data.order);
      setCheckoutStep(null);
      setPaymentPhase(null);

      if (data.order.status === "paid") {
        setResult({
          type: "success",
          title: "Payment Successful!",
          body: "Your order has been placed successfully.",
          order: data.order,
        });
      } else if (data.order.status === "failed") {
        setResult({
          type: "failed",
          title: "Payment Failed",
          body: "Your payment could not be processed.",
          order: data.order,
        });
      } else {
        setResult({
          type: "timeout",
          title: "Payment Timeout",
          body: "Payment timed out. Reservation expired.",
          order: data.order,
        });
      }
      await refreshAll();
    } catch (err) {
      if (err.code === "DUPLICATE_SUBMISSION") {
        setResult({
          type: "duplicate",
          title: "Duplicate Submission Detected",
          body: "This cart/order has already been submitted or is currently being processed.",
          order: checkoutOrder,
        });
        setPaymentPhase(null);
        setCheckoutStep(null);
      } else {
        setError(err.message);
        setPaymentPhase(null);
        setCheckoutStep("payment");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      name: form.get("name"),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      category: form.get("category") || "Other",
    };
    try {
      if (productForm.id) await api.products.update(productForm.id, payload);
      else await api.products.create(payload);
      setProductForm(null);
      await refreshAll();
      notify(productForm.id ? "Product updated" : "Product created");
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeProduct(id) {
    try {
      await api.products.remove(id);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function doCancel(orderId) {
    try {
      const data = await api.orders.cancel(orderId);
      setConfirmCancel(null);
      if (checkoutOrder?.id === orderId) {
        setCheckoutOrder(data.order);
        setCheckoutStep(null);
        setPaymentPhase(null);
      }
      setResult({
        type: "cancelled",
        title: "Order Cancelled",
        body: "Stock has been returned to inventory.",
        order: data.order,
      });
      setSelectedOrder(null);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openOrder(order) {
    try {
      const data = await api.orders.get(order.id);
      setSelectedOrder(data.order);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NovaPOS</strong>
            <small>Smart orders. Real inventory.</small>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-btn ${view === item.id ? "active" : ""}`}
                disabled={item.disabled}
                onClick={() => !item.disabled && setView(item.id)}
                title={item.disabled ? "Presentation only" : item.label}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">K</div>
          <div>
            <strong style={{ fontSize: 13 }}>Kavitharan</strong>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Store Manager</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search-wrap">
            <Search size={16} />
            <input
              placeholder="Search products, SKU or barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="top-meta">
            <button className="icon-btn" type="button" aria-label="Notifications">
              <Bell size={16} />
              <span className="dot" />
            </button>
            <span>{formatWhen(now)}</span>
            <span>Cart {cart?.itemCount || 0}</span>
          </div>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div key={view} className="page-enter">
        {view === "dashboard" && (
          <section className="panel glass">
            <div className="page-head">
              <div>
                <h1>Dashboard</h1>
                <p>Live order and inventory snapshot from the POS backend.</p>
              </div>
            </div>
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <div className="stat">
                <span>Orders</span>
                <b>{dashboardStats.total}</b>
              </div>
              <div className="stat">
                <span>Paid</span>
                <b style={{ color: "var(--green)" }}>{dashboardStats.paid}</b>
              </div>
              <div className="stat">
                <span>Reserved</span>
                <b style={{ color: "var(--blue)" }}>{dashboardStats.reserved}</b>
              </div>
              <div className="stat">
                <span>Low stock SKUs</span>
                <b style={{ color: "var(--orange)" }}>{dashboardStats.low}</b>
              </div>
            </div>
            <StatusDiagram style={{ marginTop: 20 }} />
          </section>
        )}

        {view === "products" && (
          <div className="workspace">
            <section className="panel glass">
              <div className="page-head">
                <div>
                  <h1>Products</h1>
                  <p>Manage products and available stock. Stock locks only at checkout.</p>
                </div>
                <button className="btn primary" onClick={() => setProductForm({})}>
                  <Plus size={16} /> Add Product
                </button>
              </div>

              <div className="chip-row" style={{ marginTop: 14 }}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    className={`chip ${category === f ? "active" : ""}`}
                    onClick={() => setCategory(f)}
                  >
                    {f} ({categoryCounts[f] || 0})
                  </button>
                ))}
              </div>

              <div className="product-grid">
                {filtered.map((product) => {
                  const badge = stockMeta(product.stock);
                  return (
                    <article className="product-card" key={product.id}>
                      <div className="thumb">
                        <ProductThumb name={product.name} />
                        <button
                          className={`fav ${favorites.has(product.id) ? "on" : ""}`}
                          onClick={() => toggleFavorite(product.id)}
                          type="button"
                        >
                          <Heart size={14} fill={favorites.has(product.id) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <h3>{product.name}</h3>
                      <div className="price">{money(product.price)}</div>
                      <span className={`badge tone-${badge.tone}`}>{badge.label}</span>
                      <div className="row card-actions">
                        <button
                          className="btn ghost sm"
                          onClick={() => setValidateProduct(product)}
                        >
                          Check stock
                        </button>
                        <button
                          className="btn ghost sm"
                          onClick={() => setProductForm(product)}
                        >
                          Edit
                        </button>
                      </div>
                      <button
                        className="cart-fab"
                        disabled={product.stock < 1}
                        onClick={() => addToCart(product)}
                        title="Add to cart"
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </article>
                  );
                })}
              </div>
              {!filtered.length && <div className="empty">No products match this filter</div>}
            </section>

            <aside className="panel glass cart-side">
              <div className="page-head">
                <div>
                  <h1 style={{ fontSize: 22 }}>Your Cart ({cart?.itemCount || 0})</h1>
                  <p>Stock is reserved when you enter checkout.</p>
                </div>
                {cart?.items?.length > 0 && (
                  <button
                    className="btn ghost"
                    onClick={() => api.carts.clear(cart.id).then((d) => setCart(d.cart))}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="cart-list">
                {!cart?.items?.length && <div className="empty">Cart is empty</div>}
                {cart?.items?.map((item) => (
                  <div className="cart-item" key={item.productId}>
                    <ProductThumb name={item.name} size="sm" />
                    <div>
                      <strong>{item.name}</strong>
                      <div className="price">{money(item.price)}</div>
                    </div>
                    <div className="qty">
                      <button onClick={() => changeQty(item.productId, item.quantity - 1)}>
                        <Minus size={12} />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => changeQty(item.productId, item.quantity + 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(cart?.subtotal || 0)}</strong>
                </div>
                <div>
                  <span>Tax (8%)</span>
                  <strong>{money(cartTotals.tax)}</strong>
                </div>
                <div className="grand">
                  <span>Total</span>
                  <strong>{money(cartTotals.total)}</strong>
                </div>
                <button
                  className="btn primary full"
                  style={{ marginTop: 10 }}
                  disabled={!cart?.items?.length || busy}
                  onClick={startCheckout}
                >
                  Proceed to Checkout <ArrowRight size={16} />
                </button>
              </div>
            </aside>
          </div>
        )}

        {view === "orders" && (
          <div className="workspace">
            <section className="panel glass">
              <div className="page-head">
                <div>
                  <h1>Orders</h1>
                  <p>Track statuses. Cancelled and failed reserved orders restore stock.</p>
                </div>
                <button className="btn ghost" onClick={refreshOrders}>
                  Refresh
                </button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.orderNumber}</td>
                        <td>Walk-in</td>
                        <td>{money(order.subtotal)}</td>
                        <td>
                          <span className={`badge tone-${statusTone(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>{formatWhen(order.createdAt)}</td>
                        <td>
                          <button className="btn ghost" onClick={() => openOrder(order)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!orders.length && <div className="empty">No orders yet</div>}
              {orders.length > 0 && (
                <div className="pager">
                  <button
                    className="btn ghost"
                    disabled={orderPage === 0}
                    onClick={() => setOrderPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <span>
                    Page {orderPage + 1} / {orderPages}
                  </span>
                  <button
                    className="btn ghost"
                    disabled={orderPage >= orderPages - 1}
                    onClick={() => setOrderPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
            <StatusDiagram />
          </div>
        )}

        {view === "inventory" && (
          <section className="panel glass">
            <div className="page-head">
              <div>
                <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Boxes size={22} color="#2ee4ff" /> Inventory
                </h1>
                <p>Current stock levels</p>
              </div>
              <button className="icon-btn" onClick={refreshInventory} title="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="inv-search">
              <Search size={15} />
              <input
                placeholder="Search product..."
                value={inventoryQuery}
                onChange={(e) => setInventoryQuery(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((row) => (
                    <tr key={row.productId}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ProductThumb name={row.name} size="xs" />
                          {row.name}
                        </div>
                      </td>
                      <td>{row.stock}</td>
                      <td>
                        <span
                          className={`badge outline tone-${
                            row.stock === 0 ? "red" : row.stock <= 5 ? "orange" : "green"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager" style={{ justifyContent: "space-between" }}>
              <span>Last updated: {formatWhen(now)}</span>
            </div>
          </section>
        )}
        </div>
      </main>

      {productForm && (
        <Modal onClose={() => setProductForm(null)}>
          <h2>{productForm.id ? "Edit Product" : "Add Product"}</h2>
          <form onSubmit={saveProduct}>
            <div className="form-grid">
              <label>
                Name
                <input name="name" defaultValue={productForm.name || ""} required />
              </label>
              <label>
                Price
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={productForm.price ?? ""}
                  required
                />
              </label>
              <label>
                Available stock
                <input
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={productForm.stock ?? 0}
                  required
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue={productForm.category || "Other"}>
                  {FILTERS.filter((f) => f !== "All").map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              <button className="btn primary" type="submit">
                Save
              </button>
              {productForm.id && (
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => {
                    removeProduct(productForm.id);
                    setProductForm(null);
                  }}
                >
                  Delete
                </button>
              )}
              <button className="btn ghost" type="button" onClick={() => setProductForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {validateProduct && (
        <StockValidCard
          product={validateProduct}
          onAdd={async () => {
            await addToCart(validateProduct);
            setValidateProduct(null);
          }}
          onClose={() => setValidateProduct(null)}
        />
      )}

      {checkoutOrder && checkoutStep === "reserved" && (
        <StockReservedCard
          order={checkoutOrder}
          remaining={reservationLeft}
          total={reservationTotal}
          onContinue={() => setCheckoutStep("payment")}
          onCancel={() => setConfirmCancel(checkoutOrder)}
        />
      )}

      {checkoutOrder && checkoutStep === "payment" && !paymentPhase && (
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
            <button className="btn ghost" onClick={() => setCheckoutStep("reserved")}>
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
            <div className="pay-orb">
              <CreditCard size={34} />
            </div>
            <h2>Payment Processing</h2>
            <p style={{ color: "var(--muted)" }}>Talking to the mock payment gateway…</p>
            <div className="process-steps">
              {[
                "Validating payment details",
                "Processing with gateway",
                "Finalizing transaction",
              ].map((label, index) => (
                <div key={label} className={`process-step ${processStep >= index ? "on" : ""}`}>
                  {processStep > index ? (
                    <Check size={16} color="#3ee0a0" />
                  ) : processStep === index ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "1px solid #445",
                      }}
                    />
                  )}
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {result && (
        <Modal
          onClose={() => setResult(null)}
          ambient={result.type}
          className={`modal-result modal-result-${result.type}`}
        >
          <ResultCard
            type={result.type}
            title={result.title}
            body={result.body}
            order={result.order}
            actions={
              <>
                {result.type === "success" && result.order?.id && (
                  <button
                    className="btn outline-blue"
                    onClick={async () => {
                      await openOrder(result.order);
                      setResult(null);
                      setCheckoutOrder(null);
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
                    }}
                  >
                    Try Again
                  </button>
                )}
                {result.type === "timeout" && (
                  <button
                    className="btn outline-orange"
                    onClick={() => {
                      setResult(null);
                      setCheckoutOrder(null);
                      setView("inventory");
                    }}
                  >
                    View Stock
                  </button>
                )}
                {result.type === "duplicate" && (
                  <button
                    className="btn outline-blue"
                    onClick={async () => {
                      if (result.order?.id) await openOrder(result.order);
                      setResult(null);
                    }}
                  >
                    View Order
                  </button>
                )}
                {result.type === "cancelled" && (
                  <button
                    className="btn cyan"
                    onClick={async () => {
                      if (result.order) await openOrder(result.order);
                      setResult(null);
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
        <Modal wide onClose={() => setSelectedOrder(null)} className="order-detail-card">
          <div className="od-head">
            <div>
              <h2>Order #{selectedOrder.orderNumber}</h2>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`badge tone-${statusTone(selectedOrder.status)}`}>
                  {selectedOrder.status === "paid" ? "+ Paid" : selectedOrder.status}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {formatWhen(selectedOrder.createdAt)}
                </span>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setSelectedOrder(null)}>
              <X size={16} />
            </button>
          </div>

          <div className="od-grid">
            <div className="od-box">
              <span>Customer</span>
              <strong>Customer 1</strong>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>customer1@email.com</div>
            </div>
            <div className="od-box">
              <span>Payment Method</span>
              <strong>Card **** 4242</strong>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Total {money(selectedOrder.subtotal)}
              </div>
            </div>
          </div>

          {selectedOrder.items?.map((item) => (
            <div className="cart-item" key={item.productId} style={{ marginTop: 10 }}>
              <ProductThumb name={item.name} size="sm" qty={item.quantity} />
              <div>
                <strong>{item.name}</strong>
                <div className="price">
                  {money(item.unitPrice)} x {item.quantity}
                </div>
              </div>
              <strong>{money(item.lineTotal)}</strong>
            </div>
          ))}

          <div className="od-total">
            <span>Total</span>
            <span>{money(selectedOrder.subtotal)}</span>
          </div>

          <div className="row">
            {(selectedOrder.status === "reserved" || selectedOrder.status === "paid") && (
              <button className="btn ghost" onClick={() => setConfirmCancel(selectedOrder)}>
                Cancel Order
              </button>
            )}
            {selectedOrder.status === "reserved" && (
              <button
                className="btn primary"
                onClick={() => {
                  setCheckoutOrder(selectedOrder);
                  setCheckoutStep("payment");
                  setSelectedOrder(null);
                }}
              >
                Continue payment
              </button>
            )}
            <button className="btn primary" onClick={() => setSelectedOrder(null)}>
              View Receipt
            </button>
          </div>
        </Modal>
      )}

      {confirmCancel && (
        <CancelOrderModal
          order={confirmCancel}
          onConfirm={() => doCancel(confirmCancel.id)}
          onClose={() => setConfirmCancel(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function StatusDiagram({ style }) {
  const nodes = [
    { id: "pending", label: "Pending", tone: "orange", note: "Waiting for stock reservation" },
    { id: "reserved", label: "Reserved", tone: "blue", note: "Stock reserved for 5 minutes" },
    { id: "paid", label: "Paid", tone: "green", note: "Payment completed" },
    { id: "cancelled", label: "Cancelled", tone: "red", note: "Stock restored" },
    { id: "expired", label: "Expired", tone: "purple", note: "Reservation expired" },
    { id: "failed", label: "Failed", tone: "red", note: "Payment failed · Stock restored" },
  ];

  return (
    <aside className="panel glass" style={style}>
      <h2
        className="section-title"
        style={{ fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}
      >
        <Target size={18} color="#2ee4ff" /> Order Status Transitions
      </h2>
      <div className="flow-row">
        <span className="badge tone-orange">Pending</span>
        <span className="arrow">→</span>
        <span className="badge tone-blue">Reserved</span>
        <span className="arrow">→</span>
        <span className="badge tone-green">Paid</span>
      </div>
      <div className="timeline">
        {nodes.map((node, index) => (
          <div
            key={node.id}
            className={`tl-item ${
              ["paid", "reserved", "pending"].includes(node.id) ? "done" : "fail"
            }`}
          >
            <div className="tl-rail">
              <div
                className="tl-dot"
                style={{
                  background: `var(--${node.tone === "purple" ? "pink" : node.tone})`,
                }}
              />
              {index < nodes.length - 1 && <div className="tl-line" />}
            </div>
            <div style={{ paddingBottom: 12 }}>
              <span className={`badge tone-${node.tone}`}>{node.label}</span>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{node.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="warn-note">
        <AlertTriangle size={14} />
        Invalid transitions are blocked to maintain data consistency.
      </div>
    </aside>
  );
}

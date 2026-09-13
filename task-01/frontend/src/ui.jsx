import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Grid2x2,
  ShoppingBag,
  X,
  XCircle,
} from "lucide-react";
import { formatWhen, money, mmss } from "./catalog.js";
import { ProductThumb } from "./ProductThumb.jsx";

export function TimerRing({ remaining, total }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const progress = total > 0 ? Math.min(1, remaining / total) : 0;
  return (
    <div className="timer-wrap">
      <svg className="timer-svg" viewBox="0 0 140 140">
        <defs>
          <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2ee4ff" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
        <circle className="track" cx="70" cy="70" r={r} />
        <circle
          className="value"
          cx="70"
          cy="70"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transformOrigin: "70px 70px" }}
        />
      </svg>
      <div className="timer-copy">
        <b>{mmss(remaining)}</b>
        <span>Remaining</span>
      </div>
    </div>
  );
}

export function Modal({ wide, children, onClose, className = "", ambient }) {
  return (
    <div
      className={`backdrop ${ambient ? `ambient ambient-${ambient}` : ""}`}
      onClick={onClose || undefined}
    >
      {ambient ? (
        <div className="ambient-fx" aria-hidden="true">
          <span className="orb o1" />
          <span className="orb o2" />
          <span className="orb o3" />
          <span className="wave w1" />
          <span className="wave w2" />
          <span className="spark s1" />
          <span className="spark s2" />
          <span className="spark s3" />
          <span className="spark s4" />
          <span className="spark s5" />
        </div>
      ) : null}
      <div
        className={`modal glass pop-in ${wide ? "wide" : ""} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function StockValidCard({ product, onAdd, onClose }) {
  const available = product.stock > 0;
  return (
    <Modal onClose={onClose} className="modal-stock-valid">
      <div className="modal-head">
        <button className="icon-btn sm" type="button" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
        <h2>Stock Validation (Checkout)</h2>
      </div>

      <div className="valid-product-card">
        <ProductThumb name={product.name} size="md" />
        <div className="valid-product-meta">
          <strong>{product.name}</strong>
          <div className="price">{money(product.price)}</div>
        </div>
        <div className="valid-avail">
          <span className="avail-label">Available</span>
          <b>{product.stock}</b>
        </div>
      </div>

      <div className={`status-hero ${available ? "ok" : "bad"}`}>
        <div className="glow-orb">
          {available ? <Check size={34} strokeWidth={3} /> : <X size={34} strokeWidth={3} />}
        </div>
        <h3>{available ? "Stock is available!" : "Out of stock"}</h3>
        <p>
          {available
            ? "You can proceed with this item."
            : "This product cannot be added right now."}
        </p>
      </div>

      <button className="btn primary full" onClick={onAdd} disabled={!available}>
        <ShoppingBag size={16} /> Add to Cart
      </button>
    </Modal>
  );
}

export function StockReservedCard({
  order,
  remaining,
  total,
  onContinue,
  onCancel,
}) {
  const first = order.items?.[0];
  return (
    <Modal className="modal-reserved">
      <div className="modal-head between">
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <Grid2x2 size={16} color="#2ee4ff" />
          <h2>Stock Reserved</h2>
        </div>
      </div>
      <p className="muted-line">Your stock has been reserved for 5 minutes.</p>

      <div className="reserved-layout">
        <div>
          <TimerRing remaining={remaining} total={total} />
          <ul className="check-list">
            <li>
              <Check size={14} /> Stock reserved successfully
            </li>
            <li>
              <Check size={14} /> Reservation will expire in 5 minutes
            </li>
            <li>
              <Check size={14} /> Release on expiry
            </li>
          </ul>
        </div>
        {first && (
          <div className="reserved-side-card">
            <ProductThumb name={first.name} size="lg" qty={first.quantity} />
            <strong>{first.name}</strong>
            <span className="price">{money(first.unitPrice)}</span>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary full" onClick={onContinue}>
          Continue to Payment
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export function ResultCard({ type, title, body, order, actions }) {
  const Icon =
    type === "success"
      ? CheckCircle2
      : type === "failed"
        ? XCircle
        : type === "duplicate"
          ? Briefcase
          : type === "cancelled"
            ? CheckCircle2
            : Clock;

  return (
    <div className={`result-hero ${type}`}>
      <div className="result-fx" aria-hidden="true">
        <span className="burst" />
        <span className="ring r1" />
        <span className="ring r2" />
        <span className="spark s1" />
        <span className="spark s2" />
        <span className="spark s3" />
        <span className="spark s4" />
        <span className="spark s5" />
        <span className="spark s6" />
      </div>
      <div className="glow-orb xl pop-scale">
        <Icon size={42} strokeWidth={2.2} />
      </div>
      <h2 className="fade-up">{title}</h2>
      <p className="fade-up delay-1">{body}</p>
      {order?.orderNumber && (
        <div className="result-meta fade-up delay-2">
          <span>Order #{String(order.orderNumber).replace(/^#/, "")}</span>
          {order.createdAt || order.updatedAt ? (
            <span>{formatWhen(order.updatedAt || order.createdAt)}</span>
          ) : null}
        </div>
      )}
      <div className="result-actions fade-up delay-3">{actions}</div>
    </div>
  );
}

export function CancelOrderModal({ order, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} className="modal-cancel">
      <div className="cancel-hero">
        <div className="glow-orb red">
          <AlertTriangle size={28} />
        </div>
        <h2>Cancel Order</h2>
        <p>
          Are you sure you want to cancel this order? Stock will be restored to inventory.
        </p>
        <div className="result-meta">Order #{order.orderNumber}</div>
        <div className="row" style={{ marginTop: 18, justifyContent: "center" }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger glow-red" onClick={onConfirm}>
            Confirm Cancellation
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OrderCancelledCard({ order, onView }) {
  return (
    <div className="result-hero cancelled">
      <div className="glow-orb xl">
        <CheckCircle2 size={42} />
      </div>
      <h2>Order Cancelled</h2>
      <p>Stock has been returned to inventory.</p>
      <div className="result-meta">Order #{order?.orderNumber}</div>
      <div className="result-actions">
        <button className="btn cyan" onClick={onView}>
          View Order
        </button>
      </div>
    </div>
  );
}

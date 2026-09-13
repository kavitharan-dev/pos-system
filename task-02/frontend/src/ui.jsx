function mmss(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
      className={`modal-backdrop ${ambient ? `ambient ambient-${ambient}` : ""}`}
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
        className={`modal pop-in ${wide ? "wide" : ""} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const RESULT_ICON = {
  success: "✓",
  failed: "✕",
  expired: "⏱",
  timeout: "⏱",
  duplicate: "🛍",
  cancelled: "✓",
};

export function ResultCard({ type, title, body, order, actions }) {
  const ambientType = type === "expired" ? "timeout" : type;
  return (
    <div className={`result-hero ${ambientType}`}>
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
      <div className="glow-orb xl pop-scale">{RESULT_ICON[type] || RESULT_ICON.timeout}</div>
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

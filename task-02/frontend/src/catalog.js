export const TAX_RATE = 0.08;

/** Clear product photos matching the NovaPOS reference look */
const IMAGES = {
  "Wireless Mouse":
    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
  "Mechanical Keyboard":
    "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=800&q=80",
  "USB-C Cable":
    "https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=800&q=80",
  "Laptop Stand":
    "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=800&q=80",
  "Bluetooth Headphones":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
  Webcam:
    "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=800&q=80",
  "Gaming Chair":
    "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
  'Monitor 24"':
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
};

const FALLBACK =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80";

export const FILTERS = ["All", "Electronics", "Accessories", "Home", "Other"];

export function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function productImage(name) {
  return IMAGES[name] || FALLBACK;
}

export function stockMeta(stock) {
  if (stock <= 0) return { key: "out", label: "Out of Stock", tone: "red" };
  if (stock <= 5) return { key: "low", label: `Low Stock · ${stock}`, tone: "orange" };
  return { key: "in", label: `In Stock · ${stock}`, tone: "green" };
}

export function statusTone(status) {
  switch (status) {
    case "paid":
      return "green";
    case "reserved":
      return "blue";
    case "pending":
      return "orange";
    case "expired":
      return "purple";
    case "failed":
    case "cancelled":
      return "red";
    default:
      return "blue";
  }
}

export function remainingMs(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function withTax(subtotal) {
  const tax = Number(subtotal || 0) * TAX_RATE;
  return { tax, total: Number(subtotal || 0) + tax };
}

export function formatWhen(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

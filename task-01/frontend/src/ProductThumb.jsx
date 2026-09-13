import { useEffect, useState } from "react";
import { productImage } from "./catalog.js";

const FALLBACK =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80";

export function ProductThumb({ name, size = "lg", qty }) {
  const [src, setSrc] = useState(() => productImage(name));

  useEffect(() => {
    setSrc(productImage(name));
  }, [name]);

  return (
    <div className={`product-thumb ${size}`}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => {
          if (src !== FALLBACK) setSrc(FALLBACK);
        }}
      />
      {qty != null && <span className="qty-chip">x{qty}</span>}
    </div>
  );
}

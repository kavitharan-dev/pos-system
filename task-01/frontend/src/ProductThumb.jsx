import { productImage } from "./catalog.js";

export function ProductThumb({ name, size = "lg", qty }) {
  return (
    <div className={`product-thumb ${size}`}>
      <img src={productImage(name)} alt={name} loading="lazy" />
      {qty != null && <span className="qty-chip">x{qty}</span>}
    </div>
  );
}

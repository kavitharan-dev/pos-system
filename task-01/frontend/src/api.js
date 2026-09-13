const API = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Request failed");
    error.code = data.error;
    error.details = data.details;
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  meta: () => request("/api/meta"),
  products: {
    list: () => request("/api/products"),
    create: (body) => request("/api/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  },
  inventory: () => request("/api/inventory"),
  carts: {
    create: () => request("/api/carts", { method: "POST" }),
    get: (id) => request(`/api/carts/${id}`),
    addItem: (id, productId, quantity = 1) =>
      request(`/api/carts/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ productId, quantity }),
      }),
    setQty: (id, productId, quantity) =>
      request(`/api/carts/${id}/items/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      }),
    removeItem: (id, productId) =>
      request(`/api/carts/${id}/items/${productId}`, { method: "DELETE" }),
    clear: (id) => request(`/api/carts/${id}/items`, { method: "DELETE" }),
  },
  checkout: (cartId) =>
    request("/api/checkout", { method: "POST", body: JSON.stringify({ cartId }) }),
  orders: {
    list: () => request("/api/orders"),
    get: (id) => request(`/api/orders/${id}`),
    pay: (id, outcome) =>
      request(`/api/orders/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      }),
    cancel: (id) => request(`/api/orders/${id}/cancel`, { method: "POST" }),
  },
};

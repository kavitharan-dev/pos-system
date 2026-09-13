import { Router } from "express";
import { asyncHandler } from "../errors.js";
import {
  addCartItem,
  clearCart,
  createCart,
  getCart,
  removeCartItem,
  setCartItemQuantity,
} from "../services/carts.js";

export const cartsRouter = Router();

cartsRouter.post(
  "/",
  asyncHandler(async (_req, res) => {
    const cart = await createCart();
    res.status(201).json({ cart });
  })
);

cartsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ cart: await getCart(req.params.id) });
  })
);

cartsRouter.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body || {};
    const cart = await addCartItem(req.params.id, productId, quantity ?? 1);
    res.json({ cart });
  })
);

cartsRouter.patch(
  "/:id/items/:productId",
  asyncHandler(async (req, res) => {
    const cart = await setCartItemQuantity(
      req.params.id,
      req.params.productId,
      req.body?.quantity
    );
    res.json({ cart });
  })
);

cartsRouter.delete(
  "/:id/items/:productId",
  asyncHandler(async (req, res) => {
    const cart = await removeCartItem(req.params.id, req.params.productId);
    res.json({ cart });
  })
);

cartsRouter.delete(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const cart = await clearCart(req.params.id);
    res.json({ cart });
  })
);

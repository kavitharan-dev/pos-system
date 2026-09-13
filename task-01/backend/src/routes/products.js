import { Router } from "express";
import { asyncHandler } from "../errors.js";
import {
  createProduct,
  deleteProduct,
  getInventory,
  getProduct,
  listProducts,
  updateProduct,
} from "../services/products.js";

export const productsRouter = Router();

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ products: await listProducts() });
  })
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ product: await getProduct(req.params.id) });
  })
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body || {});
    res.status(201).json({ product });
  })
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await updateProduct(req.params.id, req.body || {});
    res.json({ product });
  })
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteProduct(req.params.id);
    res.status(204).end();
  })
);

export const inventoryRouter = Router();

inventoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ inventory: await getInventory() });
  })
);

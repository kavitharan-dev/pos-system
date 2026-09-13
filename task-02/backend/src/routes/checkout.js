import { Router } from "express";
import { asyncHandler } from "../errors.js";
import { checkoutCart } from "../services/checkout.js";
import { getOrderById, listOrders } from "../services/orders.js";
import { cancelOrder, payOrder } from "../services/payments.js";
import { ALLOWED_TRANSITIONS } from "../services/status.js";
import { config } from "../config.js";

export const checkoutRouter = Router();

checkoutRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const order = await checkoutCart(req.body?.cartId, {
      customerName: req.body?.customerName,
      customerEmail: req.body?.customerEmail,
    });
    res.status(201).json({ order });
  })
);

export const ordersRouter = Router();

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ orders: await listOrders({ email: req.query.email }) });
  })
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ order: await getOrderById(req.params.id) });
  })
);

ordersRouter.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const outcome = req.body?.outcome;
    const order = await payOrder(req.params.id, outcome);
    res.json({ order });
  })
);

ordersRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const order = await cancelOrder(req.params.id);
    res.json({ order });
  })
);

export const metaRouter = Router();

metaRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      reservationMinutes: config.reservationMinutes,
      paymentTimeoutMs: config.paymentTimeoutMs,
      allowedTransitions: ALLOWED_TRANSITIONS,
      paymentOutcomes: ["success", "failure", "timeout"],
    });
  })
);

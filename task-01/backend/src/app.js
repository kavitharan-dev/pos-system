import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config, frontendDist } from "./config.js";
import { errorHandler } from "./errors.js";
import { productsRouter, inventoryRouter } from "./routes/products.js";
import { cartsRouter } from "./routes/carts.js";
import { checkoutRouter, ordersRouter, metaRouter } from "./routes/checkout.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "task-01-pos" });
  });

  app.use("/api/meta", metaRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/carts", cartsRouter);
  app.use("/api/checkout", checkoutRouter);
  app.use("/api/orders", ordersRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "NOT_FOUND", message: "Unknown API route" });
  });

  const indexHtml = path.join(frontendDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}

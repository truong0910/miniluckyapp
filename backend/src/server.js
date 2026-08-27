import express from "express";
import cors from "cors";
import { config } from "./config.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        config.corsOrigins.length === 0 ||
        config.corsOrigins.includes("*") ||
        (config.appEnv === "development" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ||
        config.corsOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "lucky-wheels-backend", timestamp: new Date().toISOString() }));
app.use("/api/v1", publicRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((error, _req, res, _next) => {
  const status = Number(error.status || 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Backend gặp lỗi. Vui lòng thử lại sau." : error.message });
});

app.listen(config.port, () => {
  console.log(`Lucky Wheels backend listening on http://localhost:${config.port}`);
});

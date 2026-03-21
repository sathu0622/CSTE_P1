require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const swaggerSpec = require("./config/swagger");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const PORT = process.env.PORT || 4004;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 200) }));

app.get("/health", (req, res) => res.json({ status: "ok", service: "payment-service" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/payments", paymentRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Payment service running on port ${PORT}`)))
  .catch((error) => {
    console.error("Payment service startup failed", error);
    process.exit(1);
  });

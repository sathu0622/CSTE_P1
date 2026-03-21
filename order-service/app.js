require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const swaggerSpec = require("./config/swagger");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const PORT = process.env.PORT || 4003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 200) }));

app.get("/health", (req, res) => res.json({ status: "ok", service: "order-service" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Order service running on port ${PORT}`)))
  .catch((error) => {
    console.error("Order service startup failed", error);
    process.exit(1);
  });

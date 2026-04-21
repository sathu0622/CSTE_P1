require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const swaggerSpec = require("./config/swagger");
const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = process.env.PORT || 4001;

// Required behind reverse proxies (e.g., Azure Container Apps) for accurate client IP in rate-limiter.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ status: "ok", service: "user-service" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/users", userRoutes);

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`User service running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("User service startup failed", error);
    process.exit(1);
  });

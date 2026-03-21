const jwt = require("jsonwebtoken");
const axios = require("axios");

const userServiceBaseUrl = process.env.USER_SERVICE_URL || "http://user-service:4001";

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) return res.status(401).json({ message: "Unauthorized: token missing" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: invalid token context" });
  }

  // Cross-service authorization: validate role against user-service source-of-truth.
  axios
    .get(`${userServiceBaseUrl}/api/users/internal/${req.user.id}`, {
      headers: {
        "x-service-secret": process.env.SERVICE_SHARED_SECRET || ""
      },
      timeout: Number(process.env.USER_SERVICE_TIMEOUT_MS || 5000)
    })
    .then((response) => {
      const liveRole = response.data?.role;
      if (!roles.includes(liveRole)) {
        return res.status(403).json({ message: "Forbidden: admin access required" });
      }
      req.user.role = liveRole;
      return next();
    })
    .catch(() => {
      return res.status(503).json({ message: "Authorization service unavailable" });
    });
};

module.exports = { protect, authorize };

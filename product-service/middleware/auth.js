const jwt = require("jsonwebtoken");
const axios = require("axios");

const userServiceBaseUrl = process.env.USER_SERVICE_URL || "http://user-service:4001";

/**
 * Verifies JWT (issued by user-service). Does not trust embedded role — use authorize() for that.
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) return res.status(401).json({ message: "Unauthorized: token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const id = decoded.id ?? decoded.sub;
    if (!id) {
      return res.status(401).json({ message: "Unauthorized: token missing subject" });
    }
    req.user = {
      id: String(id),
      email: decoded.email
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

/**
 * Admin / role checks: user-service is the source of truth for roles (GET /api/users/internal/:id + x-service-secret).
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized: invalid token context" });
    }

    axios
      .get(`${userServiceBaseUrl}/api/users/internal/${req.user.id}`, {
        headers: {
          "x-service-secret": process.env.SERVICE_SHARED_SECRET || ""
        },
        timeout: Number(process.env.USER_SERVICE_TIMEOUT_MS || 5000)
      })
      .then((response) => {
        const liveRole = response.data?.role;
        if (!liveRole || !roles.includes(liveRole)) {
          return res.status(403).json({
            message: "Forbidden: role not permitted for this action",
            requiredRoles: roles
          });
        }
        req.user.role = liveRole;
        return next();
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 401) {
          return res.status(503).json({ message: "User service rejected service credentials" });
        }
        if (status === 404) {
          return res.status(403).json({ message: "Forbidden: user no longer exists" });
        }
        return res.status(503).json({ message: "Authorization service unavailable" });
      });
  };

module.exports = { protect, authorize };

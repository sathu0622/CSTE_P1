const express = require("express");
const { body, param, query } = require("express-validator");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createOrder,
  getOrdersByUser,
  getOrderById,
  markOrderPaid,
  updateOrderStatus,
  cancelOrder
} = require("../controllers/orderController");

const router = express.Router();

/**
 * @swagger
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new order
 */
router.post(
  "/",
  auth,
  [
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.productId").isString().notEmpty(),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("idempotencyKey").optional().isString()
  ],
  validate,
  createOrder
);

const getOrdersQueryValidation = [
  query("status").optional().isIn(["pending", "paid", "processing", "shipped", "delivered", "cancelled", "failed"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("includeMeta").optional().isIn(["true", "false"])
];

router.get("/internal/:id", [param("id").isMongoId()], validate, getOrderById);
router.patch("/internal/:id/pay", [param("id").isMongoId()], validate, markOrderPaid);
router.patch(
  "/:id/status",
  auth,
  [
    param("id").isMongoId(),
    body("status").isIn(["paid", "processing", "shipped", "delivered", "cancelled", "failed"]),
    body("note").optional().isString()
  ],
  validate,
  (req, res, next) => (req.user.role === "admin" ? next() : res.status(403).json({ message: "Admin only" })),
  updateOrderStatus
);
router.patch(
  "/:id/cancel",
  auth,
  [param("id").isMongoId(), body("note").optional().isString()],
  validate,
  cancelOrder
);
router.get("/:userId", auth, [param("userId").notEmpty(), ...getOrdersQueryValidation], validate, getOrdersByUser);

module.exports = router;

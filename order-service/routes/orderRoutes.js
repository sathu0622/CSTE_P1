const express = require("express");
const { body, param } = require("express-validator");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createOrder, getOrdersByUser, getOrderById, markOrderPaid } = require("../controllers/orderController");

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
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1")
  ],
  validate,
  createOrder
);

router.get("/internal/:id", [param("id").isMongoId()], validate, getOrderById);
router.patch("/internal/:id/pay", [param("id").isMongoId()], validate, markOrderPaid);
router.get("/:userId", auth, [param("userId").notEmpty()], validate, getOrdersByUser);

module.exports = router;

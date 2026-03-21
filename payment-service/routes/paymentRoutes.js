const express = require("express");
const { body, param } = require("express-validator");
const { processPayment, handleWebhook, refundPayment, retryPayment } = require("../controllers/paymentController");
const validate = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   post:
 *     tags: [Payments]
 *     summary: Process a mock payment
 */
router.post(
  "/",
  [body("orderId").isMongoId().withMessage("A valid orderId is required"), body("idempotencyKey").optional().isString()],
  validate,
  processPayment
);
router.post(
  "/webhook",
  [body("transactionId").isString().notEmpty(), body("status").isIn(["success", "failed"])],
  validate,
  handleWebhook
);
router.post(
  "/:paymentId/refund",
  [param("paymentId").isMongoId(), body("amount").optional().isFloat({ min: 0.01 })],
  validate,
  refundPayment
);
router.post("/:paymentId/retry", [param("paymentId").isMongoId()], validate, retryPayment);

module.exports = router;

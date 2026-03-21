const express = require("express");
const { body } = require("express-validator");
const { processPayment } = require("../controllers/paymentController");
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
  [body("orderId").isMongoId().withMessage("A valid orderId is required")],
  validate,
  processPayment
);

module.exports = router;

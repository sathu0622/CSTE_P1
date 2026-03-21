const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "success", "failed", "refunded", "partial_refunded"], required: true },
    transactionId: { type: String, required: true },
    message: { type: String, required: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    retries: { type: Number, min: 0, default: 0 },
    gatewayReference: { type: String, default: "" },
    idempotencyKey: { type: String, default: null, unique: true, sparse: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);

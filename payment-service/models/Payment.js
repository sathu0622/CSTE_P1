const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    status: { type: String, enum: ["success", "failed"], required: true },
    transactionId: { type: String, required: true },
    message: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);

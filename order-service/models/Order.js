const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "failed"],
      default: "pending",
      index: true
    },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
          changedBy: { type: String, default: "system" },
          note: { type: String, default: "" }
        }
      ],
      default: []
    },
    idempotencyKey: { type: String },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "partial_refunded", "refunded"],
      default: "none"
    }
  },
  { timestamps: true }
);

// Uniqueness only when idempotencyKey is set (non-empty). Multiple orders per user without a key are allowed.
// If upgrading from the old index, run: db.orders.dropIndex("userId_1_idempotencyKey_1")
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string", $ne: "" }
    }
  }
);

module.exports = mongoose.model("Order", orderSchema);

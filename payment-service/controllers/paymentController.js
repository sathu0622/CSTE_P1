const axios = require("axios");
const Payment = require("../models/Payment");

const orderServiceBaseUrl = process.env.ORDER_SERVICE_URL || "http://order-service:4003";
const MAX_RETRIES = Number(process.env.PAYMENT_RETRY_LIMIT || 3);

const runMockGateway = async () => {
  const force = process.env.MOCK_PAYMENT_FORCE_STATUS;
  if (force === "success") return { success: true, ref: `GW-${Date.now()}` };
  if (force === "failed") return { success: false, ref: `GW-${Date.now()}` };
  return { success: Math.random() > 0.2, ref: `GW-${Date.now()}` };
};

const processPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const idempotencyKey = req.headers["x-idempotency-key"] || req.body.idempotencyKey || null;

    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ idempotencyKey });
      if (existingPayment) {
        return res.status(200).json(existingPayment);
      }
    }

    const orderResponse = await axios.get(`${orderServiceBaseUrl}/api/orders/internal/${orderId}`);
    const order = orderResponse.data;

    if (order.status === "paid") {
      return res.status(400).json({ message: "Order already paid" });
    }

    const payment = await Payment.create({
      orderId,
      amount: order.totalAmount || 0,
      status: "pending",
      transactionId: `TXN-${Date.now()}`,
      message: "Payment initiated",
      idempotencyKey
    });

    let gatewayResult = { success: false, ref: "" };
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      gatewayResult = await runMockGateway();
      payment.retries = attempt;
      if (gatewayResult.success) break;
    }

    payment.gatewayReference = gatewayResult.ref;
    payment.status = gatewayResult.success ? "success" : "failed";
    payment.message = gatewayResult.success ? "Payment successful" : "Payment failed after retries";
    await payment.save();

    if (payment.status === "success") {
      await axios.patch(`${orderServiceBaseUrl}/api/orders/internal/${orderId}/pay`);
    }

    return res.status(200).json(payment);
  } catch (error) {
    if (error?.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(503).json({ message: "Payment dependency unavailable" });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const { transactionId, status } = req.body;
    const payment = await Payment.findOne({ transactionId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.status = status === "success" ? "success" : "failed";
    payment.message = `Webhook confirmed status: ${payment.status}`;
    await payment.save();

    if (payment.status === "success") {
      await axios.patch(`${orderServiceBaseUrl}/api/orders/internal/${payment.orderId}/pay`);
    }
    return res.json({ message: "Webhook processed", payment });
  } catch (error) {
    if (error?.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(503).json({ message: "Payment dependency unavailable" });
  }
};

const refundPayment = async (req, res) => {
  const { paymentId } = req.params;
  const { amount } = req.body;
  const payment = await Payment.findById(paymentId);
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  if (payment.status !== "success" && payment.status !== "partial_refunded") {
    return res.status(400).json({ message: "Only successful payments can be refunded" });
  }

  const refundAmount = amount ? Number(amount) : payment.amount - payment.refundedAmount;
  if (refundAmount <= 0 || refundAmount + payment.refundedAmount > payment.amount) {
    return res.status(400).json({ message: "Invalid refund amount" });
  }

  payment.refundedAmount += refundAmount;
  payment.status = payment.refundedAmount < payment.amount ? "partial_refunded" : "refunded";
  payment.message = payment.status === "refunded" ? "Payment fully refunded" : "Payment partially refunded";
  await payment.save();

  return res.json(payment);
};

const retryPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status !== "failed") return res.status(400).json({ message: "Only failed payments can be retried" });
    if (payment.retries >= MAX_RETRIES) return res.status(400).json({ message: "Retry limit reached" });

    const gatewayResult = await runMockGateway();
    payment.retries += 1;
    payment.gatewayReference = gatewayResult.ref;
    payment.status = gatewayResult.success ? "success" : "failed";
    payment.message = gatewayResult.success ? "Payment successful after retry" : "Payment retry failed";
    await payment.save();

    if (payment.status === "success") {
      await axios.patch(`${orderServiceBaseUrl}/api/orders/internal/${payment.orderId}/pay`);
    }

    return res.json(payment);
  } catch (error) {
    if (error?.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(503).json({ message: "Payment dependency unavailable" });
  }
};

module.exports = { processPayment, handleWebhook, refundPayment, retryPayment };

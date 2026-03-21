const axios = require("axios");
const Payment = require("../models/Payment");

const orderServiceBaseUrl = process.env.ORDER_SERVICE_URL || "http://order-service:4003";

const processPayment = async (req, res) => {
  const { orderId } = req.body;

  const orderResponse = await axios.get(`${orderServiceBaseUrl}/api/orders/internal/${orderId}`);
  const order = orderResponse.data;

  if (order.status === "paid") {
    return res.status(400).json({ message: "Order already paid" });
  }

  const success = Math.random() > 0.2;
  const payment = await Payment.create({
    orderId,
    status: success ? "success" : "failed",
    transactionId: `TXN-${Date.now()}`,
    message: success ? "Payment successful" : "Payment failed"
  });

  if (success) {
    await axios.patch(`${orderServiceBaseUrl}/api/orders/internal/${orderId}/pay`);
  }

  return res.status(200).json(payment);
};

module.exports = { processPayment };

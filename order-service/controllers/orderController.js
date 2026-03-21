const axios = require("axios");
const Order = require("../models/Order");

const productServiceBaseUrl = process.env.PRODUCT_SERVICE_URL || "http://product-service:4002";
const teammateServiceBaseUrl = process.env.TEAMMATE_SERVICE_URL;
const teammateIntegrationPath = process.env.TEAMMATE_INTEGRATION_PATH || "/api/integrations/order-created";

const notifyTeammateService = async (orderPayload) => {
  if (!teammateServiceBaseUrl) {
    return {
      teammateServiceNotified: false,
      teammateServiceResponse: "TEAMMATE_SERVICE_URL not configured"
    };
  }

  try {
    const response = await axios.post(
      `${teammateServiceBaseUrl}${teammateIntegrationPath}`,
      orderPayload,
      {
        timeout: Number(process.env.TEAMMATE_SERVICE_TIMEOUT_MS || 5000),
        headers: {
          "Content-Type": "application/json",
          "x-integration-source": "order-service"
        }
      }
    );

    return {
      teammateServiceNotified: true,
      teammateServiceResponse: `success:${response.status}`
    };
  } catch (error) {
    const status = error.response?.status || "no_response";
    return {
      teammateServiceNotified: false,
      teammateServiceResponse: `failed:${status}`
    };
  }
};

const createOrder = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.id;

  let totalAmount = 0;
  const validatedItems = [];

  for (const item of items) {
    const response = await axios.get(`${productServiceBaseUrl}/api/products/${item.productId}`);
    const product = response.data;

    if (product.stock < item.quantity) {
      return res.status(400).json({ message: `Insufficient stock for product ${item.productId}` });
    }

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      price: product.price
    });
    totalAmount += product.price * item.quantity;
  }

  const order = await Order.create({
    userId,
    items: validatedItems,
    totalAmount,
    status: "pending",
    integration: {
      teammateServiceNotified: false,
      teammateServiceResponse: "not_attempted"
    }
  });

  const integrationResult = await notifyTeammateService({
    orderId: order._id.toString(),
    userId: order.userId,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    status: order.status,
    createdAt: order.createdAt
  });

  order.integration = integrationResult;
  await order.save();

  return res.status(201).json({
    ...order.toObject(),
    integrationDemo: integrationResult
  });
};

const getOrdersByUser = async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== userId && req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: cannot access other users' orders" });
  }

  const orders = await Order.find({ userId }).sort({ createdAt: -1 });
  return res.json(orders);
};

const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
};

const markOrderPaid = async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { status: "paid" }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
};

module.exports = { createOrder, getOrdersByUser, getOrderById, markOrderPaid };

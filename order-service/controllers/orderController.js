const axios = require("axios");
const Order = require("../models/Order");

const productServiceBaseUrl = process.env.PRODUCT_SERVICE_URL || "http://product-service:4002";
const allowedStatusTransitions = {
  pending: ["paid", "cancelled", "failed"],
  paid: ["processing", "failed"],
  processing: ["shipped", "failed"],
  shipped: ["delivered", "failed"],
  delivered: [],
  cancelled: [],
  failed: []
};

const createOrder = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.id;
  const idempotencyKey = req.headers["x-idempotency-key"] || req.body.idempotencyKey || null;

  if (idempotencyKey) {
    const existing = await Order.findOne({ userId, idempotencyKey });
    if (existing) {
      return res.status(200).json(existing);
    }
  }

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
    idempotencyKey,
    statusHistory: [{ status: "pending", changedBy: userId, note: "Order created" }]
  });

  // Reserve/reduce stock in product service after order creation.
  try {
    await axios.post(
      `${productServiceBaseUrl}/api/products/internal/decrement-stock`,
      { items: validatedItems.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
      { headers: { "x-service-secret": process.env.SERVICE_SHARED_SECRET || "" } }
    );
  } catch (error) {
    order.status = "failed";
    order.statusHistory.push({
      status: "failed",
      changedBy: "system",
      note: "Stock reservation failed"
    });
    await order.save();
    return res.status(400).json({
      message: error?.response?.data?.message || "Unable to reserve stock"
    });
  }

  return res.status(201).json(order);
};

const getOrdersByUser = async (req, res) => {
  const { userId } = req.params;
  const { status, page = 1, limit = 20, includeMeta = "false" } = req.query;

  if (req.user.id !== userId && req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: cannot access other users' orders" });
  }

  const filters = { userId };
  if (status) filters.status = status;

  const currentPage = Number(page);
  const currentLimit = Number(limit);
  const skip = (currentPage - 1) * currentLimit;

  const [orders, totalItems] = await Promise.all([
    Order.find(filters).sort({ createdAt: -1 }).skip(skip).limit(currentLimit),
    Order.countDocuments(filters)
  ]);

  if (includeMeta !== "true") {
    return res.json(orders);
  }

  return res.json({
    items: orders,
    pagination: {
      page: currentPage,
      limit: currentLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / currentLimit)
    }
  });
};

const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
};

const markOrderPaid = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.status = "paid";
  order.statusHistory.push({
    status: "paid",
    changedBy: "payment-service",
    note: "Payment confirmed"
  });
  await order.save();
  return res.json(order);
};

const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const validNextStates = allowedStatusTransitions[order.status] || [];
  if (!validNextStates.includes(status)) {
    return res.status(400).json({
      message: `Invalid transition from ${order.status} to ${status}`
    });
  }

  order.status = status;
  order.statusHistory.push({
    status,
    changedBy: req.user.id,
    note: note || "Status updated by admin"
  });
  await order.save();
  return res.json(order);
};

const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (req.user.id !== order.userId && req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: cannot cancel this order" });
  }

  if (!["pending", "paid"].includes(order.status)) {
    return res.status(400).json({ message: `Order in ${order.status} cannot be cancelled` });
  }

  if (order.status === "paid") {
    order.refundStatus = "requested";
  }
  order.status = "cancelled";
  order.statusHistory.push({
    status: "cancelled",
    changedBy: req.user.id,
    note: req.body.note || "Order cancelled by user/admin"
  });
  await order.save();
  return res.json(order);
};

module.exports = { createOrder, getOrdersByUser, getOrderById, markOrderPaid, updateOrderStatus, cancelOrder };

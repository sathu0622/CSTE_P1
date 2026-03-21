const axios = require("axios");
const Order = require("../models/Order");

const productServiceBaseUrl = process.env.PRODUCT_SERVICE_URL || "http://product-service:4002";

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
    status: "pending"
  });

  return res.status(201).json(order);
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

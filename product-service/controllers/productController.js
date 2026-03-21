const Product = require("../models/Product");

const getProducts = async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  return res.json(products);
};

const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json(product);
};

const createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  return res.status(201).json(product);
};

const updateProduct = async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: "Product not found" });
  return res.json(updated);
};

const deleteProduct = async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Product not found" });
  return res.json({ message: "Product deleted" });
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };

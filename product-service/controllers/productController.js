const Product = require("../models/Product");

const getProducts = async (req, res) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    sort = "latest",
    page = 1,
    limit = 20,
    includeMeta = "false"
  } = req.query;

  const filters = {};
  if (search) {
    filters.$text = { $search: search };
  }
  if (category) {
    filters.category = category.toLowerCase();
  }

  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = Number(minPrice);
    if (maxPrice) filters.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    latest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 }
  };

  const currentPage = Number(page);
  const currentLimit = Number(limit);
  const skip = (currentPage - 1) * currentLimit;

  const [products, totalItems] = await Promise.all([
    Product.find(filters).sort(sortMap[sort] || sortMap.latest).skip(skip).limit(currentLimit),
    Product.countDocuments(filters)
  ]);

  // Backward-compatible default response for existing clients.
  if (includeMeta !== "true") {
    return res.json(products);
  }

  return res.json({
    items: products,
    pagination: {
      page: currentPage,
      limit: currentLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / currentLimit)
    }
  });
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

const decrementStockInternal = async (req, res) => {
  const { items } = req.body;
  const decremented = [];

  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      // Compensate already-decremented items in this request.
      for (const done of decremented) {
        await Product.findByIdAndUpdate(done.productId, { $inc: { stock: done.quantity } });
      }
      return res.status(400).json({ message: `Insufficient stock for product ${item.productId}` });
    }

    decremented.push({ productId: item.productId, quantity: item.quantity });
  }

  return res.json({ message: "Stock decremented", items: decremented });
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, decrementStockInternal };

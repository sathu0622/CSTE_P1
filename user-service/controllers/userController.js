const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const orderServiceBaseUrl = process.env.ORDER_SERVICE_URL || "http://order-service:4003";

const createToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || "user"
  });

  return res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken(user);
  return res.status(200).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};

const profile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let orderSummary = { integrated: false, count: 0 };
  try {
    const response = await axios.get(`${orderServiceBaseUrl}/api/orders/${req.user.id}`, {
      headers: {
        Authorization: req.headers.authorization || ""
      },
      timeout: Number(process.env.ORDER_SERVICE_TIMEOUT_MS || 5000)
    });

    orderSummary = {
      integrated: true,
      count: Array.isArray(response.data) ? response.data.length : 0
    };
  } catch {
    orderSummary = { integrated: false, count: 0 };
  }

  return res.json({
    ...user.toObject(),
    orderSummary
  });
};

const getUserByIdForInternal = async (req, res) => {
  const user = await User.findById(req.params.id).select("_id name email role");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  });
};

module.exports = { register, login, profile, getUserByIdForInternal };

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const nodeCrypto = require("crypto");
const User = require("../models/User");
const orderServiceBaseUrl = process.env.ORDER_SERVICE_URL || "http://order-service:4003";

const createToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

const resolveUserId = (req) =>
  req.user?.id ||
  req.query?.userId ||
  req.body?.userId ||
  req.headers["x-user-id"];

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const verificationToken = nodeCrypto.randomBytes(20).toString("hex");
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || "user",
    emailVerificationToken: verificationToken,
    activityLogs: [{ action: "register", meta: "New account created" }]
  });

  return res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    verificationToken
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

  if (process.env.EMAIL_VERIFICATION_REQUIRED === "true" && !user.emailVerified) {
    return res.status(403).json({ message: "Please verify your email first" });
  }

  user.activityLogs.push({ action: "login", meta: "Login successful" });
  await user.save();

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
  const resolvedUserId = resolveUserId(req);
  if (!resolvedUserId) {
    return res.status(400).json({ message: "userId is required when authorization is not provided" });
  }

  const user = await User.findById(resolvedUserId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let orderSummary = { integrated: false, count: 0 };
  try {
    const response = await axios.get(`${orderServiceBaseUrl}/api/orders/${resolvedUserId}`, {
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

const updateProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (req.body.name) user.name = req.body.name;
  user.profile = {
    ...user.profile,
    ...(req.body.profile || {})
  };
  user.activityLogs.push({ action: "profile_update", meta: "Profile updated" });
  await user.save();

  return res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile: user.profile
  });
};

const requestEmailVerification = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.emailVerified) return res.json({ message: "Email already verified" });

  const token = nodeCrypto.randomBytes(20).toString("hex");
  user.emailVerificationToken = token;
  user.activityLogs.push({ action: "verification_requested", meta: "Email verification requested" });
  await user.save();

  return res.json({ message: "Verification token generated", token });
};

const verifyEmail = async (req, res) => {
  const { email, token } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.emailVerificationToken !== token) {
    return res.status(400).json({ message: "Invalid verification token" });
  }

  user.emailVerified = true;
  user.emailVerificationToken = null;
  user.activityLogs.push({ action: "email_verified", meta: "Email verified successfully" });
  await user.save();
  return res.json({ message: "Email verified" });
};

const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const token = nodeCrypto.randomBytes(20).toString("hex");
  user.passwordResetToken = token;
  user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
  user.activityLogs.push({ action: "password_reset_requested", meta: "Password reset requested" });
  await user.save();

  return res.json({ message: "Password reset token generated", token });
};

const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.passwordResetToken !== token || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
  user.activityLogs.push({ action: "password_reset_completed", meta: "Password reset successful" });
  await user.save();

  return res.json({ message: "Password reset successful" });
};

const getActivity = async (req, res) => {
  const resolvedUserId = resolveUserId(req);
  if (!resolvedUserId) {
    return res.status(400).json({ message: "userId is required when authorization is not provided" });
  }

  const user = await User.findById(resolvedUserId).select("activityLogs");
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(user.activityLogs.slice(-50).reverse());
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

module.exports = {
  register,
  login,
  profile,
  updateProfile,
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  getActivity,
  getUserByIdForInternal
};

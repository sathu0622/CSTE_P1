const express = require("express");
const { body } = require("express-validator");
const { register, login, profile, getUserByIdForInternal } = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const serviceAuth = require("../middleware/serviceAuth");
const validate = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     tags: [Users]
 *     summary: Register a new user
 */
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").optional().isIn(["admin", "user"]).withMessage("Role must be admin or user")
  ],
  validate,
  register
);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     tags: [Users]
 *     summary: Login and receive JWT token
 */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  validate,
  login
);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     summary: Get logged in user's profile
 */
router.get("/profile", protect, profile);
router.get("/internal/:id", serviceAuth, getUserByIdForInternal);

module.exports = router;

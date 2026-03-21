const express = require("express");
const { body, param } = require("express-validator");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

const productValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer")
];

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products
 */
router.get("/", getProducts);
router.get("/:id", [param("id").isMongoId()], validate, getProductById);
router.post("/", protect, authorize("admin"), productValidation, validate, createProduct);
router.put("/:id", protect, authorize("admin"), [param("id").isMongoId(), ...productValidation], validate, updateProduct);
router.delete("/:id", protect, authorize("admin"), [param("id").isMongoId()], validate, deleteProduct);

module.exports = router;

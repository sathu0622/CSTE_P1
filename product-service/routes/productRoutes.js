const express = require("express");
const { body, param, query } = require("express-validator");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  decrementStockInternal
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");
const serviceAuth = require("../middleware/serviceAuth");
const validate = require("../middleware/validate");

const router = express.Router();

const productValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("category").optional().trim().notEmpty().withMessage("Category cannot be empty"),
  body("subcategory").optional().trim().notEmpty().withMessage("Subcategory cannot be empty"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*").optional().isString().trim().notEmpty().withMessage("Tag must be a non-empty string"),
  body("rating").optional().isFloat({ min: 0, max: 5 }).withMessage("Rating must be between 0 and 5"),
  body("images").optional().isArray().withMessage("Images must be an array"),
  body("images.*").optional().isURL().withMessage("Each image must be a valid URL"),
  body("variants").optional().isArray().withMessage("Variants must be an array"),
  body("variants.*.stock").optional().isInt({ min: 0 }).withMessage("Variant stock must be non-negative")
];

const productQueryValidation = [
  query("search").optional().isString(),
  query("category").optional().isString(),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("sort").optional().isIn(["latest", "price_asc", "price_desc", "name_asc", "name_desc"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("includeMeta").optional().isIn(["true", "false"])
];

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products
 */
router.get("/", productQueryValidation, validate, getProducts);
router.post(
  "/internal/decrement-stock",
  serviceAuth,
  [body("items").isArray({ min: 1 }), body("items.*.productId").isMongoId(), body("items.*.quantity").isInt({ min: 1 })],
  validate,
  decrementStockInternal
);
router.get("/:id", [param("id").isMongoId()], validate, getProductById);
router.post("/", protect, authorize("admin"), productValidation, validate, createProduct);
router.put("/:id", protect, authorize("admin"), [param("id").isMongoId(), ...productValidation], validate, updateProduct);
router.delete("/:id", protect, authorize("admin"), [param("id").isMongoId()], validate, deleteProduct);

module.exports = router;

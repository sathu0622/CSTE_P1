const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, lowercase: true, default: "general", index: true },
    subcategory: { type: String, trim: true, lowercase: true, default: "" },
    tags: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    images: { type: [String], default: [] },
    variants: {
      type: [
        {
          size: { type: String, default: "" },
          color: { type: String, default: "" },
          sku: { type: String, default: "" },
          stock: { type: Number, min: 0, default: 0 }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", category: "text", tags: "text" });

module.exports = mongoose.model("Product", productSchema);

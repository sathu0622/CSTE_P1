const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined");
  await mongoose.connect(uri);
  console.log("Product service MongoDB connected");
};

module.exports = connectDB;

const swaggerJSDoc = require("swagger-jsdoc");

module.exports = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Payment Service API", version: "1.0.0" },
    servers: [{ url: "/" }]
  },
  apis: ["./routes/*.js"]
});

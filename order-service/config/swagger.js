const swaggerJSDoc = require("swagger-jsdoc");

module.exports = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Order Service API", version: "1.0.0" },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./routes/*.js"]
});

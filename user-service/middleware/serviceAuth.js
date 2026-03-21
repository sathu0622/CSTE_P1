module.exports = (req, res, next) => {
  const sharedSecret = process.env.SERVICE_SHARED_SECRET;
  const receivedSecret = req.headers["x-service-secret"];

  if (!sharedSecret) {
    return res.status(500).json({ message: "Service shared secret is not configured" });
  }

  if (!receivedSecret || receivedSecret !== sharedSecret) {
    return res.status(401).json({ message: "Unauthorized service request" });
  }

  return next();
};

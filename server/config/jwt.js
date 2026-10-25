const jwt = require("jsonwebtoken");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  return secret;
}

const options = { algorithm: "HS256", issuer: "plantpal-api", audience: "plantpal-client" };

function createAccessToken(user) {
  return jwt.sign({}, getSecret(), {
    ...options,
    subject: String(user.userId),
    expiresIn: "1h",
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: [options.algorithm],
    issuer: options.issuer,
    audience: options.audience,
  });
}

module.exports = { createAccessToken, verifyAccessToken, validateJwtConfig: getSecret };

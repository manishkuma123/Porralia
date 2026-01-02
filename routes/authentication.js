
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../modules/TokenBlacklist');
const User = require('../modules/User'); // ✅ Add this import

const SECRET_KEY = "manishkumartokendata";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Bearer <token>
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // 🔴 Check blacklist
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    // Verify token
    const decoded = jwt.verify(token, SECRET_KEY);

    // ✅ Fetch the full user document from database
    const user = await User.findById(decoded.userId); // or decoded.id, depending on your JWT payload
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;   // ✅ Now this is the full user document
    req.token = token;   
    next();

  } catch (error) {
    console.error("Auth Middleware error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = authMiddleware;

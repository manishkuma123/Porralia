// const jwt = require('jsonwebtoken');

// const SECRET_KEY = "manishkumartokendata";

// const authMiddleware = (req, res, next) => {
//     try {
//         // Get token from header
//         const authHeader = req.headers['authorization'];
//         if (!authHeader) {
//             return res.status(401).json({ message: "No token provided" });
//         }

//         // Bearer <token>
//         const token = authHeader.split(' ')[1];
//         if (!token) {
//             return res.status(401).json({ message: "Invalid token format" });
//         }

//         // Verify token
//         const decoded = jwt.verify(token, SECRET_KEY);

//         // Attach user info to request
//         req.user = decoded; // decoded contains userId
//         next(); // move to next middleware or route handler

//     } catch (error) {
//         console.error("Auth Middleware error:", error);
//         return res.status(401).json({ message: "Unauthorized" });
//     }
// };

// module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../modules/TokenBlacklist');

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

    req.user = decoded;   
    req.token = token;   
    next();

  } catch (error) {
    console.error("Auth Middleware error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = authMiddleware;

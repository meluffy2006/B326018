const jwt = require("jsonwebtoken");

const JWT_SECRET = "whispr_secret_2024";

function auth(req, res, next) {
    try {
        var header = req.headers.authorization;
        if (!header) {
            return res.status(403).json({ message: "No token provided. Please sign in." });
        }
        var token = header.startsWith("Bearer ") ? header.slice(7) : header;
        var decoded = jwt.verify(token, JWT_SECRET);
        req.userId   = decoded.id;
        req.username = decoded.username;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token. Please sign in again." });
    }
}

module.exports = { auth, JWT_SECRET };

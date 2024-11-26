const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY;

const adminVerify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(401).json({ error: "Token is not valid" });

            }
            req.user = user;
            if (user.role !== "superadmin") {
                res.status(400).json({ error: "You don't have access" });
            }
            next();

        })
    } else {
        res.status(400).json({ error: "You are not authenticated" });
    }
}

module.exports = { adminVerify };
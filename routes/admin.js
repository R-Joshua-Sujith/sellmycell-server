const router = require("express").Router();
const bcrypt = require('bcrypt');
const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const secretKey = process.env.JWT_SECRET_KEY


router.post('/register', async (req, res) => {
    const { email, password, role } = req.body;

    try {
        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = new Admin({ email, password: hashedPassword, role });
        await newAdmin.save();

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // You can generate and send a token for authenticatio here
        const payload = {
            email: admin.email,
            role: admin.role
        }


        const token = jwt.sign(payload, secretKey);

        res.status(200).json({
            email: admin.email,
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
const router = require("express").Router();
const AbundantOrderModel = require("../models/AbandonedOrder");
const UserModel = require("../models/User");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY

const verify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(401).json({ error: "Session Expired" });
            }
            req.user = user;
            next();
        })
    } else {
        res.status(400).json({ error: "You are not authenticated" });
    }
}

router.post("/create-order", verify, async (req, res) => {
    if (req.user.phone === req.body.user.phone) {
        try {
            const {
                user, productDetails, platform
            } = req.body;
            const existingUser = await UserModel.findOne({ phone: user.phone })
            if (existingUser.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            existingUser.city = user.city;
            existingUser.pincode = user.pincode;

            await existingUser.save();

            const newOrder = new AbundantOrderModel({
                user,
                productDetails,
                platform
            })
            const savedOrder = await newOrder.save();
            res.status(201).json({ message: 'Order Created Successfully' })

        } catch (error) {
            console.log(error)
            res.status(500).json({ message: 'Internal Server Error' })
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

})

router.get('/get-all-orders', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '', startDate, endDate } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { platform: { $regex: search, $options: 'i' } },
                { 'user.phone': { $regex: search, $options: 'i' } },
                { 'user.city': { $regex: search, $options: 'i' } },
                { 'user.pincode': { $regex: search, $options: 'i' } },
                { 'productDetails.name': { $regex: search, $options: 'i' } },
            ];
        }

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const allOrders = await AbundantOrderModel.find(query)
            .select('user.phone user.pincode user.city productDetails.name productDetails.price createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(pageSize));

        const formattedOrders = allOrders.map(order => {
            return {
                ...order.toObject(),
                createdAt: order.createdAt.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata' // Indian Standard Time
                })
            };
        });


        const totalOrders = await AbundantOrderModel.countDocuments(query);

        res.json({
            totalRows: totalOrders,
            data: formattedOrders,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/single-orders/:id', async (req, res) => {
    const orderId = req.params.id;

    try {
        const order = await AbundantOrderModel.findById(orderId)

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const user = await UserModel.findOne({ phone: order.user.phone }).select()

        res.json({ order, user });

    } catch (error) {
        res.status(500).json({ message: error.message });
        console.log(error)
    }
});


module.exports = router;
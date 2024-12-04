const router = require("express").Router();
const PartnerModel = require("../models/Partner")
const OrderModel = require("../models/Order");
const CounterModel = require("../models/Counter")
const UserModel = require("../models/User");
const AbundantOrderModel = require("../models/AbandonedOrder")
const multer = require('multer');
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const CoinsModel = require('../models/Coins');
const createInvoice = require("./createInvoice")
const RefundModel = require("../models/Refund")
const { getMessaging } = require("firebase-admin/messaging");
dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY

async function sendNotificationsToPartnersAsync(partnerTokens, notification) {
    try {
        await Promise.all(partnerTokens.map(async (token, index) => {
            if (token !== "") {
                try {
                    await getMessaging().send({ token: token, notification: notification });
                } catch (error) {
                    console.error("Error sending notification to partner with token:", token, error);
                }
            }
        }

        ));
    } catch (error) {
        console.error("Error sending notifications to partners:", error);
    }
}

async function sendNotification(token, notification) {
    try {
        await getMessaging().send({ token: token, notification: notification });
        console.log("Notification sent successfully to partner with token:", token);
    } catch (error) {
        console.error("Error sending notification to partner with token:", token, "Error:", error);
    }
}



async function getNextSequenceValue() {
    try {
        const sequenceDocument = await CounterModel.findOneAndUpdate(
            { name: "Counter" },
            { $inc: { sequence_value: 1 } },
            { returnDocument: 'after' }
        );

        if (!sequenceDocument) {
            throw new Error("Counter document not found");
        }

        return sequenceDocument.sequence_value;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to get the next sequence value");
    }
}

// Utility function to generate custom order IDs
async function generateCustomID() {
    try {
        const sequenceValue = await getNextSequenceValue();
        console.log(sequenceValue)
        return `SellMyCell${sequenceValue}`;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to generate custom ID");
    }
}

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


router.post('/create-order', verify, async (req, res) => {
    if (req.user.phone === req.body.user.phone) {
        try {
            const {
                user,
                payment,
                pickUpDetails,
                productDetails,
                promo,
                platform
            } = req.body;
            console.log(req.body);
            const orderID = await generateCustomID();
            const existingUser = await UserModel.findOne({ phone: user.phone })
            if (existingUser.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            existingUser.name = user.name;
            existingUser.addPhone = user.addPhone;
            existingUser.email = user.email;


            const useraddress = user.address;
            const pincodeRegex = /\b\d{6}\b(?=\D*$)/;
            const pincodeMatch = useraddress.match(pincodeRegex);
            const orderPincode = pincodeMatch ? pincodeMatch[0] : '';
            user.orderpincode = orderPincode;

            if (promo.code) {
                // Push the promo code into the promoCodes array in UserModel
                existingUser.promoCodes.push(promo.code);
            }
            existingUser.notification.unshift({
                type: "Success",
                title: `Hey ${user.name}`,
                body: `Your Order Has been Successfully Placed Your OrderID is ${orderID}`
            })
            await existingUser.save();

            const notificationUser = {
                title: `Hey ${user.name}`,
                body: `Your Order Has been successfully placed , Your OrderID is ${orderID}`
            }

            let coins = 0;
            const productPrice = productDetails.price;

            // Find the appropriate document in the coinModel
            const coinModel = await CoinsModel.findOne({
                startRange: { $lte: productPrice },
                endRange: { $gte: productPrice }
            });

            if (coinModel) {
                coins = coinModel.coins;
            }

            // Create a new order instance using the OrderModel
            const newOrder = new OrderModel({
                orderId: orderID,
                user,
                payment,
                pickUpDetails,
                productDetails,
                promo,
                coins,
                platform
            });

            newOrder.logs.push({
                message: `Order created by User`,
            });

            // Save the new order to the database
            const savedOrder = await newOrder.save();
            const deletedAbundantOrder = await AbundantOrderModel.deleteMany({
                'user.phone': user.phone,
                'productDetails.slug': productDetails.slug,
            });

            // const partners = await PartnerModel.find({ pinCodes: orderPincode, token: { $ne: "" } });
            const partners = await PartnerModel.find({ pinCodes: orderPincode });
            const partnerTokens = partners.map(partner => partner.token);
            const notification = {
                title: `${savedOrder.productDetails.name} 📱`,
                body: `You have received a new order 📃`
            };
            // Send notifications to partners asynchronously
            sendNotificationsToPartnersAsync(partnerTokens, notification);
            const token = existingUser?.token;
            if (token) {
                sendNotification(token, notificationUser)
            }

            partners.forEach(async partner => {
                partner.notification.unshift({
                    type: "new",
                    title: `${savedOrder.productDetails.name}`,
                    body: `You have received a new order ${savedOrder.orderId}`,
                    orderID: savedOrder._id
                });
                await partner.save();
            });

            res.status(201).json({ message: 'Order created successfully', order: savedOrder });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});

router.get('/get-user-orders/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const orders = await OrderModel.find({ 'user.phone': phone }).select('-deviceInfo').sort({ createdAt: -1 });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: "No Orders Found" })
        }
        res.status(200).json({ orders })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
})

router.get('/get-user-order/:phone', verify, async (req, res) => {
    if (req.user.phone === req.params.phone) {
        try {
            let user = await UserModel.findOne({ phone: req.params.phone });
            if (user.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            const { phone } = req.params;
            const orders = await OrderModel.find({ 'user.phone': phone }).select('-deviceInfo').sort({ createdAt: -1 });
            if (!orders || orders.length === 0) {
                return res.status(404).json({ error: "No Orders Found" })
            }
            res.status(200).json({ orders })
        } catch (error) {
            res.status(500).json({ error: "Server Error" })
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }
})


router.get('/get-all-orders', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        // Use a regular expression to make the search case-insensitive and partial
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { orderId: searchRegex },
                { platform: searchRegex },
                { 'user.name': searchRegex },
                { 'user.email': searchRegex },
                { 'user.phone': searchRegex },
                { 'user.address': searchRegex },
                { 'productDetails.name': searchRegex },
                { 'partner.partnerName': searchRegex },
                { 'partner.partnerPhone': searchRegex },
                { 'partner.pickUpPersonPhone': searchRegex },
                { 'partner.pickUpPersonName': searchRegex },
                { status: searchRegex }
            ],
        };

        const allOrders = await OrderModel.find(query)
            .select('-deviceInfo.deviceBill -deviceInfo.imeiNumber -deviceInfo.idCard -deviceInfo.deviceImages ')
            .populate('deviceInfo', 'finalPrice')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(pageSize));

        // Format createdAt timestamps before sending response
        const formattedOrders = allOrders.map(order => {
            const productPrice = parseInt(order.productDetails?.price) || 0;
            const promoPrice = !isNaN(parseInt(order.promo?.price)) ? parseInt(order.promo?.price) : 0;
            const totalPrice = productPrice + promoPrice;
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
                }),
                totalPrice: totalPrice
            };
        });

        const totalOrders = await OrderModel.countDocuments(query);

        res.json({
            totalRows: totalOrders,
            data: formattedOrders,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/get-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find the order by orderId
        // const order = await OrderModel.findById(orderId).select('-deviceInfo');
        const order = await OrderModel.findById(orderId)

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // Format createdAt timestamp before sending response
        const formattedOrder = {
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

        res.json({ data: formattedOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:orderId/cancel', async (req, res) => {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    try {
        const order = await OrderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.status === "cancelled") {
            return res.status(200).json({ message: "Order Already Cancelled" })
        }

        // Update the order status to 'cancel' and store the cancellation reason
        order.logs.unshift({ message: `Order was cancelled by admin Cancellation Reason : ${cancellationReason}` });
        order.status = 'cancelled';
        order.cancellationReason = cancellationReason;

        if (order?.partner?.partnerPhone) {
            const newRefund = new RefundModel({
                orderID: order.orderId,
                cancellationReason: cancellationReason,
                partnerPhone: order.partner.partnerPhone,
                partnerName: order.partner.partnerName,
                coins: order.coins // Assuming you have a function to calculate the refund coins
            });
            await newRefund.save();
        }
        await order.save();

        return res.status(200).json({ message: 'Order canceled successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.put("/reschedule-order/:orderId", async (req, res) => {
    const orderId = req.params.orderId;
    const { pickUpDetails } = req.body;
    try {

        const order = await OrderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        order.logs.unshift({
            message: `Order was rescheduled by Admin from ${order.pickUpDetails.date} ${pickUpDetails.time} to ${pickUpDetails.date} ${pickUpDetails.time} Reschedule reason : ${pickUpDetails.reason}`,
        });

        // Update the order status to 'cancel' and store the cancellation reason
        order.pickUpDetails = pickUpDetails;
        order.status = 'rescheduled';
        await order.save();
        res.status(200).json({ message: "Order rescheduled  successfully" });

    } catch (error) {
        console.log(error)
        res.status(500).json({ message: error.message });
    }
})

router.put('/:orderId/user-cancel', verify, async (req, res) => {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;
    if (req.user.phone === req.body.phone) {
        try {
            let user = await UserModel.findOne({ phone: req.body.phone });
            if (user.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Update the order status to 'cancel' and store the cancellation reason
            order.logs.unshift({ message: `Order was cancelled by user Cancellation Reason : ${cancellationReason}` });
            order.status = 'cancelled';
            order.cancellationReason = cancellationReason;

            await order.save();

            return res.status(200).json({ message: 'Order canceled successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});

router.put('/:orderId/complete', async (req, res) => {
    const { orderId } = req.params;
    const { deviceInfo } = req.body;
    try {
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order Not Found' });
        }
        order.logs.unshift({ message: `Order was completed by Admin` });
        order.deviceInfo = deviceInfo
        order.status = 'Completed';
        await order.save();
        return res.status(200).json({ message: 'Order Completed Successfully' })
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' })
    }
})



router.get('/generate-invoice/:phone/:orderID', verify, async (req, res) => {
    if (req.user.phone === req.params.phone) {
        try {
            let user = await UserModel.findOne({ phone: req.params.phone });
            if (user.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            // Mocking order details for testing, replace this with your actual logic to fetch order details
            const orderID = req.params.orderID;
            const order = await OrderModel.findById(orderID);

            if (!order) {
                return res.status(404).send('Order not found');
            }

            // Create invoice data from the order details


            // Create PDF invoice in memory
            const pdfBuffer = await createInvoice(order);
            const base64String = pdfBuffer.toString('base64');
            // Set response headers
            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');

            // Send the PDF buffer as response
            // res.send(pdfBuffer);
            res.json({ base64String })

        } catch (error) {
            console.error('Error generating invoice:', error);
            res.status(500).send({ error: "Internal server error" });
        }
    }
    else {
        res.status(403).json({ error: "No Access to perform this action" })
    }
});

router.post("/send", function (req, res) {
    const token = "cMoXpjPpSFOjcZ6cAA9jmJ:APA91bH5X5wYA9iTyKbqjlCFOIQD1ymOrHIffhFH1T9OkrTWPV2oTlWrmeuZXsCc_Y8S3IUDG-jId1Wu50DDuBKPFbZeaSx8sMKNerLRiOhn0U-V43Xo7GS2P8yTOOqVsxXV3sCAUSVn"

    const message = {
        notification: {
            title: "I Phone 6S 32GB",
            body: "You have got a new order "
        },
        token,
    };

    getMessaging()
        .send(message)
        .then((response) => {
            res.status(200).json({
                message: "Successfully sent message",
                token,
            });
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            res.status(400);
            res.send(error);
            console.log("Error sending message:", error);
        });


});




module.exports = router;
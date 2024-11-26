const router = require("express").Router();
const mongoose = require("mongoose");
const PartnerModel = require("../models/Partner");
const OrderModel = require("../models/Order")
const UserModel = require("../models/User")
const dotenv = require("dotenv");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const DynamicModel = require('../models/Dynamic')
const createPaymentInvoice = require("./createPaymentInvoice")
const RefundModel = require("../models/Refund")
const { getMessaging } = require("firebase-admin/messaging");
const createInvoice = require("./createInvoice");
dotenv.config();

async function sendNotification(token, notification) {
    try {
        await getMessaging().send({ token: token, notification: notification });
        console.log("Notification sent successfully to partner with token:", token);
    } catch (error) {
        console.error("Error sending notification to partner with token:", token, "Error:", error);
    }
}


const secretKey = process.env.JWT_SECRET_KEY
const authkey = process.env.MSG91_AUTH_KEY
const sendOTP_Template_id = process.env.MSG91_TEMPLATE_ID_SEND_OTP

const verify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(403).json({ error: "Session Expired" });
            }
            req.user = user;
            next();
        })
    } else {
        res.status(403).json({ error: "You are not authenticated" });
    }
}

router.post("/create-partner", async (req, res) => {
    try {
        const {
            phone,
            name,
            email,
            address,
            pinCodes,
            state,
            gstIN,
            companyName
        } = req.body;

        // Check if partner with the provided phone number already exists
        const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
        if (phoneExists) {
            return res.status(400).json({ error: "Phone number already exists" });
        }


        const newPartner = new PartnerModel({
            phone,
            name,
            email,
            address,
            pinCodes,
            state,
            pickUp: [],
            role: "Partner",
            coins: "0",
            gstIN,
            companyName
        });

        await newPartner.save();

        res.status(201).json({ message: "Partner added successfully" });
    } catch (error) {
        console.log(error)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
            res.status(400).json({ error: "A Partner with this phone number already exists" })
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }

    }
});

router.get('/get-all-coins', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { startRange: { $regex: search, $options: 'i' } },
                { endRange: { $regex: search, $options: 'i' } },
                { value: { $regex: search, $options: 'i' } }
            ];
        }

        const allCoins = await CoinsModel.find(query)
            .select('startRange endRange value')
            .sort({ createdAt: -1 }) // Assuming you have a createdAt field in your CoinsSchema
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalCoins = await CoinsModel.countDocuments(query);

        res.send({
            totalRows: totalCoins,
            data: allCoins,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/get-all-partners', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { state: { $regex: search, $options: 'i' } }
            ];
        }

        const allPartners = await PartnerModel.find(query)
            .select('phone name email address pinCodes coins state')
            .sort({ createdAt: -1 }) // Assuming you have a createdAt field in your PartnerSchema
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalPartners = await PartnerModel.countDocuments(query);

        // Calculate the count of pin codes for each partner
        const partnersWithPinCodeCount = allPartners.map(partner => {
            const pinCodeCount = partner.pinCodes.length;
            return {
                ...partner.toObject(),
                pinCodeCount: pinCodeCount
            };
        });

        res.send({
            totalRows: totalPartners,
            data: partnersWithPinCodeCount,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/get-partner/:id', async (req, res) => {
    try {
        const partnerId = req.params.id;

        // Find the partner by ID
        const partner = await PartnerModel.findById(partnerId);

        // Check if partner exists
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        res.json(partner);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/update-partner/:id', async (req, res) => {
    try {
        const partnerId = req.params.id;
        const {
            email,
            address,
            pinCodes,
            state,
            status,
            gstIN,
            companyName
        } = req.body;

        // Find the partner by ID
        let partner = await PartnerModel.findById(partnerId);

        // Check if partner exists
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }
        partner.email = email || partner.email;
        partner.address = address || partner.address;
        partner.pinCodes = pinCodes || partner.pinCodes;
        partner.state = state || partner.state;
        partner.status = status || partner.status;
        partner.gstIN = gstIN || partner.gstIN;
        partner.companyName = companyName || partner.companyName;

        // Save updated partner details
        await partner.save();

        if (status === "blocked") {
            // Block all the pick-up persons under this partner
            for (const pickUpPerson of partner.pickUpPersons) {
                pickUpPerson.status = "blocked";
            }
            // Save changes to pick-up persons
            await partner.save();
        }

        res.json({ message: "Partner updated successfully" });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
            res.status(400).json({ error: "A Partner with this phone number already exists" })
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

router.delete('/delete-partner/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Use Mongoose to find and delete the pin code by ID
        const deletedPartner = await PartnerModel.findByIdAndDelete(id);

        if (!deletedPartner) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        res.json({ message: 'Partner deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// router.post('/add-pickup-person/:partnerId', async (req, res) => {
//     const partnerId = req.params.partnerId;
//     const { phone, name } = req.body;
//     const role = "pickUp";

//     try {
//         // Find the partner by ID
//         const partner = await PartnerModel.findById(partnerId);
//         if (!partner) {
//             return res.status(404).json({ error: "Partner not found" });
//         }

//         // Check if the phone number already exists in either PartnerModel or pickUpPersons
//         const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
//         if (phoneExists) {
//             return res.status(400).json({ error: "Phone number already exists" });
//         }

//         // Add the pick-up person to the partner's pickUpPersons array
//         partner.pickUpPersons.push({ phone, name, role });

//         // Save the updated partner document
//         await partner.save();

//         res.status(200).json({ message: "Pick-up person added successfully", partner });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });



//mobile
router.post('/partner-login', async (req, res) => {
    try {
        const { phone } = req.body;

        // Check if a partner with the provided phone number exists
        const partner = await PartnerModel.findOne({ phone });

        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        // Invalidate any previous session if partner is already logged in
        if (partner.loggedInDevice) {
            partner.loggedInDevice = null;
            await partner.save();
        }

        const payload = {
            phone: phone,
            role: partner.role,
            id: partner._id,
        }

        // Generate JWT token
        const token = jwt.sign(payload, secretKey);

        // Store device identifier in partner document
        partner.loggedInDevice = req.headers['user-agent']; // Using user-agent as device identifier
        await partner.save();

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});




router.get('/partners/order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Fetch order details to get the orderpincode
        const order = await OrderModel.findOne({ "orderId": orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const orderpincode = order.user.orderpincode;

        // Fetch partners whose pinCodes include the orderpincode
        const matchingPartners = await PartnerModel.find({ pinCodes: orderpincode });

        res.status(200).json({ partners: matchingPartners, order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




router.put('/order/assign/partner/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { partnerName, partnerPhone } = req.body;

        // const existingOrder = await OrderModel.findOne({ orderId });
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        // if (existingOrder.partner.partnerName !== '' || existingOrder.partner.partnerPhone !== '') {
        //     return res.status(400).json({ error: 'Partner already assigned for this order' });
        // }
        const order = await OrderModel.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.partner.partnerName !== '' && order.partner.partnerPhone !== '') {
            return res.status(400).json({ error: 'Order already accepted by a partner' });
        }

        const coinsToDeduct = parseInt(order.coins);
        const partnerCoins = parseInt(partner.coins);
        if (partnerCoins < coinsToDeduct) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        order.partner.partnerName = partner.name
        order.partner.partnerPhone = partnerPhone;
        order.status = "processing";


        order.logs.unshift({
            message: `Order assigned to partner ${partnerName} (${partnerPhone}) from Admin ,Coins deducted ${coinsToDeduct}`,
        });
        partner.coins = (partnerCoins - coinsToDeduct).toString();
        partner.transaction.unshift({
            type: "debited",
            coins: coinsToDeduct,
            orderID: `${order.orderId}`,
            message: `Debited for order ${order.orderId}`,
            image: `${order.productDetails.image}`
        })
        await order.save();
        await partner.save();
        res.status(200).json({ message: "order assigned successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/order/cancel/partner/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;


        const existingOrder = await OrderModel.findOne({ orderId });



        // Update partner details in the order

        const updatedOrder = await OrderModel.findOneAndUpdate(
            { orderId },
            {
                $set: {
                    'partner.partnerName': "",
                    'partner.partnerPhone': "",
                    'partner.pickUpPersonName': "",
                    'partner.pickUpPersonPhone': "",
                    status: "new"
                }
            },
            { new: true }
        );

        if (updatedOrder) {
            updatedOrder.logs.unshift({ message: `Order deassigned from partner ${existingOrder.partner.partnerName} (${existingOrder.partner.partnerPhone}) from admin`, });
            await updatedOrder.save();
        } else {
            return res.status(404).json({ error: 'Order not found' });
        }

        const newRefund = new RefundModel({
            orderID: existingOrder.orderId,
            cancellationReason: "Order Deassigned from admin",
            partnerPhone: existingOrder.partner.partnerPhone,
            partnerName: existingOrder.partner.partnerName,
            coins: existingOrder.coins // Assuming you have a function to calculate the refund coins
        });
        await newRefund.save();

        res.status(200).json("Deassigned Successfully");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


const sendSMS = async (mobileNumber) => {
    try {
        const otp = Math.floor(1000 + Math.random() * 9000);
        const otpExpiry = Date.now() + 600000;
        const apiUrl = 'https://control.msg91.com/api/v5/flow/';
        const headers = {
            "authkey": authkey
        }
        const response = await axios.post(apiUrl,
            {
                "template_id": sendOTP_Template_id,
                "short_url": "0",
                "recipients": [
                    {
                        "mobiles": mobileNumber,
                        "otp": otp
                    }
                ]
            }
            , { headers })
        console.log(response.data);
        // Check if the response indicates success
        if (response.status === 200 && response.data && response.data.type === "success") {
            return { otp, otpExpiry };
        } else {
            // Handle error or failure to send OTP
            throw new Error("Failed to send OTP");
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

router.post('/send-sms', async (req, res) => {
    const { mobileNumber } = req.body;
    const formattedMobileNumber = `91${mobileNumber}`;
    try {
        const partner = await PartnerModel.findOne({ phone: mobileNumber });

        if (!partner) {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': mobileNumber });
            if (!user) {
                return res.status(404).json({ error: "User not found" })
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === mobileNumber);
            if (pickUpPerson.status !== "active") {
                return res.status(403).json({ error: "Your account has been blocked" });
            }
            const result = await sendSMS(formattedMobileNumber);
            if (result && result.otp && result.otpExpiry) {
                const { otp, otpExpiry } = result;
                // pickUpPerson.otp = otp;
                pickUpPerson.otp = otp
                pickUpPerson.otpExpiry = otpExpiry
                await user.save();
                res.json({ message: "OTP Sent Successfully" });
            } else {
                res.status(500).json({ error: 'Failed to send OTP' });
            }
        } else {
            if (partner.status !== "active") {
                return res.status(403).json({ error: "Your account has been blocked" });
            }
            const result = await sendSMS(formattedMobileNumber);
            if (result && result.otp && result.otpExpiry) {
                const { otp, otpExpiry } = result;
                // partner.otp = otp;
                partner.otp = otp
                partner.otpExpiry = otpExpiry;
                await partner.save();
                res.json({ message: "OTP Sent Successfully" });
            } else {
                res.status(500).json({ error: 'Failed to send OTP' });
            }
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});


router.post(`/sms-login`, async (req, res) => {
    try {
        const { otp, phone, deviceToken } = req.body;
        const partner = await PartnerModel.findOne({ phone, otp, otpExpiry: { $gt: Date.now() } });
        if (!partner) {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ error: "Invalid OTP" })
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!user || !pickUpPerson || pickUpPerson.otp !== otp || pickUpPerson.otpExpiry < Date.now()) {
                return res.status(400).json({ error: "Invalid OTP" });
            }

            pickUpPerson.otp = ""
            pickUpPerson.otpExpiry = ""
            pickUpPerson.loggedInDevice = req.headers['user-agent'];
            pickUpPerson.token = deviceToken;
            const payload = {
                loggedInDevice: req.headers['user-agent'],
                phone: phone,
                role: pickUpPerson.role,
                id: pickUpPerson._id,
            }
            const token = jwt.sign(payload, secretKey);
            await user.save();
            res.status(200).json({
                role: pickUpPerson.role,
                phone: phone,
                token: token,
                message: "Login successful",

            });
        } else {
            partner.otp = ""
            partner.otpExpiry = ""
            partner.loggedInDevice = req.headers['user-agent'];
            partner.token = deviceToken;
            const payload = {
                loggedInDevice: req.headers['user-agent'],
                phone: phone,
                role: partner.role,
                id: partner._id,
            }
            const token = jwt.sign(payload, secretKey);
            await partner.save();
            res.status(200).json({
                role: partner.role,
                phone: phone,
                token: token,
                message: "Login successful"
            });
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Server Error" })
    }
})


router.get('/get-partner-orders/:partnerPhone', verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const searchRegex = new RegExp(search, 'i');



        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            // Fetch orders whose pincode matches any of the partner's pinCodes
            // and partner.partnerName and partner.phone are empty strings
            const query = {
                $and: [
                    { 'user.orderpincode': { $in: partner.pinCodes } },
                    { 'partner.partnerName': '' },
                    { 'partner.partnerPhone': '' },
                    { status: "new" },
                    {
                        $or: [
                            { orderId: searchRegex },
                            { 'user.name': searchRegex },
                            { 'user.email': searchRegex },
                            { 'user.phone': searchRegex },
                            { 'user.address': searchRegex },
                            { 'productDetails.name': searchRegex }
                        ]
                    }
                ]
            };
            const matchingOrders = await OrderModel.find(query).select('-deviceInfo').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize))

            res.status(200).json({ orders: matchingOrders });
        } else {
            res.status(403).json({ error: `No Access to perform this action` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

});

router.get('/get-assigned-partner-orders/:partnerPhone', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const { page = 1, pageSize = 5, search = '' } = req.query;
    const skip = (page - 1) * pageSize;
    const searchRegex = new RegExp(search, 'i');
    if (req.user.role === "Partner") {
        try {
            // Fetch partner based on phone number
            const partner = await PartnerModel.findOne({ phone: partnerPhone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            // Check if loggedInDevice matches
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const query = {
                    'user.orderpincode': { $in: partner.pinCodes },
                    'partner.partnerPhone': partnerPhone,
                    $or: [
                        { orderId: searchRegex },
                        { 'user.name': searchRegex },
                        { 'user.email': searchRegex },
                        { 'user.phone': searchRegex },
                        { 'user.address': searchRegex },
                        { 'productDetails.name': searchRegex }
                    ]
                };
                // Fetch orders whose pincode matches any of the partner's pinCodes
                // and partner.partnerName and partner.partnerPhone are empty strings
                const matchingOrders = await OrderModel.find(query).select('-deviceInfo -logs').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize))

                res.status(200).json({ orders: matchingOrders });
            } else {
                res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': partnerPhone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === partnerPhone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const query = {
                    'partner.pickUpPersonPhone': partnerPhone,
                    $or: [
                        { orderId: searchRegex },
                        { 'user.name': searchRegex },
                        { 'user.email': searchRegex },
                        { 'user.phone': searchRegex },
                        { 'user.address': searchRegex },
                        { 'productDetails.name': searchRegex }
                    ]
                };
                // Fetch orders whose pincode matches any of the partner's pinCodes
                // and partner.partnerName and partner.partnerPhone are empty strings
                const matchingOrders = await OrderModel.find(query).select('-deviceInfo -logs').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize))

                res.status(200).json({ orders: matchingOrders });

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
});

router.get('/get-orders/:partnerPhone/:orderID', verify, async (req, res) => {
    const orderId = req.params.orderID;
    const partnerPhone = req.params.partnerPhone;
    if (req.user.role === "Partner") {
        try {
            // Fetch partner based on phone number
            const partner = await PartnerModel.findOne({ phone: partnerPhone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            // Check if loggedInDevice matches
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId)
                if (order.partner.partnerPhone !== partner.phone) {
                    return res.status(401).json({ error: "You can't perform this action" })
                }
                res.status(200).json(order);
            } else {
                res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': partnerPhone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === partnerPhone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId)
                if (order.partner.pickUpPersonPhone !== pickUpPerson.phone) {
                    return res.status(401).json({ error: "You can't perform this action" })
                }
                res.status(200).json(order);

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
});

router.get('/get-single-orders/:partnerPhone/:orderID', verify, async (req, res) => {
    const orderId = req.params.orderID;
    const partnerPhone = req.params.partnerPhone;
    if (req.user.role === "Partner") {
        try {
            // Fetch partner based on phone number
            const partner = await PartnerModel.findOne({ phone: partnerPhone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            // Check if loggedInDevice matches
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId)
                res.status(200).json(order);
            } else {
                res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': partnerPhone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === partnerPhone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId)
                if (order.partner.pickUpPersonPhone !== pickUpPerson.phone) {
                    return res.status(401).json({ error: "You can't perform this action" })
                }
                res.status(200).json(order);

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
});

router.post("/accept-order/:partnerPhone/:orderId", verify, async (req, res) => {
    try {

        const partnerPhone = req.params.partnerPhone;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        const orderId = req.params.orderId;

        // Fetch the order by ID
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            if (order.partner.partnerName !== '' && order.partner.partnerPhone !== '') {
                return res.status(400).json({ error: 'Order already accepted by a partner' });
            }


            const coinsToDeduct = parseInt(order.coins);
            const partnerCoins = parseInt(partner.coins);
            if (partnerCoins < coinsToDeduct) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }
            partner.transaction.unshift({
                type: "debited",
                coins: coinsToDeduct,
                orderID: `${order.orderId}`,
                message: `Debited for order ${order.orderId}`,
                image: `${order.productDetails.image}`
            })
            order.partner.partnerName = partner.name
            order.partner.partnerPhone = partnerPhone;
            order.status = "processing";
            order.logs.unshift({
                message: `Order Accepted by partner ${partner.name} (${partner.phone})`,
            });

            partner.coins = (partnerCoins - coinsToDeduct).toString();

            const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
            existingUser.notification.unshift({
                type: "Processing",
                title: `Hey ${existingUser.name}`,
                body: `Your order ${order.orderId} has been accepted, Our PickUp person will contact you soon .`
            })

            const userNotification = {
                title: `Hey ${order?.user?.name}`,
                body: `Your order ${order.orderId} has been accepted, Our PickUp person will contact you soon`
            }
            const userToken = existingUser?.token;
            if (userToken) {
                sendNotification(userToken, userNotification)
            }
            await existingUser.save();

            // order.partner.coins -= coinsToDeduct;
            await order.save();
            await partner.save();
            res.status(200).json({ message: "Order Accepted Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


router.post('/add-pickup-person/:partnerPhone', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const { phone, name } = req.body;
    const role = "pickUp";

    try {

        // Find the partner by ID
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
            if (phoneExists) {
                return res.status(400).json({ error: "Phone number already exists" });
            }

            // Add the pick-up person to the partner's pickUpPersons array
            partner.pickUpPersons.push({ phone, name, role });

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person added successfully", partner });
        } else {
            res.status(403).json({ error: `No Access to perform this action` });
        }
        // Check if the phone number already exists in either PartnerModel or pickUpPersons
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get('/get-pickup-persons/:partnerPhone', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            // Return the pick-up persons associated with the partner
            res.status(200).json({ pickUpPersons: partner.pickUpPersons });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put('/block-pickup-person/:partnerPhone/:pickUpPersonId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const pickUpPersonId = req.params.pickUpPersonId;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            // Find the pick-up person by ID
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }

            // Update the status of the pick-up person to "blocked"
            pickUpPerson.status = "blocked";

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person blocked successfully" });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put('/unblock-pickup-person/:partnerPhone/:pickUpPersonId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const pickUpPersonId = req.params.pickUpPersonId;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            // Find the pick-up person by ID
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }

            // Update the status of the pick-up person to "blocked"
            pickUpPerson.status = "active";

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person unblocked successfully" });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/assign-order/:partnerPhone/:pickUpPersonId/:orderId", verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;
        const pickUpPersonId = req.params.pickUpPersonId;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        const orderId = req.params.orderId;

        // Fetch the order by ID
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            if (order.partner.pickUpPersonName
                !== '' && order.partner.pickUpPersonPhone
                !== '') {
                return res.status(400).json({ error: 'Order already assigned to a pick up guy' });
            }
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }
            if (order.partner.partnerPhone !== partner.phone) {
                return res.status(401).json({ error: "You can't perform this action" })
            }
            order.partner.pickUpPersonName = pickUpPerson.name;
            order.partner.pickUpPersonPhone = pickUpPerson.phone;
            order.logs.unshift({
                message: `Order Assigned to Pickup person ${pickUpPerson.name} (${pickUpPerson.phone})`,
            });
            pickUpPerson.notification.unshift({
                type: "assigned",
                title: `Hey ${pickUpPerson.name}`,
                body: `A new order is waiting for you: ${order.orderId}!`,
                orderID: order._id
            });
            await partner.save();
            await order.save();
            const notification = {
                title: `Hey ${pickUpPerson.name} `,
                body: `A new order is waiting for you ${order.orderId} !!`
            }
            const token = pickUpPerson.token;
            if (token) {
                sendNotification(token, notification)
            }

            res.status(200).json({ message: "Order Assigned Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post("/deassign-order/:partnerPhone/:orderId", verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        const orderId = req.params.orderId;

        // Fetch the order by ID
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            if (order.partner.partnerPhone !== partner.phone) {
                return res.status(401).json({ error: "You can't perform this action" })
            }
            order.logs.unshift({
                message: `Order Deassigned from Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone})`,
            });

            order.partner.pickUpPersonName = "";
            order.partner.pickUpPersonPhone = "";

            await order.save();
            res.status(200).json({ message: "Order Deassigned Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get("/partners/:phone", verify, async (req, res) => {
    const phone = req.params.phone; // Extract the phone number from the request parameters
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone }).select('-transaction'); // Find the partner in the database by phone number
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                res.status(200).json(partner);
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }

            // Respond with the partner data in JSON format
        } catch (error) {
            res.status(500).json({ error: error.message }); // Handle errors
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {

                res.status(200).json(pickUpPerson);
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

});

router.put("/requote/partner/:phone/:orderId", verify, async (req, res) => {
    const orderId = req.params.orderId;
    const phone = req.params.phone;
    const { price, options } = req.body;

    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.partnerPhone != partner.phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                // Update product price and options
                order.logs.unshift({
                    message: `Order was requoted by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) from previous price ${order.productDetails.price} to current price ${price}`,
                });
                order.productDetails.price = price;
                order.productDetails.options = options;

                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Requoted",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been requoted to ${price}`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order ${order.orderId} has been requoted to ${price}`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();

                // Save updated order
                await order.save();

                res.status(200).json({ message: "Requote done successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was requoted by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone}) from previous price ${order.productDetails.price} to current price ${price}`,
                });
                // Update product price and options
                order.productDetails.price = price;
                order.productDetails.options = options;
                user.notification.unshift({
                    type: "requoted",
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has requoted order ${order.orderId} !!`,
                    orderID: order._id
                })

                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Requoted",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been requoted to ${price}`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order ${order.orderId} has been requoted to ${price}`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();

                // Save updated order
                await user.save();
                await order.save();
                const notification = {
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has requoted order ${order.orderId} !!`
                }
                const token = user.token;
                if (token) {
                    sendNotification(token, notification)
                }
                res.status(200).json({ message: "Requote done successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
});

router.put("/update-coins-after-payment/:phone", verify, async (req, res) => {
    console.log(req.body);
    const phone = req.params.phone;
    const { coins, price, gstPrice, paymentId, gstPercentage } = req.body;

    try {
        const CompanyData = await DynamicModel.findOne({ page: "Company Details" })
        console.log(CompanyData)
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            let totalCoins = parseInt(partner.coins) + parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "credited",
                paymentId,
                price,
                gstPrice,
                gstPercentage,
                partnerState: partner.state,
                HomeState: CompanyData.state,
                coins: coins,
                message: "Online Payment"
            })
            await partner.save();
            res.status(200).json({ message: "Coins added successfully" });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }
})

router.put("/cancel-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { cancellationReason } = req.body;
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === 'cancelled') {
                    return res.status(200).json({ message: "Order Already Cancelled" })
                }

                order.logs.unshift({
                    message: `Order was cancelled by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) Cancellation Reason : ${cancellationReason}`,
                });
                // Update the order status to 'cancel' and store the cancellation reason
                order.status = 'cancelled';
                order.cancellationReason = cancellationReason;
                const newRefund = new RefundModel({
                    orderID: order.orderId,
                    cancellationReason: cancellationReason,
                    partnerPhone: partner.phone,
                    partnerName: partner.name,
                    coins: order.coins // Assuming you have a function to calculate the refund coins
                });
                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Cancelled",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been cancelled`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order has been cancelled`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();

                await order.save();
                await newRefund.save();

                res.status(200).json({ message: "Order cancelled successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === 'cancelled') {
                    return res.status(200).json({ message: "Order Already Cancelled" })
                }
                order.logs.unshift({
                    message: `Order was cancelled by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone})
                    Cancellation Reason : ${cancellationReason} `,
                });

                user.notification.unshift({
                    type: "cancelled",
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has cancelled order ${order.orderId} !!`,
                    orderID: order._id
                })


                order.status = 'cancelled';
                order.cancellationReason = cancellationReason;
                const newRefund = new RefundModel({
                    orderID: order.orderId,
                    cancellationReason: cancellationReason,
                    partnerPhone: user.phone,
                    partnerName: user.name,
                    coins: order.coins // Assuming you have a function to calculate the refund coins
                });
                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Cancelled",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been cancelled`
                })
                await existingUser.save();
                await user.save();
                await order.save();
                await newRefund.save();
                const notification = {
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has cancelled order ${order.orderId} !!`
                }
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order has been cancelled`
                }

                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                const token = user.token;
                if (token) {
                    sendNotification(token, notification)
                }
                res.status(200).json({ message: "Order cancelled successfully" });

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
})

router.put("/complete-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { deviceInfo } = req.body;
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === "Completed") {

                    return res.status(200).json({ message: "Order Already Completed" })
                }
                order.logs.unshift({
                    message: `Order was completed by Partner ${order.partner.partnerName} (${order.partner.partnerPhone})`,
                });
                // Update the order status to 'cancel' and store the cancellation reason
                order.deviceInfo = deviceInfo
                order.status = 'Completed';
                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Completed",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been completed`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order has been completed`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();
                await order.save();
                res.status(200).json({ message: "Order completed successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === "Completed") {
                    return res.status(200).json({ message: "Order Already Completed" })
                }
                order.logs.unshift({
                    message: `Order was completed by Pickup person ${order.partner.pickUpPersonName}`,
                });
                order.deviceInfo = deviceInfo
                order.status = 'Completed';
                user.notification.unshift({
                    type: "completed",
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has completed order ${order.orderId} !!`,
                    orderID: order._id
                })
                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Completed",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been completed`
                })
                await existingUser.save();
                await user.save();
                await order.save();
                const notification = {
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has completed order ${order.orderId} !!`
                }
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order has been completed
                    `
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                const token = user.token;
                if (token) {
                    sendNotification(token, notification)
                }
                res.status(200).json({ message: "Order completed successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

})

router.put("/reschedule-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { pickUpDetails } = req.body;
    console.log(req.body)
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was rescheduled by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) from ${order.pickUpDetails.date} ${pickUpDetails.time} to ${pickUpDetails.date} ${pickUpDetails.time} Reschedule reason : ${pickUpDetails.reason}`,
                });

                // Update the order status to 'cancel' and store the cancellation reason
                order.pickUpDetails = pickUpDetails;
                order.status = 'rescheduled';
                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Rescheduled",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been rescheduled to ${pickUpDetails.date} ${pickUpDetails.time}`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order ${order.orderId} has been rescheduled`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();
                await order.save();

                res.status(200).json({ message: "Order rescheduled  successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was rescheduled by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone}) from ${order.pickUpDetails.date} ${pickUpDetails.time} to ${pickUpDetails.date} ${pickUpDetails.time} Reschedule reason : ${pickUpDetails.reason}  `,
                });
                user.notification.unshift({
                    type: "rescheduled",
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has rescheduled order ${order.orderId} !!`,
                    orderID: order._id
                })

                order.pickUpDetails = pickUpDetails;
                order.status = 'rescheduled';


                const existingUser = await UserModel.findOne({ phone: order?.user?.phone });
                existingUser.notification.unshift({
                    type: "Rescheduled",
                    title: `Hey ${existingUser.name}`,
                    body: `Your Order ${order.orderId} has been rescheuled to ${pickUpDetails.date} ${pickUpDetails.time}`
                })
                const userNotification = {
                    title: `Hey ${order?.user?.name}`,
                    body: `Your order ${order.orderId} has been rescheduled`
                }
                const userToken = existingUser?.token;
                if (userToken) {
                    sendNotification(userToken, userNotification)
                }
                await existingUser.save();


                await user.save();
                await order.save();
                const notification = {
                    title: `Hey ${user.name} `,
                    body: `Your pickup person ${pickUpPerson.name} has rescheduled order ${order.orderId} !!`
                }
                const token = user.token;
                if (token) {
                    sendNotification(token, notification)
                }
                res.status(200).json({ message: "Order rescheduled  successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
})

router.get("/transaction/:partnerPhone/:transactionId", verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const transactionId = req.params.transactionId;

    try {
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked" || req.user.role === "superadmin") {
            const transaction = partner.transaction.find(trans => trans._id.toString() === transactionId);
            if (!transaction) {
                return res.status(404).json({ message: "Transaction not found" });
            }

            const user = {
                phone: partner.phone,
                name: partner.name,
                address: partner.address,
                state: partner.state,
                gstIN: partner.gstIN,
                companyName: partner.companyName
            };
            const invoice = {
                user,
                transaction
            }
            const pdfBuffer = await createPaymentInvoice(invoice);

            // Convert PDF buffer to base64
            const base64String = pdfBuffer.toString('base64');

            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');

            // Send base64 string as response
            res.json({ base64String })

        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        console.log(error)
        console.log(error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked" || req.user.role === "superadmin") {
            const transactions = partner.transaction.slice(skip, skip + parseInt(pageSize));

            res.json(transactions);
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/credited/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            const creditedTransactions = partner.transaction.filter(transaction => transaction.type === 'credited');
            const transactions = creditedTransactions.slice(skip, skip + parseInt(pageSize));

            res.json({
                data: transactions
            });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/debited/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            const debitedTransactions = partner.transaction.filter(transaction => transaction.type === 'debited');
            const transactions = debitedTransactions.slice(skip, skip + parseInt(pageSize));

            res.json({
                data: transactions
            });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//for admin
router.get('/get-partner-orders-admin/:partnerPhone', verify, async (req, res) => {
    try {
        const { partnerPhone } = req.params;
        const { page = 1, pageSize = 10 } = req.query;
        const skip = (page - 1) * pageSize;

        if (req.user.role === "superadmin") {
            const orders = await OrderModel.find({ 'partner.partnerPhone': partnerPhone })
                .select('-deviceInfo -logs') // Excluding deviceInfo and logs fields
                .skip(skip)
                .limit(parseInt(pageSize))
                .sort({ createdAt: -1 });

            res.json(orders);
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
        // Fetch orders for the specified partner using their partnerPhone

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/addCoins', verify, async (req, res) => {

    const { message, coins, phone } = req.body;
    try {
        if (req.user.role === "superadmin") {
            const partner = await PartnerModel.findOne({ phone: phone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            let totalCoins = parseInt(partner.coins) + parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "credited",
                coins: coins,
                message: message
            })
            await partner.save();
            res.status(200).json({ message: "Coins Added Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }

})

router.post('/deductCoins', verify, async (req, res) => {

    const { message, coins, phone } = req.body;
    try {
        if (req.user.role === "superadmin") {
            const partner = await PartnerModel.findOne({ phone: phone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            let totalCoins = parseInt(partner.coins) - parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "debited",
                coins: coins,
                message: message
            })
            await partner.save();
            res.status(200).json({ message: "Coins Deducted Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }

})

const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('-');
    return new Date(`${year}-${month}-${day}`);
}


router.get("/notifications/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const { page = 1, pageSize = 5, type = "all", from, to } = req.query;
    const skip = (page - 1) * pageSize;

    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;

    const isSameDate = fromDate && toDate && fromDate.toDateString() === toDate.toDateString();

    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone }).select('-transaction');
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                let notifications;
                if (type === "read") {
                    notifications = partner.notification.filter(n => n.status === true);
                } else if (type === "unread") {
                    notifications = partner.notification.filter(n => n.status === false);
                } else {
                    notifications = partner.notification
                }

                if (isSameDate) {
                    notifications = notifications.filter(n => {
                        const notificationDate = new Date(n.timestamp).toDateString();
                        return notificationDate === fromDate.toDateString();
                    });
                } else {
                    if (fromDate) {
                        notifications = notifications.filter(n => new Date(n.timestamp) >= fromDate);
                    }
                    if (toDate) {
                        notifications = notifications.filter(n => new Date(n.timestamp) <= toDate);
                    }
                }

                const paginatedNotifications = notifications.slice(skip, skip + parseInt(pageSize, 10));

                res.json({ data: paginatedNotifications, length: partner.notification.length });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                let notifications;
                if (type === "read") {
                    notifications = pickUpPerson.notification.filter(n => n.status === true);
                } else if (type === "unread") {
                    notifications = pickUpPerson.notification.filter(n => n.status === false);
                } else {
                    notifications = pickUpPerson.notification;
                }
                // Filter by date range
                if (isSameDate) {
                    notifications = notifications.filter(n => {
                        const notificationDate = new Date(n.timestamp).toDateString();
                        return notificationDate === fromDate.toDateString();
                    });
                } else {
                    if (fromDate) {
                        notifications = notifications.filter(n => new Date(n.timestamp) >= fromDate);
                    }
                    if (toDate) {
                        notifications = notifications.filter(n => new Date(n.timestamp) <= toDate);
                    }
                }

                const paginatedNotifications = notifications.slice(skip, skip + parseInt(pageSize, 10));
                return res.json({ data: paginatedNotifications, length: notifications.length });

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
});


router.get("/logout/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone }).select('-transaction'); // Find the partner in the database by phone number
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                partner.loggedInDevice = "";
                partner.token = "";
                await partner.save();
                res.json({ message: "Logout Successful" })
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }

            // Respond with the partner data in JSON format
        } catch (error) {
            res.status(500).json({ error: error.message }); // Handle errors
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                pickUpPerson.loggedInDevice = "";
                pickUpPerson.token = "";
                await user.save();
                res.json({ message: "Logout Successful" })
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

});


router.put('/block-partner-app/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { otp } = req.body;

        // Fetch the partner using their phone number
        const partner = await PartnerModel.findOne({ phone, otp, otpExpiry: { $gt: Date.now() } });

        if (!partner) {
            return res.status(404).json({ error: "Invalid OTP" });
        }

        // Check if the requesting user has access to perform this action
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
            // Update the partner's status to "blocked"
            partner.status = "blocked";

            for (const pickUpPerson of partner.pickUpPersons) {
                pickUpPerson.status = "blocked";
            }

            // Save the updated partner
            await partner.save();

            res.json({ message: "Partner account blocked successfully" });
        } else {
            // Return 403 Forbidden if access is denied
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.put('/notificationStatus/:partnerPhone/:notificationId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const notificationId = req.params.notificationId
    if (req.user.role === "Partner") {
        try {
            // Fetch partner based on phone number
            const partner = await PartnerModel.findOne({ phone: partnerPhone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            // Check if loggedInDevice matches
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const updatedPartner = await PartnerModel.findOneAndUpdate(
                    {
                        _id: partner._id.toString(),
                        "notification._id": notificationId
                    },
                    {
                        $set: { "notification.$.status": true }
                    },
                    { new: true }
                );
                if (!updatedPartner) {
                    return res.status(404).json({ error: "Partner or notification not found" })
                }
                res.status(200).json({ message: "Success" });
            } else {
                res.status(403).json({ error: `No Access to perform this action` });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': partnerPhone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === partnerPhone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {
                const updatedUser = await PartnerModel.findOneAndUpdate(
                    {
                        _id: user._id.toString(),
                        "pickUpPersons._id": pickUpPerson._id.toString(),
                        "pickUpPersons.notification._id": notificationId
                    },
                    {
                        $set: { "pickUpPersons.$.notification.$[elem].status": true }
                    },
                    {
                        new: true,
                        arrayFilters: [{ "elem._id": notificationId }]
                    }
                );
                if (!updatedUser) {
                    return res.status(404).json({ error: "User or notification not found" });
                }
                res.status(200).json({ message: "Success" });

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
});

router.put('/notificationStatus-order/:partnerPhone/:orderId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const orderId = req.params.orderId;
    if (req.user.role === "Partner") {
        try {
            // Fetch partner based on phone number
            const partner = await PartnerModel.findOne({ phone: partnerPhone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            // Check if loggedInDevice matches
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                partner.notification.forEach((notification) => {
                    if (notification.orderID === orderId) {
                        notification.status = true;
                    }
                })
                await partner.save();
                res.status(200).json({ message: "Success" });
            } else {
                res.status(403).json({ error: `No Access to perform this action` });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }

    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': partnerPhone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === partnerPhone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === partnerPhone && req.user.loggedInDevice === pickUpPerson.loggedInDevice && pickUpPerson.status !== "blocked") {

                pickUpPerson.notification.forEach((notification) => {
                    if (notification.orderID === orderId) {
                        notification.status = true
                    }
                })
                await user.save();
                res.status(200).json({ message: "Success" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
});


router.get("/generate-user-invoice/:phone/:orderId", verify, async (req, res) => {
    const orderId = req.params.orderId;
    const phone = req.params.phone;

    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice && partner.status !== "blocked") {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.partnerPhone != partner.phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }

                const pdfBuffer = await createInvoice(order);
                const base64String = pdfBuffer.toString('base64');

                res.status(200).json({ base64String });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        return res.status(403).json({ error: `No Access to perform this action` })
    }
});


router.get("/admin-get-notifications/:phone", async (req, res) => {
    const partnerPhone = req.params.phone;
    const { page = 1, pageSize = 5 } = req.query;
    const skip = (page - 1) * pageSize

    try {
        const partner = await PartnerModel.findOne({ phone: partnerPhone }).select('-transaction');
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }
        console.log(partner)

        const notifications = partner.notification.slice(skip, skip + parseInt(pageSize, 10));

        res.json({ data: notifications, length: partner.notification.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

});


module.exports = router;
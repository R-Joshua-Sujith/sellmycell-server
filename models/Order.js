const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true },
    user: {
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        addPhone: { type: String, default: "" },
        address: { type: String },
        pincode: { type: String },
        city: { type: String },
        orderpincode: { type: String },
    },
    payment: {
        type: { type: String },
        id: { type: String, default: "" }
    },
    pickUpDetails: {
        time: { type: String },
        date: { type: String }
    },
    productDetails: {
        name: { type: String },
        slug: { type: String },
        image: { type: String },
        price: { type: String },
        category: { type: String },
        options: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    promo: {
        code: { type: String, default: "Not Applicable" },
        price: { type: String, default: "" }
    },
    deviceInfo: {
        finalPrice: { type: String, required: false },
        imeiNumber: { type: String, required: false },
        imeiImage: { type: String, required: false },
        deviceBill: { type: String, required: false },
        idCard: { type: String, required: false },
        deviceImages: [
            {
                type: String, required: false
            }
        ]
    },
    status: { type: String, default: 'new' },
    cancellationReason: { type: String, default: "" },
    partner: {
        partnerName: { type: String, default: "" },
        partnerPhone: { type: String, default: "" },
        pickUpPersonName: { type: String, default: "" },
        pickUpPersonPhone: { type: String, default: "" }
    },
    platform: {
        type: String,
        default: "mobile"
    },
    coins: { type: String },
    logs: [
        {
            message: { type: String },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
})

const OrderModel = mongoose.model("Order", orderSchema);

module.exports = OrderModel;
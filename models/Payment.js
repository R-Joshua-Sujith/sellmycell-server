const mongoose = require('mongoose');

// Define the schema for the payment
const paymentSchema = new mongoose.Schema({
    image: {
        type: String,
    },
    partnerPhone: {
        type: String,

    },
    coins: {
        type: Number,

    },
    price: {
        type: Number,

    },
    gstPrice: {
        type: Number,

    },
    gstPercentage: {
        type: Number,

    },
    status: {
        type: String,
        default: "Pending"
    },
    partnerState: {
        type: String,
    },
    partnerName: {
        type: String
    },
    HomeState: {
        type: String
    },
    message: {
        type: String,
        default:""
    }
}, {
    timestamps: true
});

// Create the model using the schema
const PaymentModel = mongoose.model('Payment', paymentSchema);

module.exports = PaymentModel;

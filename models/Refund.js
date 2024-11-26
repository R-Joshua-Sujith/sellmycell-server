const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema({
    orderID: { type: String, required: true },
    cancellationReason: { type: String, required: true },
    partnerPhone: { type: String, required: true },
    partnerName: { type: String, required: true },
    coins: { type: Number, required: true },
    status: { type: String, default: "pending" },
    timestamp: { type: Date, default: Date.now }
});

const RefundModel = mongoose.model("Refund", refundSchema);

module.exports = RefundModel;

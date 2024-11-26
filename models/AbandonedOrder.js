const mongoose = require("mongoose");

const adundantSchema = new mongoose.Schema({
    user: {
        phone: { type: String },
        pincode: { type: String },
        city: { type: String }
    },
    productDetails: {
        name: { type: String },
        slug: { type: String },
        price: { type: String },
        options: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    platform: {
        type: String,
        default: "mobile"
    }

}, {
    timestamps: true
})

const AbundantOrderModel = mongoose.model("AbundantOrder", adundantSchema);

module.exports = AbundantOrderModel;
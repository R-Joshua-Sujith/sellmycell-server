const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    discountAmount: {
        type: Number,
        required: true,
    },
});

const PromoCodeModel = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCodeModel;

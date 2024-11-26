const mongoose = require('mongoose');

const BrandSchema = new mongoose.Schema({
    brandName: { type: String, unique: true },
    brandImage: { type: String },
    series: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    }
}, {
    timestamps: true
});

const BrandModel = mongoose.model('Brand', BrandSchema);

module.exports = BrandModel;

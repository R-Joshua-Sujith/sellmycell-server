const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    optionHeading: String,
    optionValue: String
});

const ItemSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true },
    productImage: { type: String },
    basePrice: { type: Number },
    estimatedPrice: { type: Number },
    variant: { type: String },
    model: { type: String },
    brandName: { type: String },
    seriesName: { type: String },
    categoryType: { type: String },
    bestSelling: { type: String },
    dynamicFields: [optionSchema]
});

const ItemModel = mongoose.model("Item", ItemSchema);

module.exports = ItemModel;
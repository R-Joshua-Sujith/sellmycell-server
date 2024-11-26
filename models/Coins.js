const mongoose = require("mongoose");

const CoinsSchema = new mongoose.Schema({
    startRange: { type: Number, required: true },
    endRange: { type: Number, required: true },
    coins: { type: Number, required: true }
}, {
    timestamps: true
});

const CoinsModel = mongoose.model("Coins", CoinsSchema);

module.exports = CoinsModel;

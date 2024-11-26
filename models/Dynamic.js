const mongoose = require('mongoose');

const DynamicSchema = new mongoose.Schema({
    page: {
        type: String,
        required: true
    },
    dynamic: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    coinValue: {
        type: String
    },
    dates: [String],
    time: [String],
    GST: { type: Number },
    state: { type: String }

});

const DynamicModel = mongoose.model("Dynamic", DynamicSchema);

module.exports = DynamicModel;
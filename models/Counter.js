const mongoose = require('mongoose')

const counterSchema = new mongoose.Schema({
    name: { type: String },
    sequence_value: { type: Number }
})

const CounterModel = mongoose.model('Counter', counterSchema)

module.exports = CounterModel
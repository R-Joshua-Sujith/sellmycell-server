const mongoose = require('mongoose');

const SectionSchemaOne = new mongoose.Schema({
    heading: String,
    image: String,
    buttonLink: String,
    buttonText: String
})

const HomeSchema = new mongoose.Schema({
    sectionOne: [SectionSchemaOne],
    sectionTwo: [SectionSchemaOne]
})

const HomeModel = mongoose.model('Home', HomeSchema);

module.exports = HomeModel;

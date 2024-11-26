const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  category_type: {
    type: String,
    required: true,
    unique: true
  },
  categoryImage: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  sections: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  }
}, {
  timestamps: true
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;

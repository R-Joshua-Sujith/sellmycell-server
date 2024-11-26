const express = require('express');
const router = express.Router();
const Category = require('../models/Category'); // Import your Mongoose model
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv");
const { adminVerify } = require("../middleware/auth")

dotenv.config();

const secretKey = process.env.JWT_SECRET_KEY


// Handle POST request to create a new category
router.post('/create', adminVerify, async (req, res) => {
  try {
    // Extract data from the request body
    let { category_type, categoryImage, sections, slug } = req.body;

    // Convert the name and slug to lowercase for case-insensitive comparison
    category_type = category_type.toLowerCase();

    // Check if a category with the same name already exists
    const existingNameCategory = await Category.findOne({ category_type });
    if (existingNameCategory) {
      return res.status(400).json({ error: 'Category with the same name already exists' });
    }

    // Create a new Category document
    const newCategory = new Category({
      category_type,
      categoryImage,
      slug,
      sections,
    });

    // Save the document to the database
    await newCategory.save();

    // Respond with the saved category
    res.status(200).json({ message: 'Category created successfully' });
  } catch (error) {
    console.log(error)
    // Handle errors
    if (error.code === 11000 && error.keyPattern && error.keyPattern.category_type) {
      res.status(400).json({ error: 'Category already exists' })
    } else if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      res.status(400).json({ error: "Slug should be unique for each category" })
    }
    else {
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
});

router.get("/get-all-category-types", async (req, res) => {
  try {
    // Fetch all categories from the database and select only the category_type field
    const allCategoryTypes = await Category.find().select('_id category_type ');
    // Extract the category_type values from the array of documents
    // Respond with the array of category_type values
    res.status(200).json(allCategoryTypes);
  } catch (error) {
    // Handle errors
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Handle PUT request to edit a category by ID
router.put('/edit-category/:categoryId', adminVerify, async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const { category_type, sections, slug, categoryImage } = req.body;

    // Convert the name and slug to lowercase for case-insensitive comparison
    const lowercasedName = category_type.toLowerCase();

    // Check if a category with the same name already exists (excluding the current category being edited)
    const existingNameCategory = await Category.findOne({ category_type: lowercasedName, _id: { $ne: categoryId } });
    if (existingNameCategory) {
      return res.status(400).json({ error: 'Category with the same name already exists' });
    }

    // Find the category by ID and update its fields
    const updatedCategory = await Category.findByIdAndUpdate(categoryId, {
      category_type: lowercasedName,
      slug,
      sections,
      categoryImage
    }, { new: true });

    // Check if the category with the given ID exists
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the updated category
    res.json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
    console.log(error)
    // Handle errors
    if (error.code === 11000 && error.keyPattern && error.keyPattern.category_type) {
      res.status(400).json({ error: 'Category already exists' });
    } else if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      res.status(400).json({ error: 'Slug should be unique for each category' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});



router.get('/fetch-all-categories', async (req, res) => {
  try {
    const categories = await Category.find({}, '_id name');
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.delete('/delete/:categoryId', adminVerify, async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Attempt to find and delete the category by ID
    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    // Check if the category was found and deleted
    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetch-category-id/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    // Find the category by ID
    const category = await Category.findById(categoryId);

    // Check if the category with the given ID exists
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the category
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetch-category-name/:categoryName', async (req, res) => {
  try {
    const categoryName = req.params.categoryName;

    // Find the category by name
    const category = await Category.findOne({ category_type: categoryName });

    // Check if the category with the given name exists
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the category
    res.status(200).json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetch-category-slug/:categorySlug', async (req, res) => {
  try {
    const categorySlug = req.params.categorySlug;

    // Find the category by name
    const category = await Category.findOne({ slug: categorySlug });

    // Check if the category with the given name exists
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the category
    res.status(200).json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.get('/get-all-categories', async (req, res) => {
  try {
    const { page = 1, pageSize = 5, search = '' } = req.query;
    const skip = (page - 1) * pageSize;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const allCategories = await Category.find(query)
      .select('category_type slug sections categoryImage') // Include the 'sections' field in the selection
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    const totalOrders = await Category.countDocuments(query);

    // Create a new array with only the count of sections for each category
    const sectionCounts = allCategories.map(category => ({
      id: category._id,
      category_type: category.category_type,
      slug: category.slug,
      sectionCount: category.sections ? category.sections.length : 0,
      categoryImage: category.categoryImage
    }));

    res.status(200).json({
      totalRows: totalOrders,
      data: sectionCounts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;

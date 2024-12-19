const router = require("express").Router();
const express = require("express");
const CategoryModel = require("../models/Category");
const ProductModel = require("../models/Item");
const BrandModel = require("../models/Brand");
const multer = require("multer");
const XLSX = require("xlsx");
const axios = require("axios");
const { adminVerify } = require("../middleware/auth");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Set the destination folder
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use the original filename
  },
});

const upload2 = multer({ storage: storage2 });

router.post(
  "/create-productss",
  adminVerify,
  upload2.single("productImage"),
  async (req, res) => {
    try {
      const {
        basePrice,
        variant,
        brandName,
        seriesName,
        categoryType,
        model,
        dynamicFields,
        bestSelling,
        estimatedPrice,
        slug,
      } = req.body;
      const dynamicFieldsArray = JSON.parse(dynamicFields);

      const productImage = req.file.originalname;
      const existingProduct = await ProductModel.findOne({ slug });
      if (existingProduct) {
        return res.status(400).json({ error: "Slug should be unique" });
      }

      const newProduct = new ProductModel({
        slug,
        productImage,
        basePrice,
        variant,
        brandName,
        seriesName,
        categoryType,
        model,
        dynamicFields: dynamicFieldsArray,
        bestSelling,
        estimatedPrice,
      });
      await newProduct.save();
      res.status(200).json({ message: "Product created successfully" });
    } catch (error) {
      console.log(error);
      if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
        res.status(400).json({ error: "Slug should be unique" });
      } else {
        res.status(500).json({ error: "Internal Server error" });
      }
    }
  }
);

router.get("/product-slug/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const product = await ProductModel.findOne({ slug: slug }).exec();
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Assuming you have your ProductModel and app.post('/create-products') code above

// Add a new route to get products based on categoryType and brandName

router.get("/get-products-slug/:categorySlug/:brandName", async (req, res) => {
  try {
    const { categorySlug, brandName } = req.params;

    if (!categorySlug || !brandName) {
      return res.status(400).json({
        error: "Both categorySlug and brandName are required parameters",
      });
    }

    // Find the category based on the provided slug
    const category = await CategoryModel.findOne({ slug: categorySlug });

    if (!category) {
      return res
        .status(404)
        .json({ error: "Category not found for the specified slug" });
    }

    const categoryType = category.category_type;
    const brand = await BrandModel.findOne({ brandName });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }
    const products = await ProductModel.find({ categoryType, brandName });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server error" });
  }
});

router.get("/get-products/:categoryType/:brandName", async (req, res) => {
  try {
    const { categoryType, brandName } = req.params;

    if (!categoryType || !brandName) {
      return res.status(400).json({
        error: "Both categoryType and brandName are required parameters",
      });
    }

    const category = await CategoryModel.findOne({
      category_type: categoryType,
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if brandName exists in BrandModel
    const brand = await BrandModel.findOne({ brandName });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    const products = await ProductModel.find({ categoryType, brandName });
    res.status(200).json({
      data: products,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server error" });
    console.log(error);
  }
});

router.get(
  "/get-products/:categoryType/:brandName/:seriesName",
  async (req, res) => {
    try {
      const { categoryType, brandName, seriesName } = req.params;

      if (!categoryType || !brandName) {
        return res.status(400).json({
          error: "Both categoryType and brandName are required parameters",
        });
      }

      const category = await CategoryModel.findOne({
        category_type: categoryType,
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Check if brandName exists in BrandModel
      const brand = await BrandModel.findOne({ brandName });

      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }

      const products = await ProductModel.find({
        categoryType,
        brandName,
        seriesName,
      });
      res.status(200).json({
        data: products,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal Server error" });
      console.log(error);
    }
  }
);

// router.get('/best-selling-products/:categoryType', async (req, res) => {
//     try {
//         const { categoryType } = req.params;

//         if (!categoryType) {
//             return res.status(400).json({ error: 'Category Type is required' });
//         }

//         // Find the top 5 products with the highest basePrice
//         const products = await ProductModel.find({ categoryType, bestSelling: "true" })
//             .sort({ basePrice: -1 }); // Sort in descending order of basePrice
//         // .limit(5); // Limit the results to 5

//         res.json(products);
//     } catch (error) {
//         res.status(500).json({ error: 'Internal Server error' });
//     }
// });

router.get("/best-selling-products/:categoryType", async (req, res) => {
  try {
    const { categoryType } = req.params;

    if (!categoryType) {
      return res.status(400).json({ error: "Category Type is required" });
    }
    const category = await CategoryModel.findOne(
      { category_type: categoryType },
      "slug"
    );

    // Find the top 5 products with the highest basePrice
    const products = await ProductModel.find({
      categoryType,
      bestSelling: "true",
    }).sort({ basePrice: -1 });

    res.json({ products, category });
  } catch (error) {
    res.status(500).json({ error: "Internal Server error" });
  }
});

router.get("/get-all-products", async (req, res) => {
  try {
    const category = await CategoryModel.findOne(
      { category_type: "mobile" },
      "slug"
    );
    const { page = 1, pageSize = 5, search = "" } = req.query;
    const skip = (page - 1) * pageSize;

    // Use a regular expression to make the search case-insensitive and partial
    const searchRegex = new RegExp(search, "i");

    const query = {
      $or: [
        { brandName: searchRegex },
        { seriesName: searchRegex },
        { model: searchRegex },
        { variant: searchRegex },
        { bestSelling: searchRegex },
      ],
    };

    const projection = { dynamicFields: 0 };

    const allProducts = await ProductModel.find(query, projection)
      .skip(skip)
      .limit(parseInt(pageSize));
    const totalProducts = await ProductModel.countDocuments(query);

    res.json({
      totalRows: totalProducts,
      data: allProducts,
      category,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/global-search", async (req, res) => {
  try {
    const { search = "" } = req.query;

    // Use a regular expression to make the search case-insensitive and partial
    const searchRegex = new RegExp(search, "i");

    const query = {
      $or: [
        { brandName: searchRegex },
        { seriesName: searchRegex },
        { model: searchRegex },
        { variant: searchRegex },
        { bestSelling: searchRegex },
      ],
    };

    const allProducts = await ProductModel.find(query);
    const totalProducts = allProducts.length; // Total count without pagination

    res.json({
      totalRows: totalProducts,
      data: allProducts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/products/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/update-product/:productId", adminVerify, async (req, res) => {
  const { productId } = req.params;
  const updateData = req.body;
  const dynamicFieldsArray = JSON.parse(req.body.dynamicFields);

  try {
    // Find the product by _id
    const existingProduct = await ProductModel.findById(productId);

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    existingProduct.basePrice = updateData.basePrice;
    existingProduct.variant = updateData.variant;
    existingProduct.brandName = updateData.brandName;
    existingProduct.seriesName = updateData.seriesName;
    existingProduct.categoryType = updateData.categoryType;
    existingProduct.model = updateData.model;
    existingProduct.bestSelling = updateData.bestSelling;
    existingProduct.dynamicFields = dynamicFieldsArray;
    existingProduct.estimatedPrice = updateData.estimatedPrice;
    existingProduct.slug = updateData.slug;

    // Save the updated product
    const updatedProduct = await existingProduct.save();

    res.json(updatedProduct);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      res.status(400).json({ error: "Slug should be unique" });
    } else {
      res.status(500).json({ error: "Internal Server error" });
    }
  }
});

router.put(
  "/update-product-image/:productId",
  upload2.single("productImage"),
  async (req, res) => {
    const { productId } = req.params;

    try {
      // Find the product by _id
      const existingProduct = await ProductModel.findById(productId);

      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Update the product image only if a new image is provided
      if (req.file) {
        existingProduct.productImage = req.file.originalname;
      }

      // Save the updated product
      const updatedProduct = await existingProduct.save();

      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete("/delete-product/:productId", adminVerify, async (req, res) => {
  const { productId } = req.params;

  try {
    // Find and remove the product by _id
    const deletedProduct = await ProductModel.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// router.post('/api/products/bulk-upload', adminVerify, upload.single('file'), async (req, res) => {
//     try {
//         const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
//         const sheet = workbook.Sheets[workbook.SheetNames[0]];
//         const excelData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

//         // Check for empty Excel data
//         if (excelData.length === 0) {
//             return res.status(400).json({ error: 'Excel data is empty.' });
//         }
//         const allHeaders = excelData[0];

//         const dynamic = allHeaders.filter((item) => !['_id', 'categoryType', 'brandName', 'seriesName', 'model', 'variant', 'slug', 'basePrice', 'estimatedPrice', 'productImage', 'bestSelling'].includes(item));

//         for (const row of excelData.slice(1)) {
//             const uniqueIdentifier = row[0];
//             const existingItem = await ProductModel.findOne({ _id: uniqueIdentifier })
//             const dynamicOptions = [];
//             let i = 11;
//             for (let x of dynamic) {
//                 dynamicOptions.push({
//                     optionHeading: x,
//                     optionValue: row[i]
//                 })
//                 i++;
//             }
//             if (existingItem) {
//                 console.log(existingItem.variant)
//                 console.log(existingItem.slug)
//                 existingItem.categoryType = row[1].trim();
//                 existingItem.brandName = row[2].trim();
//                 existingItem.seriesName = row[3].trim();
//                 existingItem.model = row[4].trim();
//                 existingItem.variant = row[5].trim();
//                 existingItem.slug = row[6].trim();
//                 existingItem.basePrice = row[7];
//                 existingItem.estimatedPrice = row[8]
//                 existingItem.productImage = row[9];
//                 existingItem.bestSelling = row[10];
//                 existingItem.dynamicFields = dynamicOptions;

//                 await existingItem.save();
//             } else {
//                 console.log(row[6])
//                 const newProduct = new ProductModel({
//                     categoryType: row[1]?.trim(),
//                     brandName: row[2]?.trim(),
//                     seriesName: row[3]?.trim(),
//                     model: row[4]?.trim(),
//                     variant: row[5]?.trim(),
//                     slug: row[6]?.trim(),
//                     basePrice: row[7],
//                     estimatedPrice: row[8],
//                     productImage: row[9],
//                     bestSelling: row[10],
//                     dynamicFields: dynamicOptions,
//                 })
//                 await newProduct.save();
//             }
//         }

//         res.status(200).json({ message: 'Bulk upload successful' });
//     } catch (error) {
//         console.error('Error during bulk upload:', error.message);
//         res.status(500).json({ error: 'Internal Server Error', details: error.message });
//     }
// });

router.post(
  "/api/products/bulk-upload",
  adminVerify,
  upload.single("file"),
  async (req, res) => {
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const excelData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Check for empty Excel data
      if (excelData.length === 0) {
        return res.status(400).json({ error: "Excel data is empty." });
      }
      const allHeaders = excelData[0];

      const dynamic = allHeaders.filter(
        (item) =>
          ![
            "_id",
            "categoryType",
            "brandName",
            "seriesName",
            "model",
            "variant",
            "slug",
            "basePrice",
            "estimatedPrice",
            "productImage",
            "bestSelling",
          ].includes(item)
      );

      for (const row of excelData.slice(1)) {
        const uniqueIdentifier = row[0];
        // Skip if categoryType is empty (null, undefined, or empty string after trimming)
        if (!row[1] || row[1].toString().trim() === "") {
          console.log("Empty categoryType detected - ending processing");
          break; // Exit the loop as we've reached the end of valid data
        }

        const existingItem = await ProductModel.findOne({
          _id: uniqueIdentifier,
        });
        const dynamicOptions = [];
        let i = 11;
        for (let x of dynamic) {
          dynamicOptions.push({
            optionHeading: x,
            optionValue: row[i],
          });
          i++;
        }

        if (existingItem) {
          existingItem.categoryType = row[1].trim();
          existingItem.brandName = row[2]?.trim();
          existingItem.seriesName = row[3]?.trim();
          existingItem.model = row[4]?.trim();
          existingItem.variant = row[5]?.trim();
          existingItem.slug = row[6]?.trim();
          existingItem.basePrice = row[7];
          existingItem.estimatedPrice = row[8];
          existingItem.productImage = row[9];
          existingItem.bestSelling = row[10];
          existingItem.dynamicFields = dynamicOptions;

          await existingItem.save();
        } else {
          const newProduct = new ProductModel({
            categoryType: row[1].trim(),
            brandName: row[2]?.trim(),
            seriesName: row[3]?.trim(),
            model: row[4]?.trim(),
            variant: row[5]?.trim(),
            slug: row[6]?.trim(),
            basePrice: row[7],
            estimatedPrice: row[8],
            productImage: row[9],
            bestSelling: row[10],
            dynamicFields: dynamicOptions,
          });
          await newProduct.save();
        }
      }

      res.status(200).json({ message: "Bulk upload successful" });
    } catch (error) {
      console.error("Error during bulk upload:", error.message);
      res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  }
);

// router.get(
//   "/api/products/bulk-download/:categoryType",
//   adminVerify,
//   async (req, res) => {
//     try {
//       // Fetch all products from the database
//       const categoryType = req.params.categoryType;
//       if (!categoryType) {
//         return res.status(400).json({
//           error: "Category type is required in the route parameters.",
//         });
//       }
//       const products = await ProductModel.find({ categoryType });
//       // Check if there are any products
//       if (products.length === 0) {
//         return res
//           .status(404)
//           .json({ error: "No products found for bulk download." });
//       }

//       // Create an array to store Excel data
//       const excelData = [];

//       // Add headers to the Excel data
//       const headers = [
//         "_id",
//         "categoryType",
//         "brandName",
//         "seriesName",
//         "model",
//         "variant",
//         "slug",
//         "basePrice",
//         "estimatedPrice",
//         "productImage",
//         "bestSelling",
//       ];

//       // Assuming dynamicFields is an array in each product document
//       if (products[0].dynamicFields) {
//         products[0].dynamicFields.forEach((dynamicField) => {
//           headers.push(dynamicField.optionHeading);
//         });
//       }

//       excelData.push(headers);

//       // Add product data to the Excel data
//       products.forEach((product) => {
//         const rowData = [
//           product._id.toString(),
//           product.categoryType,
//           product.brandName,
//           product.seriesName,
//           product.model,
//           product.variant,
//           product.slug,
//           product.basePrice,
//           product.estimatedPrice,
//           product.productImage,
//           product.bestSelling,
//         ];

//         // Add dynamic field values to the row
//         if (product.dynamicFields) {
//           product.dynamicFields.forEach((dynamicField) => {
//             rowData.push(dynamicField.optionValue);
//           });
//         }

//         excelData.push(rowData);
//       });

//       // Create a worksheet
//       const ws = XLSX.utils.aoa_to_sheet(excelData);

//       // Create a workbook and add the worksheet
//       const wb = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

//       // Save the workbook to a file
//       const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

//       // Set headers for the response
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       res.setHeader(
//         "Content-Disposition",
//         "attachment; filename=bulk_download.xlsx"
//       );

//       // Send the Excel file as the response
//       res.send(excelBuffer);
//     } catch (error) {
//       console.error("Error during bulk download:", error.message);
//       res
//         .status(500)
//         .json({ error: "Internal Server Error", details: error.message });
//     }
//   }
// );

router.get(
  "/api/products/bulk-download/:categoryType",
  adminVerify,
  async (req, res) => {
    try {
      const categoryType = req.params.categoryType;
      if (!categoryType) {
        return res.status(400).json({
          error: "Category type is required in the route parameters.",
        });
      }

      // Fetch category document to get the latest fields
      const categoryResponse = await axios.get(
        `http://localhost:5000/api/category/fetch-category-name/${categoryType}`
      );
      const category = categoryResponse.data;

      if (!category) {
        return res.status(404).json({
          error: "Category not found for the given categoryType.",
        });
      }

      // Fetch products
      const products = await ProductModel.find({ categoryType });
      if (products.length === 0) {
        return res
          .status(404)
          .json({ error: "No products found for bulk download." });
      }

      // Initialize base headers
      const headers = [
        "_id",
        "categoryType",
        "brandName",
        "seriesName",
        "model",
        "variant",
        "slug",
        "basePrice",
        "estimatedPrice",
        "productImage",
        "bestSelling",
      ];

      // Add headers from category sections
      const dynamicHeaders = [];
      if (category.sections) {
        category.sections.forEach((section) => {
          section.options.forEach((option) => {
            dynamicHeaders.push(option.description);
          });
        });
      }

      // Combine all headers
      const allHeaders = [...headers, ...dynamicHeaders];
      const excelData = [allHeaders];

      // Add product data
      products.forEach((product) => {
        const rowData = [
          product._id.toString(),
          product.categoryType,
          product.brandName,
          product.seriesName,
          product.model,
          product.variant,
          product.slug,
          product.basePrice,
          product.estimatedPrice,
          product.productImage,
          product.bestSelling,
        ];

        // Add dynamic field values, matching them with headers
        dynamicHeaders.forEach((header) => {
          const dynamicField = product.dynamicFields?.find(
            (field) => field.optionHeading === header
          );
          rowData.push(dynamicField ? dynamicField.optionValue : 0);
        });

        excelData.push(rowData);
      });

      // Create a worksheet
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Create a workbook and add the worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // Save the workbook to a file
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      // Set headers for the response
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=bulk_download.xlsx"
      );

      // Send the Excel file as the response
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error during bulk download:", error.message);
      res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  }
);

router.get("/generate-excel/:categoryType", adminVerify, async (req, res) => {
  try {
    const categoryType = req.params.categoryType;

    // Make an API call to fetch the category document based on categoryType
    const response = await axios.get(
      `http://localhost:5000/api/category/fetch-category-name/${categoryType}`
    );
    const category = response.data;

    // Check if the category document is empty or undefined
    if (!category) {
      return res
        .status(404)
        .json({ error: "Category not found for the given categoryType." });
    }
    const headers = [
      "_id",
      "categoryType",
      "brandName",
      "seriesName",
      "model",
      "variant",
      "slug",
      "basePrice",
      "estimatedPrice",
      "productImage",
      "bestSelling",
    ];

    // Extract sections
    if (category.sections) {
      category.sections.forEach((section) => {
        section.options.forEach((option) => {
          headers.push(`${option.description}`);
        });
      });
    }

    // Create an empty worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Create a workbook and add the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Save the workbook to a file
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=excel_template.xlsx`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error fetching category document:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// router.post('/calculate-price', async (req, res) => {
//     const { categoryType, productSlug, selectedOptions } = req.body;
//     console.log(categoryType, productSlug, selectedOptions)
//     try {
//         const product = await ProductModel.findOne(({ slug: productSlug })).exec();
//         if (product) {
//             const productOptions = product.dynamicFields;
//             let basePrice = product.basePrice;

//             // Iterate through selectedOptions and adjust base price accordingly
//             selectedOptions.forEach(selectedOption => {
//                 // Find the corresponding option in productOptions
//                 const correspondingOption = productOptions.find(option =>
//                     option.optionHeading === selectedOption.description
//                 );

//                 if (correspondingOption) {
//                     // Check if the selected option has a value field
//                     if ('value' in selectedOption) {
//                         // If value is false, subtract optionValue from base price
//                         if (!selectedOption.value) {
//                             basePrice -= parseInt(correspondingOption.optionValue);
//                         }
//                         // If value is true, do nothing
//                     } else {
//                         // If type is add, add optionValue to base price
//                         if (selectedOption.type === 'add') {
//                             basePrice += parseInt(correspondingOption.optionValue);
//                         }
//                         // If type is sub, subtract optionValue from base price
//                         else if (selectedOption.type === 'sub') {
//                             basePrice -= parseInt(correspondingOption.optionValue);
//                         }
//                     }
//                 }
//             });

//             // Return the updated base price
//             res.json({ basePrice });
//             console.log(basePrice)
//         } else {
//             res.status(404).json({ error: 'Product not found' });
//         }
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Internal Server error' });
//     }
// });

router.post("/calculate-price", async (req, res) => {
  const { categoryType, productSlug, selectedOptions } = req.body;
  console.log(categoryType, productSlug, selectedOptions);
  try {
    const product = await ProductModel.findOne({ slug: productSlug }).exec();
    if (product) {
      const productOptions = product.dynamicFields;
      let basePrice = product.basePrice;

      // Iterate through selectedOptions and adjust base price accordingly
      selectedOptions.forEach((selectedOption) => {
        // Find the corresponding option in productOptions
        const correspondingOption = productOptions.find(
          (option) => option.optionHeading === selectedOption.description
        );

        if (correspondingOption) {
          // Check if the selected option has a value field
          if ("value" in selectedOption) {
            if (selectedOption.value === false) {
              basePrice -= parseInt(correspondingOption.optionValue);
            } else if (selectedOption.value === null) {
              if (selectedOption.type === "add") {
                basePrice += parseInt(correspondingOption.optionValue);
              } else if (selectedOption.type === "sub") {
                basePrice -= parseInt(correspondingOption.optionValue);
              }
            }
            // If value is true, do nothing
          } else {
            // If type is add, add optionValue to base price
            if (selectedOption.type === "add") {
              basePrice += parseInt(correspondingOption.optionValue);
            }
            // If type is sub, subtract optionValue from base price
            else if (selectedOption.type === "sub") {
              basePrice -= parseInt(correspondingOption.optionValue);
            }
          }
        }
      });

      if (basePrice < 0) {
        basePrice = 0;
      }
      // Return the updated base price
      res.json({ basePrice: parseInt(basePrice) });
      console.log(basePrice);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server error" });
  }
});

module.exports = router;

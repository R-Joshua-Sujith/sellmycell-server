const express = require('express');
const router = express.Router();
const MiscellaenousModel = require("../models/")

router.get('/getHomePage', async (req, res) => {
    try {
        const pageName = "Home Page"; // Name of the page you want to fetch
        const pageData = await MiscellaenousModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(pageData);
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put('/editHomePage', async (req, res) => {
    try {
        const pageName = "Home Page"; // Name of the page you want to edit
        const newData = req.body; // New data to be updated

        const updatedPage = await MiscellaenousModel.findOneAndUpdate(
            { page: pageName },
            { dynamic: newData },
            { new: true }
        );

        if (!updatedPage) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(updatedPage);
    } catch (error) {
        console.error('Error updating page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
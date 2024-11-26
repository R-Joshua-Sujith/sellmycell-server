const express = require('express');
const router = express.Router();
const DynamicModel = require('../models/Dynamic')

router.get('/getHomePage', async (req, res) => {
    try {
        const pageName = "Home Page"; // Name of the page you want to fetch
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(pageData);
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/mobile/getHomePage', async (req, res) => {
    try {
        const pageName = "Home Page"; // Name of the page you want to fetch
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        const dynamicSections = pageData.dynamic
        res.json(dynamicSections);
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put('/editHomePage', async (req, res) => {
    try {
        const pageName = "Home Page"; // Name of the page you want to edit
        const newData = req.body; // New data to be updated

        const updatedPage = await DynamicModel.findOneAndUpdate(
            { page: pageName },
            {
                dynamic: {
                    sectionOne: newData.sectionOne,
                    sectionTwo: newData.sectionTwo
                }
            },
            { new: true }
        );

        if (!updatedPage) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(updatedPage);
    } catch (error) {
        console.log(error)
        console.error('Error updating page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/calendar', async (req, res) => {
    try {
        const pageName = "Calendar"; // Name of the page you want to fetch
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }
        res.json(pageData);
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/calendar/toggle-date', async (req, res) => {
    try {
        const { date } = req.body; // Assuming date is sent in the request body

        const pageName = "Calendar"; // Name of the page you want to update
        let pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        const index = pageData.dates.indexOf(date);
        if (index !== -1) {
            // Date exists, remove it
            pageData.dates.splice(index, 1);
            await pageData.save();
            res.json({ message: 'Date Unblocked', pageData });
        } else {
            // Date doesn't exist, add it
            pageData.dates.push(date);
            await pageData.save();
            res.json({ message: 'Date Blocked', pageData });
        }

        // Save the updated document

    } catch (error) {
        console.error('Error toggling date:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/calendar/next-10-days', async (req, res) => {
    try {
        const today = new Date(); // Get today's date
        today.setHours(0, 0, 0, 0); // Set time to midnight
        const next10Days = []; // Array to store next 10 days

        // Generate next 10 days with time set to midnight
        for (let i = 0; i < 10; i++) {
            const nextDay = new Date(today);
            nextDay.setDate(today.getDate() + i);
            next10Days.push(nextDay.toDateString()); // Store in ISO 8601 format
        }

        // Find page data
        const pageName = "Calendar"; // Name of the page
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // Filter out the dates already present in the 'dates' array
        const availableDays = next10Days.filter(day => !pageData.dates.includes(day));


        const options = {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'long'
        };

        const formattedDates = availableDays.map(dateString => {
            const date = new Date(dateString);
            return date.toLocaleString('en-IN', options);
        });



        res.json({ dates: formattedDates, time_slot: pageData.time });
    } catch (error) {
        console.error('Error fetching next 10 days:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/calendar/next-10-days-web', async (req, res) => {
    try {
        const today = new Date(); // Get today's date
        today.setHours(0, 0, 0, 0); // Set time to midnight
        const next10Days = []; // Array to store next 10 days

        // Generate next 10 days with time set to midnight
        for (let i = 0; i < 10; i++) {
            const nextDay = new Date(today);
            nextDay.setDate(today.getDate() + i);
            next10Days.push(nextDay.toDateString()); // Store in ISO 8601 format
        }
        console.log(next10Days)

        // Find page data
        const pageName = "Calendar"; // Name of the page
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // Filter out the dates already present in the 'dates' array
        const availableDays = next10Days.filter(day => !pageData.dates.includes(day));

        const options = {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'long'
        };

        const formattedDates = availableDays.map(dateString => {
            const date = new Date(dateString);
            return { value: date.toLocaleString('en-IN', options), label: date.toLocaleString('en-IN', options) };
        });

        const formattedTimeSlots = pageData.time.map(timeSlot => {
            return { value: timeSlot, label: timeSlot };
        });

        res.json({ dates: formattedDates, time_slot: formattedTimeSlots });
    } catch (error) {
        console.error('Error fetching next 10 days:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



router.post('/calendar/add-time', async (req, res) => {
    try {
        const { time } = req.body; // Assuming date is sent in the request body

        const pageName = "Calendar"; // Name of the page you want to update
        let pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // Add the date to the page data
        pageData.time = time;
        await pageData.save();

        res.json({ message: 'Date Added', pageData });

    } catch (error) {
        console.error('Error adding date:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/get-gst-value', async (req, res) => {
    try {
        const pageName = "GST PAGE"; // Name of the page you want to fetch
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json({
            gst: pageData.GST
        });
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put("/update-gst-value", async (req, res) => {
    const { gstValue } = req.body;
    try {
        // Find the document with coinValue
        let gst = await DynamicModel.findOne({ page: "GST PAGE" });


        // Update the coinValue
        gst.GST = gstValue;

        // Save the updated dynamic model
        await gst.save();

        res.json({ message: 'GST % Updated Successfully' });
    } catch (error) {
        console.error("Error updating coin value:", error);
        res.status(500).json({ error: 'Server error' });
    }
});


router.get('/getCompanyDetails', async (req, res) => {
    try {
        const pageName = "Company Details"; // Name of the page you want to fetch
        const pageData = await DynamicModel.findOne({ page: pageName });

        if (!pageData) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(pageData.state)
    } catch (error) {
        console.error('Error fetching page data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put("/update-state-name", async (req, res) => {
    const { state } = req.body;
    try {
        // Find the document with coinValue
        let company = await DynamicModel.findOne({ page: "Company Details" });


        // Update the coinValue
        company.state = state;

        // Save the updated dynamic model
        await company.save();

        res.json({ message: 'State Updated Successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const RequestModel = require("../models/Request");

// POST request handler to create a new document
router.post("/create-request", async (req, res) => {
    try {
        // Extracting data from the request body
        const { phone, name, email, address, state, gstIN, companyName, city } = req.body;

        // Create a new document using the RequestModel schema
        const newRequest = new RequestModel({
            phone,
            name,
            email,
            address,
            state,
            gstIN,
            companyName,
            city
        });

        // Save the new document to the database
        await newRequest.save();

        // Respond with success message
        res.status(201).json({ message: "Request created successfully", data: newRequest });
    } catch (error) {
        // If there's an error, respond with an error message
        res.status(500).json({ error: error.message });
    }
});

router.get('/get-all-requests', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        // Use a regular expression to make the search case-insensitive and partial
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { phone: searchRegex },
                { name: searchRegex },
                { email: searchRegex },
                { address: searchRegex },
                { state: searchRegex },
                { gstIN: searchRegex },
                { companyName: searchRegex }
            ],
        };

        const allRequests = await RequestModel.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(pageSize));

        // Format createdAt timestamps before sending response
        const formattedRequests = allRequests.map(request => {
            return {
                ...request.toObject(),
                createdAt: request.createdAt.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata' // Indian Standard Time
                })
            };
        });

        const totalRequests = await RequestModel.countDocuments(query);

        res.json({
            totalRows: totalRequests,
            data: formattedRequests,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
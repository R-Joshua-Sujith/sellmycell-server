const router = require("express").Router();
const PincodeModel = require("../models/PinCode");

router.post('/create/pincode', async (req, res) => {
    try {
        const pincodeData = req.body;
        const newPincode = new PincodeModel(pincodeData);
        const savedPincode = await newPincode.save();
        res.status(201).json(savedPincode);
    } catch (error) {
        console.error('Error saving pin code:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.get('/get-all-pincodes', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { stateName: searchRegex },
                { cityName: searchRegex },
            ],
        };

        const allPincodes = await PincodeModel.find(query).skip(skip).limit(parseInt(pageSize));
        const totalPincodes = await PincodeModel.countDocuments();

        res.json({
            totalRows: totalPincodes,
            data: allPincodes,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/get-pincode/:id', async (req, res) => {
    try {
        const pincodeId = req.params.id;

        const pincode = await PincodeModel.findById(pincodeId);

        if (!pincode) {
            return res.status(404).json({ error: 'Pincode not found' });
        }

        res.json(pincode);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/update-pincode/:id', async (req, res) => {
    try {
        const pincodeId = req.params.id;
        const updatedData = req.body;

        // Validate if the request body contains valid data
        if (!updatedData || Object.keys(updatedData).length === 0) {
            return res.status(400).json({ error: 'Invalid update data' });
        }

        // Find the pin code by ID and update it
        const updatedPincode = await PincodeModel.findByIdAndUpdate(
            pincodeId,
            updatedData,
            { new: true }
        );

        // Check if the pin code was found and updated
        if (!updatedPincode) {
            return res.status(404).json({ error: 'Pincode not found' });
        }

        res.json(updatedPincode);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/check-pincode/:pincode', async (req, res) => {
    try {
        const requestedPincode = req.params.pincode;

        // Use Mongoose to find if the pin code exists in any document
        const pincodeExists = await PincodeModel.exists({ 'pinCodes': { $in: [requestedPincode] } });

        res.json({ pincodeExists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/delete-pincode/:id', async (req, res) => {
    try {
        const pincodeId = req.params.id;

        // Use Mongoose to find and delete the pin code by ID
        const deletedPincode = await PincodeModel.findByIdAndDelete(pincodeId);

        if (!deletedPincode) {
            return res.status(404).json({ message: 'Pin code not found' });
        }

        res.json({ message: 'Pin code deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/cityNames', async (req, res) => {
    try {
        const uniqueCityNames = await PincodeModel.distinct('cityName');
        res.status(200).json(uniqueCityNames);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/city/:cityName/pincodes', async (req, res) => {
    const { cityName } = req.params;
    try {
        const pinCodes = await PincodeModel.find({ cityName });
        res.status(200).json(pinCodes);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/drop-down/cityNames', async (req, res) => {
    try {
        const uniqueCityNames = await PincodeModel.distinct('cityName');
        const formattedData = uniqueCityNames.map(cityName => ({
            value: cityName,
            label: cityName // or any other property you want to use as the label
        }));
        res.json(formattedData);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/drop-down/city/:cityName/pincodes', async (req, res) => {
    const { cityName } = req.params;
    try {
        const city = await PincodeModel.find({ cityName });
        const formattedData = city[0].pinCodes.map(pin => ({
            value: pin,
            label: pin // or any other property you want to use as the label
        }));
        res.json(formattedData);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;
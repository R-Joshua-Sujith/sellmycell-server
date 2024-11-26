const router = require("express").Router();
const ContactModel = require("../models/Contact")


router.post('/create', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        const newContact = new ContactModel({ name, email, phone, message });
        await newContact.save();
        res.status(201).json({ message: 'Contact saved successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Error saving contact', error: error.message });
    }
});


router.get('/get-all-contacts', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { message: searchRegex }
            ],
        };

        const allContacts = await ContactModel.find(query).skip(skip).limit(parseInt(pageSize));
        const totalContacts = await ContactModel.countDocuments(query);

        res.json({
            totalRows: totalContacts,
            data: allContacts,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
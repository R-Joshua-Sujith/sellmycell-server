const router = require("express").Router();
const PromoCodeModel = require("../models/PromoCode")
const UserModel = require("../models/User")
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY

const verify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(401).json({ error: "Session Expired" });
            }
            req.user = user;
            next();
        })
    } else {
        res.status(400).json({ error: "You are not authenticated" });
    }
}


router.post('/create/promocode', async (req, res) => {
    try {
        const promoCodeData = req.body;
        const newPromoCode = new PromoCodeModel(promoCodeData);
        const savedPromoCode = await newPromoCode.save();
        res.status(201).json(savedPromoCode);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.code) {
            res.status(400).json({ error: "Promo Code already exists" });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.get('/get-all-promocode', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { code: searchRegex },
            ],
        }

        const allPromoCode = await PromoCodeModel.find(query).skip(skip).limit(parseInt(pageSize));
        const totalPromoCode = await PromoCodeModel.countDocuments();

        res.json({
            totalRows: totalPromoCode,
            data: allPromoCode,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/promoCode/:id', async (req, res) => {
    try {
        const promoCode = await PromoCodeModel.findById(req.params.id);

        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        return res.json(promoCode);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.put('/update/promocode/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discountAmount } = req.body;

        const updatedPromoCode = await PromoCodeModel.findByIdAndUpdate(
            id,
            { code, discountAmount },
            { new: true } // returns the updated document
        );

        if (!updatedPromoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        res.json(updatedPromoCode);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.code) {
            res.status(400).json({ error: "Promo Code already exists" });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.delete('/delete/promocode/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deletedPromoCode = await PromoCodeModel.findByIdAndDelete(id);

        if (!deletedPromoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        res.json({ message: 'Promo code deleted successfully' });
    } catch (error) {
        console.error('Error deleting promo code:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.post('/check/promocode', verify, async (req, res) => {
    if (req.user.phone === req.body.phone) {
        try {
            const { enteredCode, phone } = req.body;

            // Find the promo code in the database
            const promoCode = await PromoCodeModel.findOne({ code: enteredCode });

            if (!promoCode) {
                return res.status(404).json({ error: 'Invalid promo code' });
            }

            // Check if the promo code is already used by the user
            const user = await UserModel.findOne({ phone: phone, promoCodes: enteredCode });

            if (user) {
                return res.status(409).json({ error: 'Promo code already used by this user' });
            }

            // If the promo code is valid and not used by the user, return its value
            res.json({ value: promoCode.discountAmount, message: 'Promo Code Applied Successfully' });
        } catch (error) {
            console.error('Error checking promo code validity:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});
module.exports = router;
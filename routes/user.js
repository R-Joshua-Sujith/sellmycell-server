const router = require("express").Router();
const UserModel = require("../models/User");
const dotenv = require("dotenv");
const axios = require("axios")
const jwt = require("jsonwebtoken");

dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY
const authkey = process.env.MSG91_AUTH_KEY
const sendOTP_Template_id = process.env.MSG91_TEMPLATE_ID_SEND_OTP

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

router.post('/login', async (req, res) => {
    try {
        const { phone } = req.body;

        // Check if the user with the provided phone number exists
        let user = await UserModel.findOne({ phone });
        const payload = {
            phone: phone,
        }

        const token = jwt.sign(payload, secretKey);

        if (user) {
            // If user exists, send a success response with the user details
            return res.status(200).json({ user, token });
        } else {
            // If user doesn't exist, create a new user with the provided phone number
            user = new UserModel({ phone });
            await user.save();

            // Send a success response with the newly created user details
            return res.status(201).json({ user, token });
        }
    } catch (error) {
        // If any error occurs, send an error response
        console.error('Error in user login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/api/users/:phone', async (req, res) => {
    const { phone } = req.params;
    const { firstName, lastName, email, addPhone, address, zipCode, city } = req.body;

    try {
        // Find the user by email
        const existingUser = await UserModel.findOne({ phone });

        if (existingUser) {
            // Update the existing user's information
            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.email = email;
            existingUser.addPhone = addPhone || '';
            existingUser.address = address;
            existingUser.zipCode = zipCode;
            existingUser.city = city;

            await existingUser.save();
            res.status(200).json({ message: 'User information updated successfully.' });
        } else {
            // Create a new user if not exists
            const newUser = new UserModel({
                email,
                firstName,
                lastName,
                phone,
                addPhone: addPhone || '',
                address,
                zipCode,
                city,
            });

            await newUser.save();
            res.status(201).json({ message: 'User created successfully.' });
        }
    } catch (error) {
        console.error('Error storing user information:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/api/users-fill/:email', async (req, res) => {
    const { email } = req.params;
    const { firstName, lastName, phone, addPhone, address, zipCode, city } = req.body;

    try {
        // Find the user by email
        const existingUser = await UserModel.findOne({ email });

        if (existingUser) {
            // Update the existing user's information
            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.phone = phone;
            existingUser.addPhone = addPhone || '';


            await existingUser.save();
            res.status(200).json({ message: 'User information updated successfully.' });
        } else {
            // Create a new user if not exists
            const newUser = new UserModel({
                email,
                firstName,
                lastName,
                phone,
                addPhone: addPhone || '',

            });

            await newUser.save();
            res.status(201).json({ message: 'User created successfully.' });
        }
    } catch (error) {
        console.error('Error storing user information:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/api/users/:phone', async (req, res) => {
    const { phone } = req.params;

    try {
        // Find the user by email
        const user = await UserModel.findOne({ phone });

        if (user) {
            const userData = {
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                addPhone: user.addPhone,
                address: user.address,
                zipCode: user.zipCode,
                city: user.city,
                email: user.email
            };

            res.status(200).json(userData);
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error('Error fetching user information:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});




router.delete('/delete/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Check if the user exists
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete the user
        await UserModel.findByIdAndDelete(userId);

        return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/api/users/:phone/city', async (req, res) => {
    try {
        const phone = req.params.phone;
        const newCity = req.body.city;

        // Find the user by ID
        const user = await UserModel.findOne({ phone });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the city field
        user.city = newCity;

        // Save the updated user
        await user.save();

        res.json({ message: 'City updated successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/api/users/:phone/city', async (req, res) => {
    try {
        const phone = req.params.phone;

        // Find the user by ID and select only the city field
        const user = await UserModel.findOne({ phone }).select('city');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ city: user.city });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/api/user/promo-status/:email', async (req, res) => {
    try {
        const { email } = req.params;

        // Find the user by email
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Respond with the promoStatus
        res.json({ promoStatus: user.promoStatus });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

const sendSMS = async (mobileNumber) => {
    try {
        const otp = Math.floor(1000 + Math.random() * 9000);
        const otpExpiry = Date.now() + 600000;
        const apiUrl = 'https://control.msg91.com/api/v5/flow/';
        const headers = {
            "authkey": authkey
        }
        const response = await axios.post(apiUrl,
            {
                "template_id": sendOTP_Template_id,
                "short_url": "0",
                "recipients": [
                    {
                        "mobiles": mobileNumber,
                        "otp": otp
                    }
                ]
            }
            , { headers })
        console.log(response.data);
        // Check if the response indicates success
        if (response.status === 200 && response.data && response.data.type === "success") {
            return { otp, otpExpiry };
        } else {
            // Handle error or failure to send OTP
            throw new Error("Failed to send OTP");
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};


router.post('/send-sms', async (req, res) => {
    const { mobileNumber } = req.body;
    const formattedMobileNumber = `91${mobileNumber}`;
    try {
        let user = await UserModel.findOne({ phone: mobileNumber });
        if (user?.status === "deleted") {
            return res.status(500).json({ error: "You have deleted your account, can't login" })

        }
        if (!user) {
            user = new UserModel({ phone: mobileNumber })
        }
        // const result = await sendSMS(formattedMobileNumber);
        // if (result && result.otp && result.otpExpiry) {
        //     const { otp, otpExpiry } = result;

        //     user.otp = otp;
        //     // user.otp = "1234"
        //     user.otpExpiry = otpExpiry;
        //     await user.save();
        //     res.json({ message: "OTP Sent Successfully" });
        // } else {
        //     res.status(500).json({ error: 'Failed to send OTP' });
        // }
        const otpExpiry = Date.now() + 600000;
        user.otp = "1234"
        user.otpExpiry = otpExpiry;
        await user.save();
        res.status(200).json({message:"OTP Sent Successfully"})
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

router.post('/web-sms-login', async (req, res) => {
    try {
        const { otp, phone } = req.body;

        // Find user by reset token, OTP, and email
        const user = await UserModel.findOne({
            phone,
            otp,
            otpExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        const payload = {
            phone: phone,
        }

        const token = jwt.sign(payload, secretKey);

        user.otp = "";
        user.otpExpiry = "";

        await user.save();
        return res.status(201).json({ user, token })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
});


router.post('/sms-login', async (req, res) => {
    try {
        const { otp, phone, deviceToken } = req.body;

        // Find user by reset token, OTP, and email
        const user = await UserModel.findOne({
            phone,
            otp,
            otpExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        const payload = {
            phone: phone,
        }

        const token = jwt.sign(payload, secretKey);

        user.otp = "";
        user.otpExpiry = "";
        user.token = deviceToken,

            await user.save();
        return res.status(201).json({ user, token })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
});

router.post('/account-deletion', verify, async (req, res) => {
    if (req.user.phone === req.body.phone) {
        try {
            const { otp, phone } = req.body;

            // Find user by reset token, OTP, and email
            const user = await UserModel.findOne({
                phone,
                otp,
                otpExpiry: { $gt: Date.now() },
            });

            if (!user) {
                return res.status(400).json({ error: 'Invalid OTP' });
            }

            user.status = "deleted"
            user.otp = ""
            user.otpExpiry = ""

            await user.save();
            return res.status(201).json({ message: "Account Deleted Successfully" })
        } catch (error) {
            res.status(500).json({ error: "Server Error" })
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }
});



router.post('/users/add-address', verify, async (req, res) => {
    if (req.user.phone === req.body.phone) {
        try {
            const { phone, address } = req.body;

            // Find the user by phone number
            const user = await UserModel.findOne({ phone });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }

            // Add the address to the user's address array
            user.address.push(address);

            // Save the updated user
            await user.save();

            res.status(200).json({ message: 'Address added successfully', user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server Error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});

router.delete('/users/delete-address/:phone/:index', verify, async (req, res) => {
    if (req.user.phone === req.params.phone) {
        try {
            const { phone, index } = req.params;
            // Find the user by phone number
            const user = await UserModel.findOne({ phone });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }

            // Check if the index is valid
            if (index < 0 || index >= user.address.length) {
                return res.status(400).json({ error: 'Invalid address index' });
            }

            // Remove the address at the specified index
            user.address.splice(index, 1);

            // Save the updated user
            await user.save();

            res.status(200).json({ message: 'Address deleted successfully', user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Server Error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});


router.get('/get-user-info/:phone', verify, async (req, res) => {
    const phoneNumber = req.params.phone;
    if (req.user.phone === phoneNumber) {
        try {
            const { phone } = req.params;
            const user = await UserModel.findOne({ phone });
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            if (!user) {
                console.log(error)
                return res.status(404).json({ error: 'User not found' });
            }
            res.status(200).json({ user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Server Error' });
        }
    } else {
        return res.status(403).json({ error: "No Access to perform this  action" });
    }

})

router.get('/get-user-info-id/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findOne({ _id: id });
        if (!user) {
            console.log(error)
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
})

router.post("/save-user/:phone", verify, async (req, res) => {
    if (req.user.phone === req.params.phone) {
        try {
            const { phone } = req.params;
            const { name, email, addPhone } = req.body;
            const user = await UserModel.findOne({ phone });
            if (!user) {
                return res.status(404).json({ error: "User not found" })
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            user.name = name;
            user.email = email;
            user.addPhone = addPhone;

            await user.save();
            res.status(200).json({ message: "Data saved successfully", user });
        } catch (error) {
            res.status(500).json({ error: "Server Error" })
        }
    } else {
        return res.status(403).json({ error: "No Access to perform this  action" });
    }

})

router.get("/notifications/:phone", verify, async (req, res) => {
    const { page = 1, pageSize = 5 } = req.query;
    const skip = (page - 1) * pageSize;
    if (req.user.phone === req.params.phone) {
        try {
            const phone = req.params.phone;
            const user = await UserModel.findOne({ phone });
            if (!user) {
                return res.status(404).json({ error: "User Not Found" })
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            const notifications = user.notification.slice(skip, skip + parseInt(pageSize))
            res.json({ data: notifications, length: user.notification.length })
        } catch (error) {

        }
    } else {
        return res.status(403).json({ error: "No Access to perform this  action" });
    }
})

router.put("/notifications-status/:phone/:notificationId", verify, async (req, res) => {

    if (req.user.phone === req.params.phone) {
        try {
            const notificationId = req.params.notificationId;
            const phone = req.params.phone;
            const user = await UserModel.findOne({ phone });
            if (!user) {
                return res.status(404).json({ error: "User Not Found" })
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }
            const updatedUser = await UserModel.findOneAndUpdate({
                _id: user._id.toString(),
                "notification._id": notificationId
            },
                {
                    $set: { "notification.$.status": true }
                }, {
                new: true
            })
            if (!updatedUser) {
                return res.status(404).json({ error: "User or Notification not found" })
            }
            res.status(200).json({ message: "Success" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        return res.status(403).json({ error: "No Access to perform this  action" });
    }
})

router.get('/get-all-users', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { addPhone: { $regex: search, $options: 'i' } },
                { pincode: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } }
            ];
        }

        const allUsers = await UserModel.find(query)
            .select('email name phone addPhone pincode city createdAt')
            .sort({ createdAt: -1 }) // Assuming you have a createdAt field in your UserSchema
            .skip(skip)
            .limit(parseInt(pageSize));

        const formattedUsers = allUsers.map(user => {
            return {
                ...user.toObject(),
                createdAt: user.createdAt.toLocaleString('en-IN', {
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

        const totalUsers = await UserModel.countDocuments(query);
        res.send({
            totalRows: totalUsers,
            data: formattedUsers,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

router.put('/users/:phoneNumber/pincode', verify, async (req, res) => {
    const phoneNumber = req.params.phoneNumber;
    const newPincode = req.body.pincode;
    if (req.user.phone === phoneNumber) {
        try {
            // Find the user by phone number
            const user = await UserModel.findOne({ phone: phoneNumber });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }

            // Update the pincode field
            user.pincode = newPincode;

            // Save the updated user
            await user.save();

            return res.status(200).json({ message: 'Pincode updated successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    else {
        res.status(403).json({ error: "No Access to perform this action" })
    }
});

router.put('/users/:phoneNumber/city', verify, async (req, res) => {

    const phoneNumber = req.params.phoneNumber;
    const newCity = req.body.city;
    if (req.user.phone === phoneNumber) {
        try {
            // Find the user by phone number
            const user = await UserModel.findOne({ phone: phoneNumber });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user?.status !== "active") {
                return res.status(403).json({ error: "No Access to perform this action" })
            }

            // Update the pincode field
            user.city = newCity;
            user.pincode = "";

            // Save the updated user
            await user.save();

            return res.status(200).json({ message: 'City updated successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});




module.exports = router;
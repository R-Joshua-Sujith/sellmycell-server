const router = require("express").Router();
const express = require("express");
const RefundModel = require("../models/Refund")
const PartnerModel = require("../models/Partner");

router.get('/get-all-refunds', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        // Use a regular expression to make the search case-insensitive and partial
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { orderID: searchRegex },
                { cancellationReason: searchRegex },
                { partnerPhone: searchRegex },
                { partnerName: searchRegex }
            ],
        };

        const allRefunds = await RefundModel.find(query)
            .sort({ timestamp: -1 }) // Sort by timestamp in descending order
            .skip(skip)
            .limit(parseInt(pageSize));

        // Format timestamps before sending response
        const formattedRefunds = allRefunds.map(refund => {
            return {
                ...refund.toObject(),
                timestamp: refund.timestamp.toLocaleString('en-IN', {
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

        const totalRefunds = await RefundModel.countDocuments(query);

        res.json({
            totalRows: totalRefunds,
            data: formattedRefunds,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.put('/refund-coins/:phone', async (req, res) => {
    const phone = req.params.phone;
    const { coinsToAdd, refundId } = req.body; // Assuming you provide the number of coins to add in the request body

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone });

        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }

        // Update the partner's coins
        let totalCoins = parseInt(partner.coins) + parseInt(coinsToAdd);
        partner.coins = totalCoins.toString();
        const refund = await RefundModel.findById(refundId);
        if (!refund) {
            return res.status(404).json({ error: "Refund not found" });
        }
        if (refund.status === "refunded") {
            return res.status(404).json({ error: "Already Refunded" })
        }
        refund.status = "refunded"; // Assuming this is how you update the status
        partner.transaction.unshift({
            type: "credited",
            orderID: refund.orderID,
            coins: coinsToAdd,
            message: `Refunded for order ${refund.orderID}`
        })
        await refund.save();

        // Save the updated partner data
        await partner.save();

        res.status(200).json({ message: "Coins Refunded successfully", partner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




module.exports = router;
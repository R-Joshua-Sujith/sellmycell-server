const router = require("express").Router();

const CategoryModel = require("../models/Category");
const BrandModel = require("../models/Brand");
const ProductModel = require("../models/Item");
const UserModel = require("../models/User");
const OrderModel = require("../models/Order");
const AbundantOrderModel = require("../models/AbandonedOrder");
const PartnerModel = require("../models/Partner")

router.get("/documentCount", async (req, res) => {
    try {
        const categoryCount = await CategoryModel.countDocuments();
        const brandCount = await BrandModel.countDocuments();
        const productCount = await ProductModel.countDocuments();
        const orderCount = await OrderModel.countDocuments();
        const userCount = await UserModel.countDocuments();
        const abundantCount = await AbundantOrderModel.countDocuments();
        const partnerCount = await PartnerModel.countDocuments();

        const pickUpPersonsCount = await PartnerModel.aggregate([
            {
                $project: {
                    pickUpPersonsCount: { $size: "$pickUpPersons" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$pickUpPersonsCount" }
                }
            }
        ]);
        const data = [{
            name: "Categories",
            count: categoryCount,
            route: "/view-category"
        }, {
            name: "Brands",
            count: brandCount,
            route: "/view-brand"
        }, {
            name: "Users",
            count: userCount,
            route: "/view-user"
        }, {
            name: "Products",
            count: productCount,
            route: "/view-product"
        }, {
            name: "Orders",
            count: orderCount,
            route: "/view-order"
        }, {
            name: "Abandoned Orders",
            count: abundantCount,
            route: "/view-abandoned-orders"
        }, {
            name: "Partners",
            count: partnerCount,
            route: "/view-partner"
        }, {
            name: "Pick-up Persons",
            count: pickUpPersonsCount.length > 0 ? pickUpPersonsCount[0].total : 0,
            route: "/view-partner"
        }]
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

module.exports = router;
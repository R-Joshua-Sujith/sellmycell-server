const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const dotenv = require("dotenv");
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getMessaging } = require("firebase-admin/messaging");


const categoryRoutes = require('./routes/category');
const adminRoutes = require("./routes/admin");
const brandRoute = require("./routes/brand");
const itemRoute = require("./routes/item");
const pincodeRoute = require("./routes/pincode");
const userRoute = require("./routes/user")
const orderRoute = require("./routes/order")
const promoRoute = require("./routes/promoCode")
const abundantRoute = require("./routes/abundantOrder")
const statisticRoute = require("./routes/statistics")
const partnerRoute = require("./routes/partner");
const coinRoute = require("./routes/coins");
const uploadRoute = require("./routes/uploads");
const dynamicRoute = require("./routes/dynamic");
const pickUpRoute = require("./routes/pickUp");
const refundRoute = require("./routes/refund");
const paymentRoute = require("./routes/payment")
const contactRoute = require("./routes/contact")
const requestRoute = require("./routes/request")

dotenv.config();
const app = express();
app.use(cors());
app.use('/uploads', express.static('uploads'));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("DB Connection Successful"))
    .catch((err) => console.log(err))

process.env.GOOGLE_APPLICATION_CREDENTIALS;

initializeApp({
    credential: applicationDefault(),
    projectId: 'bechdu-9649a',
});

// Use category routes
app.use('/api/category', categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/brand", brandRoute);
app.use("/product", itemRoute)
app.use("/pincode", pincodeRoute);
app.use("/user", userRoute);
app.use("/order", orderRoute);
app.use("/promo", promoRoute);
app.use("/abundant", abundantRoute);
app.use("/statistic", statisticRoute);
app.use("/partner", partnerRoute);
app.use("/coins", coinRoute);
app.use("/uploads", uploadRoute);
app.use("/dynamic", dynamicRoute)
app.use("/pickup", pickUpRoute);
app.use("/refund", refundRoute);
app.use("/payment", paymentRoute);
app.use("/contact", contactRoute);
app.use("/request", requestRoute);



app.listen(5000, () => {
    console.log(`Server is running`);
});



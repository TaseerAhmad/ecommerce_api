import express from "express";
import addressRoute from "./address/address.js";
import authRoute from "./auth/auth.js";
import categoryRoute from "./category/category.js";
import merchantRoute from "./merchant/merchant.js";
import notificationRoute from "./notification/notification.js";
import orderRoute from "./order/order.js";
import productRoute from "./product/product.js";
import userRoute from "./user/user.js";
import reviewRoute from "./review/review.js";

const appRoutes = express.Router();

appRoutes.use("/auth", authRoute);
appRoutes.use("/user", userRoute);
appRoutes.use("/order", orderRoute);
appRoutes.use("/review", reviewRoute);
appRoutes.use("/address", addressRoute);
appRoutes.use("/product", productRoute);
appRoutes.use("/category", categoryRoute);
appRoutes.use("/merchant", merchantRoute);
appRoutes.use("/notification", notificationRoute);

export default appRoutes;
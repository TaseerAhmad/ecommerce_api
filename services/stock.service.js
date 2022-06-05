import path from "path";
import ErrorLog from "../helpers/dto/error.log.js";
import Notification from "../helpers/dto/notification.js";
import notificationType from "../helpers/message.states.js";
import userRole from "../helpers/user.roles.js";
import Management from "../models/Management.js";
import Merchant from "../models/Merchant.js";
import sendErrorLog from "../services/logger.service.js";
import * as notificationService from "../services/notification.service.js";

async function sendStockEmptyAlertToMerchant(product, merchantId) {
    try {

        const merchant = await Merchant.findById(merchantId, { userId: 1, _id: 0 }).lean();

        const notification = new Notification(
            notificationType.WARN,
            "Out of stock",
            `${product.name} is now out of stock. Please replenish the stock. Product code: #${product.productCode}`,
            merchant.userId
        );

        await notificationService.sendNotification(notification);

    } catch (err) {
        const __filename = new URL(import.meta.url).pathname;
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const fileName = __filename.slice(__dirname.length + 1);

        const errLog = new ErrorLog(fileName, Date.now(), sendStockEmptyAlertToMerchant.name, err);
        sendErrorLog(errLog);
    }
}

async function sendStockEmptyAlertToManagers(product) {
    try {
        const promises = [];

        const notification = new Notification(
            notificationType.WARN,
            "Out of stock",
            `${product.name} is now out of stock. Please replenish the stock. Product code: #${product.productCode}`
        );

        const managers = await Management.find({
            role: userRole.MANAGER
        }, { userId: 1, _id: 0 }).lean();

        if (managers.length === 0) {
            return;
        }

        managers.forEach(manager => {
            notification.recieverId = manager.userId;
            const promise = notificationService.sendNotification(notification);

            promises.push(promise);
        });

        await Promise.all(promises);

    } catch (err) {
        const __filename = new URL(import.meta.url).pathname;
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const fileName = __filename.slice(__dirname.length + 1);

        const errLog = new ErrorLog(fileName, Date.now(), sendStockEmptyAlertToManagers.name, err);
        sendErrorLog(errLog);
    }
}

export {
    sendStockEmptyAlertToManagers,
    sendStockEmptyAlertToMerchant
};
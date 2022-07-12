import express from "express";
import authenticate from "../../middleware/authentication.js";
import * as service from "../../services/notification.service.js";

const notificationRoute = express.Router();

notificationRoute.get("/poll", authenticate, async (req, res) => {

    try {

        const response = await service.getNotifications(req.token);
        return res.status(response.statusCode).json(response);

    } catch (err) {
        console.error(err);
    }

});

notificationRoute.delete("/clear", authenticate, async (req, res) => {

    try {

        const response = await service.clearNotifications(req.token);
        return res.status(response.statusCode).json(response);

    } catch (err) {
        console.error(err);
    }

});

notificationRoute.post("/send-support-message", authenticate, async (req, res) => {

    if (!req.body.subject || !req.body.message) {
        return res.status(400).json("Missing Fields");
    }

    const response = await service.sendSupportEmailToManagement(req.token, req.body);
    return res.status(response.statusCode).json(response);

});

export default notificationRoute;
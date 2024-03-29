import mongoose from "mongoose";
import validator from "validator";
import * as nodemailer from "../config/mail.config.js";
import GenericResponse from "../helpers/dto/generic.response.js";
import userRole from "../helpers/user.roles.js";
import Notification from "../models/Notification.js";

async function getNotifications(token) {
    const response = new GenericResponse();
    try {

        const notification = await Notification.findOne({
            relatedUser: mongoose.Types.ObjectId(token.id)
        });

        if (!notification) {
            response.responseData = [];
        } else {
            response.responseData = notification.messages;
        }

        response.statusCode = 200;
        response.message = "Success"
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        return response;
    }
}

async function sendNotification(newNotification) {
    const response = new GenericResponse();

    try {
        if (typeof newNotification.recieverId === "string") {
            newNotification.recieverId = mongoose.Types.ObjectId(newNotification.recieverId);
        }

        if (!newNotification.type || !newNotification.header) {
            response.statusCode = 400;
            response.message = "Invalid Notification Format";
            return response;
        }

        if (newNotification.text) {
            newNotification.text = validator.trim(newNotification.text);

            if (newNotification.text.length > 250) {
                response.statusCode = 400;
                response.message = "Invalid Notification Format";
                return response;
            }
        }

        newNotification.header = validator.trim(newNotification.header);
        if (newNotification.header.length > 100) {
            response.statusCode = 400;
            response.message = "Invalid Notification Format";
            return response;
        }

        const newMessage = {
            messageType: newNotification.type,
            header: newNotification.header,
            text: newNotification.text
        };

        const existingNotification = await Notification.findOne({
            relatedUser: mongoose.Types.ObjectId(newNotification.recieverId)
        });

        if (!existingNotification) {

            await Notification.create({
                relatedUser: newNotification.recieverId,
                messages: [newMessage]
            });

        } else {

            if (existingNotification.messages.length === 25) {
                existingNotification.messages.pop();
            }

            existingNotification.messages.push(newMessage);
            existingNotification.messages.reverse();
            await existingNotification.save();
        }

        response.statusCode = 201;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        return response;
    }
}

async function clearNotifications(token) {
    const response = new GenericResponse();

    try {

        const notification = await Notification.findOne({
            relatedUser: mongoose.Types.ObjectId(token.id)
        });

        if (notification.messages.length === 0) {
            response.statusCode = 404;
            response.message = "No Notifications";
            return response;
        }

        notification.messages = [];
        await notification.save();

        response.statusCode = 200;
        response.message = "Notifications cleared";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function sendSupportEmailToManagement(token, support) {
    const response = new GenericResponse();

    try {

        if (token.role !== userRole.CUSTOMER) {
            response.statusCode = 403;
            response.message = "Forbidden Action"
            return response;
        }

        //  Management.find()

        const mailOptions = {
            from: nodemailer.sender,
            to: "taseer.ahmadd@gmail.com",
            subject: support.subject.trim().toUpperCase(),
            html: `
            <p>${support.message}</p>
            <p>Requester Email: ${token.email}</p>
            `
        }

        nodemailer.transporter.sendMail(mailOptions);

        response.statusCode = 200;
        response.message = "Message Sent!";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

export {
    sendNotification,
    getNotifications,
    clearNotifications,
    sendSupportEmailToManagement
};


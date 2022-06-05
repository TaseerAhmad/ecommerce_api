/* eslint-disable no-undef */
import nodemailer from "nodemailer";

const systemLogger = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SYS_LOGGER_MAIL_USER,
        password: process.env.SYS_LOGGER_MAIL_PASS
    }
});

function getErrorLogMailOptions(errorObj) {
    return errorLogMailOptions = {
        from: process.env.SYS_LOGGER_MAIL_USER,
        to: process.env.SYS_LOGGER_RECEIVER_USER,
        subject: `API Server: ERROR ORIGIN in ${errorObj.fileName} file`,
        html: JSON.stringify(errorObj)
    };
}


export {
    systemLogger,
    getErrorLogMailOptions,
};
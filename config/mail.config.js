import nodemailer from "nodemailer";

const sender = "shopit.helpdeskk@gmail.com";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: sender,
        pass: "ppoavumgplsvskzs"
    }
});

export {
    sender,
    transporter
};


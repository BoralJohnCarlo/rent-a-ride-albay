import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure:
        process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

transporter.verify().then(() => {
    console.log("SMTP transporter verified successfully.");
}).catch((err) => {
    console.error("SMTP transporter verification failed:", err.message);
});

export default transporter;
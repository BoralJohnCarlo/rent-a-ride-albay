// Import before service modules in tests that must not contact SMTP on startup.
import nodemailer from "nodemailer";

nodemailer.createTransport = () => ({
    verify: async () => true,
    sendMail: async () => ({ messageId: "isolated-test-message" }),
    close() {},
});

// Optional --import preloader for integration tests: never contact real SMTP.
import { mock } from "node:test";
import nodemailer from "nodemailer";
mock.method(nodemailer, "createTransport", () => ({
    verify: async () => {},
    sendMail: async () => ({ messageId: "offline-test-message" }),
}));

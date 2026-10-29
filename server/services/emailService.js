import transporter from "../config/email.js";

export const sendEmail = async ({
    to,
    subject,
    text,
    html,
}) => {
    if (!to) {
        throw new Error(
            "Recipient email is required."
        );
    }

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
    };

    return transporter.sendMail(
        mailOptions
    );
};

/*
 * Whether transactional emails (booking, payment and refund notices,
 * receipts) go out. NOTIFICATION_EMAILS=false turns them off; under
 * `node --test` they're off unless NOTIFICATION_EMAILS=true, so a test run
 * never mails the made-up addresses it creates through the real SMTP account.
 * Verification codes don't go through here and always send.
 */
export const notificationEmailsEnabled = () => {
    const flag = String(
        process.env.NOTIFICATION_EMAILS ?? ""
    )
        .trim()
        .toLowerCase();

    if (["false", "0", "off", "no"].includes(flag)) {
        return false;
    }

    if (["true", "1", "on", "yes"].includes(flag)) {
        return true;
    }

    return !process.env.NODE_TEST_CONTEXT;
};

/*
 * Fire-and-forget send for transactional emails: the action that triggered it
 * (an approval, a payment webhook) never waits on, or fails because of, the
 * SMTP server. Failures are logged with `label` so they can be traced.
 * Returns false when emails are disabled or there is no recipient.
 */
export const sendEmailInBackground = (message, label = "email") => {
    if (!message?.to || !notificationEmailsEnabled()) {
        return false;
    }

    Promise.resolve()
        .then(() => sendEmail(message))
        .catch((error) => {
            console.error(
                `Failed to send ${label} to ${message.to}:`,
                error?.message || error
            );
        });

    return true;
};

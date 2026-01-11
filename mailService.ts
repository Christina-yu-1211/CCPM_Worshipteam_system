
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail',          // Use standard Gmail service shorthand
    auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_APP_PASSWORD?.trim().replace(/ /g, ''),
    },
    connectionTimeout: 60000,  // Keep timeout as safety
    socketTimeout: 60000,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const info = await transporter.sendMail({
            from: `"Worship Team System" <${process.env.EMAIL_USER}>`, // sender address
            to,
            subject,
            html,
        });
        console.log("Message sent: %s", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email: ", error);
        return { success: false, error };
    }
};


import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,    // SSL
    secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_APP_PASSWORD?.trim().replace(/ /g, ''),
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 60000,
    socketTimeout: 60000,
    logger: true, // Log to console
    debug: true,  // Include SMTP traffic in logs
    family: 4     // Force IPv4 to avoid Render IPv6 timeouts
} as nodemailer.TransportOptions);

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

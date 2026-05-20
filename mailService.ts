import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground',
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const { token: accessToken } = await oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER || 'ministry.secretar.office@gmail.com',
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN,
            accessToken: accessToken ?? undefined,
        },
    });

    return transporter;
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const transporter = await createTransporter();
        const fromEmail = process.env.EMAIL_USER || 'ministry.secretar.office@gmail.com';

        const info = await transporter.sendMail({
            from: `"祭壇小幫手" <${fromEmail}>`,
            to,
            subject,
            html,
        });

        console.log(`[Email] ✅ Sent via Gmail API to ${to}. ID: ${info.messageId}`);
        return { success: true, data: info };
    } catch (error: any) {
        console.error(`[Email] ❌ Failed to send via Gmail API to ${to}:`, error.message);
        return { success: false, error };
    }
};

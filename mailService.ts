import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const OAuth2 = google.auth.OAuth2;

const createOAuthClient = () => {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground" // Redirect URL
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    return oauth2Client;
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const oauth2Client = createOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Construct MIME message
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            html
        ];
        const message = messageParts.join('\n');

        // Encode the message to Base64URL
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log(`[Email] ✅ Sent via Gmail API to ${to}. ID: ${res.data.id}`);
        return { success: true, data: res.data };
    } catch (error: any) {
        console.error(`[Email] ❌ Failed to send via Gmail API to ${to}:`, error.message);
        if (error.response) {
            console.error('Gmail API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
        return { success: false, error };
    }
};

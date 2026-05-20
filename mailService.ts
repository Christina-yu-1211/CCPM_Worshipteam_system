import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const OAuth2 = google.auth.OAuth2;

const createOAuthClient = () => {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground',
    );
    oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
    return oauth2Client;
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const oauth2Client = createOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const fromName = '祭壇小幫手';
        const fromEmail = process.env.EMAIL_USER || 'ministry.secretar.office@gmail.com';

        // RFC 2047 encoded-word format for non-ASCII headers
        const encodedFromName = `=?UTF-8?B?${Buffer.from(fromName, 'utf8').toString('base64')}?=`;
        const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

        // Base64-encode the HTML body so the entire MIME message stays pure ASCII
        const encodedBody = Buffer.from(html, 'utf8').toString('base64');

        const messageParts = [
            `From: ${encodedFromName} <${fromEmail}>`,
            `To: ${to}`,
            `Subject: ${encodedSubject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            encodedBody,
        ];

        // At this point the entire message is pure ASCII — safe to encode as ascii for Gmail API raw
        const message = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(message, 'ascii')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage },
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

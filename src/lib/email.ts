'use server';

import nodemailer from 'nodemailer';

interface SendEmailProps {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailProps) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.verify();
        await transporter.sendMail({
            from: `"Prêt-à-Mode" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });
        return { success: true };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: 'Failed to send email' };
    }
}

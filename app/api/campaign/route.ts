// app/api/campaign/route.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Required for some providers
    rejectUnauthorized: false,
  },
});

// Send email
async function sendEmail(to: string, subject: string, body: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: to,
    subject: subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });
}
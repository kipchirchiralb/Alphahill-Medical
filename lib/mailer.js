const nodemailer = require("nodemailer");

const DEFAULT_FROM = "noreply@alphahillmedical.co.ke";
const DEFAULT_NAME = "Alpha Hill Medical Centre";

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a system email from noreply@alphahillmedical.co.ke.
 * Throws with code SMTP_NOT_CONFIGURED when credentials are missing.
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  if (!isConfigured()) {
    const error = new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS."
    );
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  const fromAddress = process.env.MAIL_FROM || DEFAULT_FROM;
  const fromName = process.env.MAIL_FROM_NAME || DEFAULT_NAME;
  const transport = createTransport();

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
}

module.exports = {
  DEFAULT_FROM,
  isConfigured,
  sendMail,
};

const crypto = require("crypto");
const db = require("../config/database");
const { sendMail, isConfigured } = require("./mailer");

const ALLOWED_EMAILS = Object.freeze([
  "info@alphahillmedical.co.ke",
  "enos@alphahillmedical.co.ke",
  "doreen@alphahillmedical.co.ke",
  "kiprotich@alphahillmedical.co.ke",
  "janet@alphahillmedical.co.ke",
  "albert@alphahillmedical.co.ke",
]);

const ALLOWED_SET = new Set(ALLOWED_EMAILS.map((email) => email.toLowerCase()));

// 32 characters; 256 % 32 === 0 so randomBytes mapping has no modulo bias.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_MS = 2 * 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isAllowedEmail(value) {
  return ALLOWED_SET.has(normalizeEmail(value));
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

function hashCode(code) {
  return crypto.createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

function formatCode(code) {
  const compact = normalizeCode(code);
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function displayName(email) {
  const local = normalizeEmail(email).split("@")[0] || "staff";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

async function issueAndSend(email) {
  const address = normalizeEmail(email);
  if (!isAllowedEmail(address)) {
    return { sent: false, reason: "not_allowed" };
  }

  if (!isConfigured()) {
    const error = new Error("SMTP is not configured");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  let code = generateCode();
  let hash = hashCode(code);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [existing] = await db.execute(
      "SELECT id FROM login_otps WHERE code_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
      [hash],
    );
    if (existing.length === 0) break;
    code = generateCode();
    hash = hashCode(code);
  }

  await db.execute(
    "UPDATE login_otps SET used_at = NOW() WHERE email = ? AND used_at IS NULL",
    [address],
  );

  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.execute(
    "INSERT INTO login_otps (email, code_hash, expires_at) VALUES (?, ?, ?)",
    [address, hash, expiresAt],
  );

  const pretty = formatCode(code);
  const minutes = Math.round(OTP_TTL_MS / 60000);

  await sendMail({
    to: address,
    subject: "Your Alpha Hill dashboard sign-in code",
    text: [
      `Your sign-in code is ${pretty}.`,
      `It expires in ${minutes} minutes and can be used only once.`,
      "If you did not ask to sign in, you can ignore this email.",
    ].join("\n"),
    html: `
      <p style="font-family:Georgia,serif;font-size:16px;color:#1a1a2e">
        Your Alpha Hill Medical Centre dashboard sign-in code is:
      </p>
      <p style="font-family:ui-monospace,Consolas,monospace;font-size:28px;letter-spacing:0.12em;font-weight:700;color:#001F5D">
        ${pretty}
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:#5a6076">
        It expires in ${minutes} minutes and can be used only once.
        If you did not ask to sign in, you can ignore this email.
      </p>
    `,
  });

  return { sent: true };
}

async function verifyCode(email, code) {
  const address = normalizeEmail(email);
  const compact = normalizeCode(code);

  if (!isAllowedEmail(address) || compact.length !== CODE_LENGTH) {
    return null;
  }

  const hash = hashCode(compact);
  const [rows] = await db.execute(
    `SELECT id FROM login_otps
     WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [address, hash],
  );

  if (rows.length === 0) return null;

  await db.execute("UPDATE login_otps SET used_at = NOW() WHERE id = ?", [
    rows[0].id,
  ]);

  return { email: address, name: displayName(address) };
}

module.exports = {
  ALLOWED_EMAILS,
  OTP_TTL_MS,
  SESSION_MS,
  normalizeEmail,
  isAllowedEmail,
  issueAndSend,
  verifyCode,
  displayName,
};

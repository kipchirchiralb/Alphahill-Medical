/**
 * Generates a bcrypt hash for the dashboard admin password.
 *
 *   node scripts/set-admin-password.js "your new password"
 *
 * Copy the printed value into ADMIN_PASSWORD_HASH in .env, then restart the server.
 */
const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/set-admin-password.js "your new password"');
  process.exit(1);
}

if (password.length < 10) {
  console.error("Please choose a password of at least 10 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);

console.log("\nAdd this line to your .env file:\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);

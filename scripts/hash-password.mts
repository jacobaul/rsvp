/**
 * Usage: pnpm admin:password 'your-password'
 * Prints the ADMIN_PASSWORD_HASH value to put in .env.
 */
import { hashPassword } from "../lib/auth/password";

const password = process.argv[2];

if (!password) {
  console.error("Usage: pnpm admin:password 'your-password'");
  process.exit(1);
}

if (password.length < 10) {
  console.error("Choose a password of at least 10 characters.");
  process.exit(1);
}

const hash = await hashPassword(password);

console.log("\nAdd this line to your .env:\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
console.log(
  "Fields are separated by '.' rather than '$' because Next.js expands\n" +
    "$name references when it loads .env, which would corrupt the hash.\n",
);

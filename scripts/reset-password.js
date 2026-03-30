#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const database = require('../db/database');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/reset-password.js <username> <new-password>');
  console.log('Example: node scripts/reset-password.js admin myNewPassword');
  process.exit(1);
}

const [username, newPassword] = args;
const user = database.findUserByUsername(username);

if (!user) {
  console.error(`User "${username}" not found.`);
  const allUsers = database.getAllUsers();
  if (allUsers.length > 0) {
    console.log('Available users:', allUsers.map(u => u.username).join(', '));
  }
  process.exit(1);
}

const hashed = bcrypt.hashSync(newPassword, 10);
database.updateUserPassword(user.id, hashed);
console.log(`Password reset for "${username}".`);

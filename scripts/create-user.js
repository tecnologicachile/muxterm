#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const Database = require('../db/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createUser() {
  console.log('MuxTerm - Create User\n');
  
  try {
    const username = await question('Enter username: ');
    if (!username || username.length < 3) {
      console.error('Username must be at least 3 characters');
      process.exit(1);
    }
    
    // Check if user exists
    const existingUser = Database.getUserByUsername(username);
    if (existingUser) {
      console.error(`User '${username}' already exists`);
      process.exit(1);
    }
    
    const password = await question('Enter password: ');
    if (!password || password.length < 6) {
      console.error('Password must be at least 6 characters');
      process.exit(1);
    }
    
    const confirmPassword = await question('Confirm password: ');
    if (password !== confirmPassword) {
      console.error('Passwords do not match');
      process.exit(1);
    }
    
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Create user
    Database.createUser(username, hashedPassword);
    
    console.log(`\n✅ User '${username}' created successfully!`);
    console.log('\nYou can now login to MuxTerm with these credentials.');
    
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check if database exists
try {
  // Initialize database
  const db = Database.db;
  if (!db) {
    console.error('Database not initialized. Please ensure MuxTerm is properly installed.');
    process.exit(1);
  }
} catch (error) {
  console.error('Database error:', error.message);
  process.exit(1);
}

createUser();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('../db/database');
const logger = require('./utils/logger');
const router = express.Router();

// Generate JWT_SECRET if not provided (auto-save to .env)
if (!process.env.JWT_SECRET) {
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const secret = crypto.randomBytes(32).toString('base64');
  process.env.JWT_SECRET = secret;
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (!envContent.includes('JWT_SECRET=')) {
    fs.appendFileSync(envPath, `\nJWT_SECRET=${secret}\n`);
  }
}

const createToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = database.findUserByUsername(decoded.username);
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    req.adminUser = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = database.createUser(username, hashedPassword);
    
    if (!user) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin || 0
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = database.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin || 0,
        must_change_password: user.must_change_password || 0
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = database.findUserByUsername(decoded.username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    database.updateUserPassword(user.id, hashedPassword);
    database.clearMustChangePassword(user.id);
    database.clearUserCredentialCache(user.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const freshUser = database.findUserByUsername(decoded.username);
    res.json({
      valid: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        is_admin: freshUser ? freshUser.is_admin : 0
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Admin: list users
router.get('/admin/users', requireAdmin, (req, res) => {
  res.json(database.getAllUsers());
});

// Admin: reset user password
router.post('/admin/reset-password', requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ success: false, message: 'userId and newPassword required' });
  const user = database.findUserById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const hashed = await bcrypt.hash(newPassword, 10);
  database.updateUserPassword(userId, hashed);
  database.clearUserCredentialCache(userId);
  res.json({ success: true });
});

// Admin: delete user
router.delete('/admin/users/:id', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.adminUser.id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
  if (userId === 1) return res.status(400).json({ success: false, message: 'Cannot delete root admin' });
  const user = database.findUserById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  database.deleteUser(userId);
  res.json({ success: true });
});

// Admin: toggle admin
router.post('/admin/toggle-admin', requireAdmin, (req, res) => {
  const { userId, isAdmin } = req.body;
  if (userId === 1) return res.status(400).json({ success: false, message: 'Cannot change root admin' });
  if (userId === req.adminUser.id) return res.status(400).json({ success: false, message: 'Cannot change your own admin status' });
  const user = database.findUserById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  database.setUserAdmin(userId, isAdmin);
  res.json({ success: true });
});

module.exports = router;
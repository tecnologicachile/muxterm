const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Get encryption key from environment (same as GUAC_SECRET or dedicated CRED_KEY)
function getKey() {
  const key = process.env.CRED_ENCRYPTION_KEY || process.env.GUAC_SECRET;
  if (!key) throw new Error('No encryption key available');
  // Ensure key is exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(plaintext) {
  if (!plaintext) return { ciphertext: null, iv: null };
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return { ciphertext: encrypted, iv: iv.toString('base64') };
}

function decrypt(ciphertext, ivBase64) {
  if (!ciphertext || !ivBase64) return null;
  try {
    const key = getKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

module.exports = { encrypt, decrypt };

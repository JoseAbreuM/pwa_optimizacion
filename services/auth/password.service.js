const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  if (!storedPassword.includes(':')) {
    return password === storedPassword;
  }

  const [salt, savedHash] = storedPassword.split(':');
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const savedHashBuffer = Buffer.from(savedHash, 'hex');

  if (hashBuffer.length !== savedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, savedHashBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};

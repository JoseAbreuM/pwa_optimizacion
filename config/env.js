const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootEnvPath = path.join(__dirname, '..', '.env');
const legacyEnvPath = path.join(__dirname, '..', 'env', '.env');
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : legacyEnvPath;

dotenv.config({ path: envPath });

const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || 'petrofield-secret-dev';

module.exports = {
  port,
  sessionSecret,
  envPath
};

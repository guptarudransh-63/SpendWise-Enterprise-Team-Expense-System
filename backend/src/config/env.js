const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

// Load .env from backend or root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('5001'),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/spendwise'),
  JWT_SECRET: z.string().min(16).default('spendwise_super_secure_jwt_secret_change_in_production_32chars!'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('spendwise_cookie_secret_change_in_production_32chars!'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default(path.resolve(__dirname, '../../uploads')),
  MAX_FILE_SIZE_BYTES: z.string().transform(Number).default('5242880'), // 5MB
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

module.exports = parsed.data;

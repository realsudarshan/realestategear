import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.test') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.API_PORT = '3002';
process.env.FRONTEND_URL = 'http://localhost:3000';

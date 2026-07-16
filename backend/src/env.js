import dotenv from 'dotenv';

dotenv.config();

export const PASSWORD_AES_KEY = process.env.PASSWORD_AES_KEY;

if (!PASSWORD_AES_KEY) {
  throw new Error('PASSWORD_AES_KEY is required. Copy backend/.env.example to backend/.env and set a secret key.');
}

export const PORT = process.env.PORT || 4000;

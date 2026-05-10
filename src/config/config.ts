import * as dotenv from 'dotenv';

// Ensure .env is loaded before reading process.env at module import time.
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? '4000'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000,http://localhost:8080,https://ifx-front-end-prueba.onrender.com'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  db: {
    url: process.env.DB_URL ?? 'file:./testfx.db',
    token: process.env.DB_TOKEN ?? '',
  },

  auth: {
    secretKey: process.env.SECRET_KEY ?? 'super-secret-key-change-in-production',
    saltRound: Number(process.env.SALT_ROUND_NUMBER ?? '10'),
    adminSignupKey: (process.env.VM_ADMIN_SIGNUP_KEY ?? '').trim() || null,
    cookieName: 'access_token',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    phone: process.env.TWILIO_PHONE ?? '+1234567890',
    defaultCountryCode: process.env.TWILIO_DEFAULT_COUNTRY_CODE ?? '+57',
  },

  providers: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  },
};

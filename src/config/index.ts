import dotenv from 'dotenv';

dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
  },
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
};

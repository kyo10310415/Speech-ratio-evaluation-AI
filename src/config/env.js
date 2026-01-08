import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // Google API
  googleSheetsId: process.env.GOOGLE_SHEETS_ID,
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  
  // OpenAI API
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  // AssemblyAI API
  assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
  
  // Timezone
  timezone: process.env.TZ || 'Asia/Tokyo',
  
  // Directories
  tempDir: process.env.TEMP_DIR || './temp',
  downloadsDir: process.env.DOWNLOADS_DIR || './temp/downloads',
  audioDir: process.env.AUDIO_DIR || './temp/audio',
  
  // Log level
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validation
export function validateConfig() {
  const required = [
    'googleSheetsId',
    'googleServiceAccountEmail',
    'googlePrivateKey',
    'openaiApiKey',
  ];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

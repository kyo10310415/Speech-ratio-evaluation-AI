import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // Google API
  googleSheetsId: process.env.GOOGLE_SHEETS_ID,
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  
  // Google AI (Gemini) API
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
  
  // AssemblyAI API
  assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
  
  // Timezone
  timezone: process.env.TZ || 'Asia/Tokyo',
  
  // Directories (use absolute paths)
  tempDir: process.env.TEMP_DIR || join(projectRoot, 'temp'),
  downloadsDir: process.env.DOWNLOADS_DIR || join(projectRoot, 'temp', 'downloads'),
  audioDir: process.env.AUDIO_DIR || join(projectRoot, 'temp', 'audio'),
  
  // Log level
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Dashboard
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3000'),
  dashboardHost: process.env.DASHBOARD_HOST || '0.0.0.0',
  
  // Parallel processing
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '5'),
};

// Validation
export function validateConfig() {
  const required = [
    'googleSheetsId',
    'googleServiceAccountEmail',
    'googlePrivateKey',
    'googleAiApiKey',
  ];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

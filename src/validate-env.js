import { logger } from './utils/logger.js';
import { config, validateConfig } from './config/env.js';

/**
 * Validate environment configuration
 */
async function validateEnvironment() {
  logger.info('Validating environment configuration...');

  try {
    validateConfig();
    logger.info('✓ All required environment variables are set');

    // Check for optional AssemblyAI
    if (config.assemblyaiApiKey) {
      logger.info('✓ AssemblyAI API key configured (recommended)');
    } else {
      logger.warn('⚠ AssemblyAI API key not configured - will use fallback diarization');
    }

    logger.info('\nConfiguration summary:');
    logger.info(`  Google Sheets ID: ${config.googleSheetsId}`);
    logger.info(`  Service Account: ${config.googleServiceAccountEmail}`);
    logger.info(`  OpenAI API Key: ${config.openaiApiKey ? '✓ Set' : '✗ Missing'}`);
    logger.info(`  AssemblyAI API Key: ${config.assemblyaiApiKey ? '✓ Set' : '○ Optional'}`);
    logger.info(`  Timezone: ${config.timezone}`);
    logger.info(`  Temp Directory: ${config.tempDir}`);

    logger.info('\n✅ Environment validation passed');
    return true;

  } catch (error) {
    logger.error('❌ Environment validation failed:', error.message);
    return false;
  }
}

// Run validation
validateEnvironment()
  .then(success => {
    process.exit(success ? 0 : 1);
  });

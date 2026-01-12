import { sheetsService } from './services/sheetsService.js';
import { logger } from './utils/logger.js';
import { config, validateConfig } from './config/env.js';

/**
 * Clear error rows from daily_lessons sheet
 */
async function clearErrorRows() {
  try {
    validateConfig();
    await sheetsService.initialize();

    logger.info('Fetching daily_lessons data...');
    const data = await sheetsService.getSheetData('daily_lessons');

    if (data.length <= 1) {
      logger.info('No data rows found');
      return;
    }

    const headers = data[0];
    const statusIndex = headers.indexOf('status');
    const errorMessageIndex = headers.indexOf('error_message');

    if (statusIndex === -1) {
      logger.warn('Status column not found');
      return;
    }

    // Find error rows (rows with status='ERROR')
    const errorRows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[statusIndex] === 'ERROR') {
        errorRows.push({
          rowIndex: i + 1, // 1-based index
          fileName: row[4] || 'Unknown', // drive_file_name
          error: row[errorMessageIndex] || 'Unknown error'
        });
      }
    }

    if (errorRows.length === 0) {
      logger.info('No error rows found ✅');
      return;
    }

    logger.info(`Found ${errorRows.length} error rows:`);
    errorRows.forEach(row => {
      logger.info(`  Row ${row.rowIndex}: ${row.fileName}`);
      logger.info(`    Error: ${row.error.substring(0, 100)}...`);
    });

    logger.info('\n⚠️  To clear these error rows, delete them manually from the spreadsheet');
    logger.info('Then re-run the daily:test command');
    logger.info('\nOr, if you want to force reprocess:');
    logger.info('1. Delete the error rows from daily_lessons sheet');
    logger.info('2. Run: npm run daily:test 2026-01-08');

  } catch (error) {
    logger.error('Failed to check error rows', error);
    throw error;
  }
}

clearErrorRows().catch(console.error);

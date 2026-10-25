import { pathToFileURL } from 'node:url';
import { sheetsService } from './services/sheetsService.js';
import { logger } from './utils/logger.js';
import { validateConfig } from './config/env.js';

// Despite the historical filename, this command only reads and reports rows.
export async function clearErrorRows() {
  validateConfig();
  await sheetsService.initialize();
  const data = await sheetsService.getSheetData('daily_lessons');
  if (data.length <= 1) { logger.info('No data rows found'); return; }
  const statusIndex = data[0].indexOf('status');
  if (statusIndex === -1) { logger.warn('Status column not found'); return; }
  const errorRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusIndex] === 'ERROR') errorRows.push(i + 1);
  }
  logger.info(`Error row count: ${errorRows.length}`);
  errorRows.forEach(row => logger.info(`Error row number: ${row}`));
  logger.info('Check the reported rows in the spreadsheet. This command does not delete or reprocess data.');
}

export async function runErrorRowDiagnostic() {
  try { await clearErrorRows(); return true; }
  catch { logger.error('Error row diagnostic failed'); return false; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runErrorRowDiagnostic().then(success => { if (!success) process.exitCode = 1; });
}

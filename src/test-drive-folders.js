import { driveService } from './services/driveService.js';
import { config, validateConfig } from './config/env.js';
import { logger } from './utils/logger.js';

/**
 * Test script to list all folders in parent directory
 */
async function testListFolders() {
  try {
    validateConfig();
    await driveService.initialize();
    
    // Test folder ID from first row
    const testFolderId = '18mhFqciItIbBka1Y9N1sGkHGKMq4gnJX';
    
    logger.info(`Testing folder access for ID: ${testFolderId}`);
    
    // List ALL subfolders (not just month folders)
    const query = [
      `'${testFolderId}' in parents`,
      `mimeType='application/vnd.google-apps.folder'`,
      `trashed=false`,
    ].join(' and ');

    const response = await driveService.drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      orderBy: 'name',
    });

    const folders = response.data.files || [];
    
    logger.info(`\n=== ALL SUBFOLDERS (${folders.length} total) ===`);
    folders.forEach(folder => {
      logger.info(`  - ${folder.name} (${folder.id})`);
    });
    
    // Test normalization
    logger.info(`\n=== TESTING NORMALIZATION ===`);
    folders.forEach(folder => {
      const normalized = driveService.normalizeMonthFolderName(folder.name);
      if (normalized) {
        logger.info(`  ✅ ${folder.name} → ${normalized}`);
      } else {
        logger.warn(`  ❌ ${folder.name} → NOT A MONTH FOLDER`);
      }
    });
    
    logger.info('\n✅ Test completed');
    
  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  }
}

testListFolders()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('Test script failed:', error);
    process.exit(1);
  });

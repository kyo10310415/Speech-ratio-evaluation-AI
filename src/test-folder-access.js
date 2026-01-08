import { google } from 'googleapis';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

/**
 * Test folder access with custom folder ID
 * Usage: node src/test-folder-access.js FOLDER_ID
 */
async function testFolderAccess() {
  try {
    const folderId = process.argv[2];
    
    if (!folderId) {
      logger.error('Usage: node src/test-folder-access.js FOLDER_ID');
      process.exit(1);
    }
    
    logger.info(`Testing access to folder: ${folderId}\n`);
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleServiceAccountEmail,
        private_key: config.googlePrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Try to get folder metadata
    try {
      const folderMeta = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType, owners, capabilities',
      });
      
      logger.info('✅ Folder found!');
      logger.info(`   Name: ${folderMeta.data.name}`);
      logger.info(`   Type: ${folderMeta.data.mimeType}`);
      logger.info(`   Owner: ${folderMeta.data.owners?.[0]?.emailAddress || 'Unknown'}`);
      logger.info(`   Can read: ${folderMeta.data.capabilities?.canRead}`);
      logger.info(`   Can list children: ${folderMeta.data.capabilities?.canListChildren}`);
      
    } catch (error) {
      logger.error(`❌ Cannot access folder: ${error.message}`);
      logger.error(`   Error code: ${error.code}`);
      
      if (error.code === 404) {
        logger.error('   → Folder not found OR service account has no permission');
      } else if (error.code === 403) {
        logger.error('   → Permission denied');
      }
    }
    
    // Try to list contents
    try {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
      });
      
      const files = response.data.files || [];
      logger.info(`\n✅ Found ${files.length} items in folder`);
      
      if (files.length > 0) {
        files.forEach(file => {
          logger.info(`   - ${file.name} (${file.mimeType})`);
        });
      }
      
    } catch (error) {
      logger.error(`\n❌ Cannot list folder contents: ${error.message}`);
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testFolderAccess();

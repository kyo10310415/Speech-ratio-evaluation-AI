import { google } from 'googleapis';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

/**
 * Detailed authentication test
 */
async function testAuth() {
  try {
    logger.info('=== AUTHENTICATION TEST ===\n');
    
    // Check environment variables
    logger.info('1. Environment Variables:');
    logger.info(`   GOOGLE_SERVICE_ACCOUNT_EMAIL: ${config.googleServiceAccountEmail}`);
    logger.info(`   GOOGLE_PRIVATE_KEY length: ${config.googlePrivateKey?.length || 0} characters`);
    logger.info(`   GOOGLE_PRIVATE_KEY first 50 chars: ${config.googlePrivateKey?.substring(0, 50)}`);
    logger.info(`   GOOGLE_PRIVATE_KEY contains "BEGIN": ${config.googlePrivateKey?.includes('BEGIN PRIVATE KEY')}`);
    logger.info(`   GOOGLE_PRIVATE_KEY contains "END": ${config.googlePrivateKey?.includes('END PRIVATE KEY')}`);
    
    // Try to create auth client
    logger.info('\n2. Creating Auth Client...');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleServiceAccountEmail,
        private_key: config.googlePrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    logger.info('   ✅ Auth client created');
    
    // Try to get access token
    logger.info('\n3. Getting Access Token...');
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    if (tokenResponse.token) {
      logger.info('   ✅ Access token obtained successfully');
      logger.info(`   Token (first 20 chars): ${tokenResponse.token.substring(0, 20)}...`);
    } else {
      logger.error('   ❌ Failed to obtain access token');
    }
    
    // Try to access Drive API
    logger.info('\n4. Testing Drive API Access...');
    const drive = google.drive({ version: 'v3', auth });
    
    const testFolderId = '18mhFqciItIbBka1Y9N1sGkHGKMq4gnJX';
    
    // First, try to get folder metadata
    logger.info(`   Testing metadata access for folder ${testFolderId}...`);
    try {
      const folderMeta = await drive.files.get({
        fileId: testFolderId,
        fields: 'id, name, mimeType, permissions',
      });
      logger.info(`   ✅ Folder metadata retrieved:`);
      logger.info(`      Name: ${folderMeta.data.name}`);
      logger.info(`      Type: ${folderMeta.data.mimeType}`);
    } catch (metaError) {
      logger.error(`   ❌ Failed to get folder metadata: ${metaError.message}`);
      logger.error(`      Error code: ${metaError.code}`);
      logger.error(`      Error details: ${JSON.stringify(metaError.errors || {})}`);
    }
    
    // Then, try to list files
    logger.info(`\n   Testing file listing for folder ${testFolderId}...`);
    try {
      const query = `'${testFolderId}' in parents and trashed=false`;
      logger.info(`   Query: ${query}`);
      
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
      });
      
      const files = response.data.files || [];
      logger.info(`   ✅ Found ${files.length} items in folder`);
      
      if (files.length > 0) {
        logger.info('   Items:');
        files.forEach(file => {
          logger.info(`      - ${file.name} (${file.mimeType})`);
        });
      }
    } catch (listError) {
      logger.error(`   ❌ Failed to list files: ${listError.message}`);
      logger.error(`      Error code: ${listError.code}`);
      logger.error(`      Error details: ${JSON.stringify(listError.errors || {})}`);
    }
    
    logger.info('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    logger.error('\n=== TEST FAILED ===');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    throw error;
  }
}

testAuth()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('Auth test failed:', error);
    process.exit(1);
  });

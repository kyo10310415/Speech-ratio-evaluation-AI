#!/usr/bin/env node

/**
 * Fix sales_evaluations sheet header
 * Add missing 'person_name' header to column Y
 */

import { sheetsService } from './src/services/sheetsService.js';
import { logger } from './src/utils/logger.js';
import { SALES_EVALUATIONS_HEADERS } from './src/jobs/salesEvaluation.js';

async function fixHeaders() {
  try {
    logger.info('🔧 Fixing sales_evaluations sheet headers...');
    
    // Initialize sheets service
    await sheetsService.initialize();
    
    // Get current data
    const data = await sheetsService.getSheetData('sales_evaluations');
    
    if (data.length === 0) {
      logger.error('❌ Sheet is empty');
      return;
    }
    
    const currentHeaders = data[0];
    logger.info(`Current headers (${currentHeaders.length} columns):`, currentHeaders);
    logger.info(`Expected headers (${SALES_EVALUATIONS_HEADERS.length} columns):`, SALES_EVALUATIONS_HEADERS);
    
    // Check if person_name is missing
    const personNameIdx = currentHeaders.indexOf('person_name');
    
    if (personNameIdx === -1) {
      logger.info('⚠️  person_name header is missing');
      logger.info('📝 Writing correct headers...');
      
      // Write correct headers
      await sheetsService.writeHeaders('sales_evaluations', SALES_EVALUATIONS_HEADERS);
      
      logger.info('✅ Headers updated successfully');
      logger.info('New headers:', SALES_EVALUATIONS_HEADERS);
    } else {
      logger.info(`✅ person_name header already exists at column ${personNameIdx}`);
    }
    
  } catch (error) {
    logger.error('❌ Failed to fix headers:', error);
    throw error;
  }
}

fixHeaders()
  .then(() => {
    logger.info('✅ Header fix completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Header fix failed:', error);
    process.exit(1);
  });

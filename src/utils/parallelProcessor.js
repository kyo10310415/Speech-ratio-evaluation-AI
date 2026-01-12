import { logger } from './logger.js';

/**
 * Process items in parallel with concurrency control
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} concurrency - Number of items to process in parallel
 * @returns {Array} Results from all processors
 */
export async function processInParallel(items, processor, concurrency = 5) {
  const results = [];
  const errors = [];
  
  logger.info(`Processing ${items.length} items with concurrency ${concurrency}`);
  
  // Split items into chunks
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  
  logger.info(`Split into ${chunks.length} chunks`);
  
  // Process each chunk in parallel
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    logger.info(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);
    
    const chunkStartTime = Date.now();
    
    // Process all items in chunk concurrently
    const chunkResults = await Promise.allSettled(
      chunk.map(async (item, index) => {
        const itemStartTime = Date.now();
        try {
          const result = await processor(item);
          const duration = ((Date.now() - itemStartTime) / 1000).toFixed(2);
          logger.info(`  Item ${i * concurrency + index + 1} completed in ${duration}s`);
          return result;
        } catch (error) {
          const duration = ((Date.now() - itemStartTime) / 1000).toFixed(2);
          logger.error(`  Item ${i * concurrency + index + 1} failed in ${duration}s:`, error.message);
          throw error;
        }
      })
    );
    
    // Collect results and errors
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          item: chunk[index],
          error: result.reason,
        });
      }
    });
    
    const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
    logger.info(`Chunk ${i + 1} completed in ${chunkDuration}s`);
  }
  
  logger.info(`Parallel processing complete: ${results.length} succeeded, ${errors.length} failed`);
  
  if (errors.length > 0) {
    logger.warn(`Failed items: ${errors.map(e => e.item.tutorName || e.item).join(', ')}`);
  }
  
  return { results, errors };
}

/**
 * Calculate optimal concurrency based on available resources
 * @param {number} totalItems - Total number of items to process
 * @param {number} maxConcurrency - Maximum allowed concurrency
 * @returns {number} Optimal concurrency
 */
export function calculateOptimalConcurrency(totalItems, maxConcurrency = 5) {
  // For small batches, use lower concurrency
  if (totalItems <= 5) return Math.min(2, totalItems);
  if (totalItems <= 10) return Math.min(3, totalItems);
  
  // For larger batches, use configured max
  return Math.min(maxConcurrency, totalItems);
}

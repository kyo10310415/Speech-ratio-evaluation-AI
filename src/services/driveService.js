import { google } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';

class DriveService {
  constructor() {
    this.drive = null;
  }

  /**
   * Initialize Google Drive API client
   */
  async initialize() {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.googleServiceAccountEmail,
          private_key: config.googlePrivateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      this.drive = google.drive({ version: 'v3', auth });
      logger.info('Google Drive API initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Drive API', error);
      throw error;
    }
  }

  /**
   * Extract folder ID from Drive URL
   * @param {string} url 
   * @returns {string} Folder ID
   */
  extractFolderId(url) {
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    throw new Error(`Could not extract folder ID from URL: ${url}`);
  }

  /**
   * List subfolders with yyyy-mm or yyyy年mm月 naming pattern
   * @param {string} parentFolderId 
   * @returns {Array} Array of subfolders with normalized names
   */
  async listMonthFolders(parentFolderId) {
    try {
      const query = [
        `'${parentFolderId}' in parents`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`,
      ].join(' and ');

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        orderBy: 'name desc',
      });

      const folders = response.data.files || [];
      
      // Filter and normalize folders with month patterns
      const monthFolders = [];
      for (const folder of folders) {
        const normalized = this.normalizeMonthFolderName(folder.name);
        if (normalized) {
          monthFolders.push({
            id: folder.id,
            name: folder.name,           // Original name
            normalizedName: normalized,  // yyyy-mm format
          });
        }
      }

      logger.info(`Found ${monthFolders.length} month folders in parent folder ${parentFolderId}`);
      if (monthFolders.length > 0) {
        logger.info(`Month folders: ${monthFolders.map(f => f.name).join(', ')}`);
      }
      return monthFolders;
    } catch (error) {
      logger.error(`Failed to list month folders in ${parentFolderId}`, error);
      throw error;
    }
  }

  /**
   * Normalize month folder name to yyyy-mm format
   * Supports patterns: yyyy-mm, yyyy年mm月, yyyy年m月
   * @param {string} folderName 
   * @returns {string|null} Normalized yyyy-mm or null if not a month folder
   */
  normalizeMonthFolderName(folderName) {
    // Pattern 1: yyyy-mm (e.g., "2026-01")
    const pattern1 = /^(\d{4})-(\d{2})$/;
    const match1 = folderName.match(pattern1);
    if (match1) {
      return `${match1[1]}-${match1[2]}`;
    }

    // Pattern 2: yyyy年mm月 or yyyy年m月 (e.g., "2025年11月", "2025年9月")
    const pattern2 = /^(\d{4})年(\d{1,2})月$/;
    const match2 = folderName.match(pattern2);
    if (match2) {
      const year = match2[1];
      const month = match2[2].padStart(2, '0');  // Zero padding
      return `${year}-${month}`;
    }

    return null;
  }

  /**
   * List video files in folder within date range
   * Searches in month subfolders based on date range
   * @param {string} parentFolderId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Array} Array of video files
   */
  async listVideosInFolder(parentFolderId, startDate, endDate) {
    try {
      // Get all month folders (normalized to yyyy-mm)
      const monthFolders = await this.listMonthFolders(parentFolderId);
      
      if (monthFolders.length === 0) {
        logger.warn(`No month subfolders found in ${parentFolderId}`);
        return [];
      }

      // Determine which month folders to search based on date range
      const targetMonths = this.getTargetMonths(startDate, endDate);
      logger.info(`Target months for date range: ${targetMonths.join(', ')}`);

      // Filter folders that match target months (using normalized names)
      const relevantFolders = monthFolders.filter(folder => 
        targetMonths.includes(folder.normalizedName)
      );

      if (relevantFolders.length === 0) {
        logger.info(`No matching month folders found for date range ${startDate.toISOString()} to ${endDate.toISOString()}`);
        return [];
      }

      logger.info(`Searching in ${relevantFolders.length} month folders: ${relevantFolders.map(f => f.name).join(', ')}`);

      // Search for videos in each relevant folder
      const allVideos = [];
      for (const folder of relevantFolders) {
        const videos = await this.listVideosInSubfolder(folder.id, startDate, endDate);
        allVideos.push(...videos);
      }

      logger.info(`Total ${allVideos.length} video files found across all month folders`);
      return allVideos;
    } catch (error) {
      logger.error(`Failed to list videos in folder ${parentFolderId}`, error);
      throw error;
    }
  }

  /**
   * List video files in a specific subfolder with date filtering
   * @param {string} folderId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Array} Array of video files
   */
  async listVideosInSubfolder(folderId, startDate, endDate) {
    try {
      logger.info(`Listing videos in subfolder ${folderId}`);
      logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const query = [
        `'${folderId}' in parents`,
        `(mimeType='video/mp4' or mimeType='video/quicktime')`,
        `trashed=false`,
      ].join(' and ');

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, size)',
        orderBy: 'createdTime desc',
      });

      const files = response.data.files || [];
      logger.info(`Found ${files.length} video files in subfolder ${folderId}`);

      // Filter by date range (convert createdTime to JST)
      const filteredFiles = files.filter(file => {
        const createdTime = new Date(file.createdTime);
        const isInRange = createdTime >= startDate && createdTime <= endDate;
        
        if (isInRange) {
          logger.info(`File "${file.name}" matched: createdTime=${createdTime.toISOString()}`);
        } else {
          logger.debug(`File "${file.name}" skipped: createdTime=${createdTime.toISOString()} (out of range)`);
        }
        
        return isInRange;
      });

      logger.info(`${filteredFiles.length} files match date range in this subfolder`);
      return filteredFiles;
    } catch (error) {
      logger.error(`Failed to list videos in subfolder ${folderId}`, error);
      throw error;
    }
  }

  /**
   * Get target month folder names (yyyy-mm) for date range
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Array<string>} Array of yyyy-mm strings
   */
  getTargetMonths(startDate, endDate) {
    const months = [];
    const current = new Date(startDate);
    current.setDate(1); // Set to first day of month

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
      
      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Download file from Drive
   * @param {string} fileId 
   * @param {string} fileName 
   * @returns {string} Local file path
   */
  async downloadFile(fileId, fileName) {
    try {
      // Ensure downloads directory exists
      logger.info(`Creating directory: ${config.downloadsDir}`);
      await mkdir(config.downloadsDir, { recursive: true });
      
      // Verify directory was created
      if (!existsSync(config.downloadsDir)) {
        throw new Error(`Failed to create directory: ${config.downloadsDir}`);
      }
      logger.info(`Directory confirmed: ${config.downloadsDir}`);

      const destPath = join(config.downloadsDir, fileName);
      const destDir = dirname(destPath);
      
      // Ensure the parent directory of the file also exists
      if (destDir !== config.downloadsDir) {
        await mkdir(destDir, { recursive: true });
      }

      logger.info(`Downloading file ${fileId} to ${destPath}`);

      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      // Create write stream after directory is confirmed to exist
      const dest = createWriteStream(destPath);

      return new Promise((resolve, reject) => {
        let hasError = false;

        dest.on('error', (err) => {
          hasError = true;
          logger.error(`Error writing file ${fileName}`, err);
          reject(err);
        });

        response.data
          .on('end', () => {
            if (!hasError) {
              logger.info(`Successfully downloaded ${fileName}`);
              resolve(destPath);
            }
          })
          .on('error', err => {
            hasError = true;
            logger.error(`Error downloading ${fileName}`, err);
            reject(err);
          })
          .pipe(dest);
      });
    } catch (error) {
      logger.error(`Failed to download file ${fileId}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId 
   * @returns {Object} File metadata
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, createdTime, size',
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get metadata for file ${fileId}`, error);
      throw error;
    }
  }
}

export const driveService = new DriveService();

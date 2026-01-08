import { google } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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
   * List subfolders with yyyy-mm naming pattern
   * @param {string} parentFolderId 
   * @returns {Array} Array of subfolders
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
      
      // Filter folders with yyyy-mm pattern
      const monthFolders = folders.filter(folder => {
        return /^\d{4}-\d{2}$/.test(folder.name);
      });

      logger.info(`Found ${monthFolders.length} month folders (yyyy-mm) in parent folder ${parentFolderId}`);
      return monthFolders;
    } catch (error) {
      logger.error(`Failed to list month folders in ${parentFolderId}`, error);
      throw error;
    }
  }

  /**
   * List video files in folder within date range
   * Searches in yyyy-mm subfolders based on date range
   * @param {string} parentFolderId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Array} Array of video files
   */
  async listVideosInFolder(parentFolderId, startDate, endDate) {
    try {
      // Get all month folders (yyyy-mm)
      const monthFolders = await this.listMonthFolders(parentFolderId);
      
      if (monthFolders.length === 0) {
        logger.warn(`No yyyy-mm subfolders found in ${parentFolderId}`);
        return [];
      }

      // Determine which month folders to search based on date range
      const targetMonths = this.getTargetMonths(startDate, endDate);
      logger.info(`Target months for date range: ${targetMonths.join(', ')}`);

      // Filter folders that match target months
      const relevantFolders = monthFolders.filter(folder => 
        targetMonths.includes(folder.name)
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
        return createdTime >= startDate && createdTime <= endDate;
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
      await mkdir(config.downloadsDir, { recursive: true });

      const destPath = join(config.downloadsDir, fileName);
      const dest = createWriteStream(destPath);

      logger.info(`Downloading file ${fileId} to ${destPath}`);

      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            logger.info(`Successfully downloaded ${fileName}`);
            resolve(destPath);
          })
          .on('error', err => {
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

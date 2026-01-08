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
   * List video files in folder within date range
   * @param {string} folderId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Array} Array of video files
   */
  async listVideosInFolder(folderId, startDate, endDate) {
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
      logger.info(`Found ${files.length} video files in folder ${folderId}`);

      // Filter by date range (convert createdTime to JST)
      const filteredFiles = files.filter(file => {
        const createdTime = new Date(file.createdTime);
        return createdTime >= startDate && createdTime <= endDate;
      });

      logger.info(`${filteredFiles.length} files match date range ${startDate.toISOString()} to ${endDate.toISOString()}`);

      return filteredFiles;
    } catch (error) {
      logger.error(`Failed to list videos in folder ${folderId}`, error);
      throw error;
    }
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

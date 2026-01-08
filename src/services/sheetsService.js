import { google } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

class SheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = config.googleSheetsId;
  }

  /**
   * Initialize Google Sheets API client
   */
  async initialize() {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.googleServiceAccountEmail,
          private_key: config.googlePrivateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      logger.info('Google Sheets API initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets API', error);
      throw error;
    }
  }

  /**
   * Read input data from 新フォルダURL sheet
   * @returns {Array} Array of tutor records { tutorName, folderUrl }
   */
  async readInputSheet() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: '新フォルダURL!A2:D', // From row 2 onwards
      });

      const rows = response.data.values || [];
      logger.info(`Read ${rows.length} rows from 新フォルダURL sheet`);

      return rows.map(row => ({
        tutorName: row[0] || '',     // A column: 講師名 (index 0)
        folderUrl: row[2] || '',     // C column: 新しいフォルダURL (index 2)
      })).filter(record => record.tutorName && record.folderUrl);
    } catch (error) {
      logger.error('Failed to read input sheet', error);
      throw error;
    }
  }

  /**
   * Get or create sheet by name
   * @param {string} sheetName 
   * @returns {number} Sheet ID
   */
  async getOrCreateSheet(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
      
      if (sheet) {
        return sheet.properties.sheetId;
      }

      // Create new sheet
      const addSheetResponse = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              }
            }
          }]
        }
      });

      logger.info(`Created new sheet: ${sheetName}`);
      return addSheetResponse.data.replies[0].addSheet.properties.sheetId;
    } catch (error) {
      logger.error(`Failed to get or create sheet: ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Get existing data from a sheet (for idempotency check)
   * @param {string} sheetName 
   * @returns {Array} Existing rows
   */
  async getSheetData(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      return response.data.values || [];
    } catch (error) {
      // Sheet might not exist yet
      if (error.code === 400) {
        return [];
      }
      logger.error(`Failed to get sheet data: ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Write headers to sheet if empty
   * @param {string} sheetName 
   * @param {Array} headers 
   */
  async writeHeaders(sheetName, headers) {
    try {
      const existingData = await this.getSheetData(sheetName);
      
      if (existingData.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });
        logger.info(`Wrote headers to ${sheetName}`);
      }
    } catch (error) {
      logger.error(`Failed to write headers to ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Append rows to sheet
   * @param {string} sheetName 
   * @param {Array} rows 
   */
  async appendRows(sheetName, rows) {
    try {
      if (rows.length === 0) {
        logger.info(`No rows to append to ${sheetName}`);
        return;
      }

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });

      logger.info(`Appended ${rows.length} rows to ${sheetName}`);
    } catch (error) {
      logger.error(`Failed to append rows to ${sheetName}`, error);
      throw error;
    }
  }

  /**
   * Get processed file IDs from daily_lessons (for idempotency)
   * @returns {Set} Set of processed drive_file_id
   */
  async getProcessedFileIds() {
    try {
      const data = await this.getSheetData('daily_lessons');
      
      if (data.length <= 1) {
        return new Set(); // No data or only headers
      }

      // Find drive_file_id column index
      const headers = data[0];
      const fileIdIndex = headers.indexOf('drive_file_id');
      
      if (fileIdIndex === -1) {
        return new Set();
      }

      // Extract file IDs from rows
      const fileIds = data.slice(1)
        .map(row => row[fileIdIndex])
        .filter(id => id && id !== '');

      return new Set(fileIds);
    } catch (error) {
      logger.warn('Failed to get processed file IDs, treating as empty', error);
      return new Set();
    }
  }
}

export const sheetsService = new SheetsService();

import ffmpeg from 'fluent-ffmpeg';
import { mkdir } from 'fs/promises';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

class AudioService {
  constructor() {
    this.audioDir = config.audioDir;
  }

  /**
   * Initialize audio service
   */
  async initialize() {
    await mkdir(this.audioDir, { recursive: true });
    logger.info('Audio service initialized');
  }

  /**
   * Extract audio from video file
   * @param {string} videoPath 
   * @param {string} fileId 
   * @returns {string} Audio file path
   */
  async extractAudio(videoPath, fileId) {
    const audioPath = join(this.audioDir, `${fileId}.wav`);

    return new Promise((resolve, reject) => {
      logger.info(`Extracting audio from ${videoPath}`);

      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1) // Mono
        .audioFrequency(16000) // 16kHz sample rate
        .on('start', commandLine => {
          logger.debug(`FFmpeg command: ${commandLine}`);
        })
        .on('end', () => {
          logger.info(`Audio extracted to ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', err => {
          logger.error(`Failed to extract audio from ${videoPath}`, err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Normalize audio loudness using ffmpeg-normalize
   * @param {string} audioPath 
   * @returns {string} Normalized audio path
   */
  async normalizeAudio(audioPath) {
    const normalizedPath = audioPath.replace('.wav', '_normalized.wav');

    try {
      logger.info(`Normalizing audio: ${audioPath}`);

      // Using ffmpeg loudnorm filter for loudness normalization
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .audioFilters([
            {
              filter: 'loudnorm',
              options: {
                I: -16,    // Target integrated loudness (LUFS)
                TP: -1.5,  // True peak
                LRA: 11    // Loudness range
              }
            },
            'highpass=f=80',     // Remove low-frequency noise
            'lowpass=f=8000'     // Remove high-frequency noise
          ])
          .output(normalizedPath)
          .audioCodec('pcm_s16le')
          .audioChannels(1)
          .audioFrequency(16000)
          .on('end', () => {
            logger.info(`Audio normalized: ${normalizedPath}`);
            resolve(normalizedPath);
          })
          .on('error', err => {
            logger.error(`Failed to normalize audio`, err);
            reject(err);
          })
          .run();
      });

      return normalizedPath;
    } catch (error) {
      logger.warn('Audio normalization failed, using original audio', error);
      return audioPath; // Fallback to original
    }
  }

  /**
   * Get audio duration in seconds
   * @param {string} audioPath 
   * @returns {number} Duration in seconds
   */
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format.duration;
          resolve(duration);
        }
      });
    });
  }

  /**
   * Process video: extract and normalize audio
   * @param {string} videoPath 
   * @param {string} fileId 
   * @returns {Object} { audioPath, duration }
   */
  async processVideo(videoPath, fileId) {
    let rawAudioPath = null;
    
    try {
      // Extract audio
      rawAudioPath = await this.extractAudio(videoPath, fileId);
      
      // Delete video file immediately after extraction to free memory
      logger.info(`Deleting video file to free memory: ${videoPath}`);
      await unlink(videoPath).catch(err => logger.warn(`Failed to delete video file: ${err.message}`));

      // Normalize audio
      const normalizedAudioPath = await this.normalizeAudio(rawAudioPath);

      // Delete raw audio file if normalization was successful and created a new file
      if (normalizedAudioPath !== rawAudioPath) {
        logger.info(`Deleting raw audio file to free memory: ${rawAudioPath}`);
        await unlink(rawAudioPath).catch(err => logger.warn(`Failed to delete raw audio: ${err.message}`));
      }

      // Get duration
      const duration = await this.getAudioDuration(normalizedAudioPath);

      logger.info(`Video processed: ${fileId}, duration: ${duration}s`);

      return {
        audioPath: normalizedAudioPath,
        duration: Math.round(duration),
      };
    } catch (error) {
      logger.error(`Failed to process video ${fileId}`, error);
      
      // Cleanup on error
      if (rawAudioPath) {
        await unlink(rawAudioPath).catch(() => {});
      }
      await unlink(videoPath).catch(() => {});
      
      throw error;
    }
  }
}

export const audioService = new AudioService();

import pythonClient from './pythonClient.js';
import logger from '../../utils/logger.js';

const recoverService = {
  async recoverFiles(filePath, targetPath, options = {}) {
    try {
      const response = await pythonClient.recover(filePath, targetPath, options);
      return response;
    } catch (error) {
      logger.error(`Error recovering files: ${error.message}`);
      throw error;
    }
  }
};

export default recoverService;

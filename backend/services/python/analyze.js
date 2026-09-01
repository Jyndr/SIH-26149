import pythonClient from './pythonClient.js';
import logger from '../../utils/logger.js';

const analyzeService = {
  async analyzeEvidence(filePath, options = {}) {
    try {
      const response = await pythonClient.analyze(filePath, options);
      return response;
    } catch (error) {
      logger.error(`Error analyzing evidence: ${error.message}`);
      throw error;
    }
  }
};

export default analyzeService;

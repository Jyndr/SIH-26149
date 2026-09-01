import crypto from 'crypto';
import fs from 'fs';

const hashService = {
  computeSHA256: async (stream) => {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  },

  computeSHA256FromFile: async (filePath) => {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  }
};

export default hashService;

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultEngineRoot = path.resolve(__dirname, '../../../forensic-engine');

const resolveEngineRoot = () =>
  path.resolve(process.cwd(), process.env.FORENSIC_ENGINE_PATH || defaultEngineRoot);

const pythonClient = {
  async analyze(evidencePath, outputPath, caseId, options = {}) {
    return this.runCLI(evidencePath, outputPath, caseId, options);
  },

  async recover(evidencePath, outputPath, caseId, options = {}) {
    return this.runCLI(evidencePath, outputPath, caseId, options);
  },

  async runCLI(evidencePath, outputPath, caseId, options = {}) {
    const engineRoot = resolveEngineRoot();
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const reportPath = path.join(outputPath, caseId, 'report.json');

    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });

    const args = [
      '-m', 'cli.main',
      'analyze',
      evidencePath,
      '--case-id', caseId,
      '--output', outputPath,
      '--report', reportPath
    ];

    if (options.chunkSize) args.push('--chunk-size', String(options.chunkSize));
    if (options.maxCarveSize) args.push('--max-carve-size', String(options.maxCarveSize));

    logger.info(`Running forensic-engine: ${pythonBin} ${args.join(' ')} (cwd=${engineRoot})`);

    return new Promise((resolve, reject) => {
      const child = spawn(pythonBin, args, {
        cwd: engineRoot,
        env: { ...process.env, PYTHONPATH: engineRoot }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        if (code === 0) {
          try {
            const reportData = await fs.promises.readFile(reportPath, 'utf8');
            resolve({ jobId: caseId, report: JSON.parse(reportData), stdout });
          } catch (error) {
            logger.error(`Error reading report.json: ${error.message}`);
            reject(error);
          }
        } else {
          const message = stderr || stdout || `forensic-engine exited with code ${code}`;
          logger.error(`forensic-engine failed: ${message}`);
          reject(new Error(message));
        }
      });

      child.on('error', (error) => {
        logger.error(`Error spawning forensic-engine: ${error.message}`);
        reject(error);
      });
    });
  }
};

export default pythonClient;

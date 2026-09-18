import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { message: 'The disk image exceeds the configured upload size limit.' }
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

export default errorHandler;

import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : queryToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No token provided' }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' }
    });
  }
};

export default auth;

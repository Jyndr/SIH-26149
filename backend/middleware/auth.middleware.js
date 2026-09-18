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
        error: { message: 'Authentication token is required' }
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'INVESTIGATOR'
    };
    return next();
  } catch (error) {
    logger.warn(`Authentication rejected: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' }
    });
  }
};

export default auth;

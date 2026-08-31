import authService from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const authController = {
  register: async (req, res, next) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await authService.register(validatedData);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      if (error.message === 'User already exists with this email') {
        return res.status(409).json({
          success: false,
          error: {
            message: error.message
          }
        });
      }
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await authService.login(validatedData);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      if (error.message === 'Invalid credentials' || error.message === 'Account is disabled') {
        return res.status(401).json({
          success: false,
          error: {
            message: error.message
          }
        });
      }
      next(error);
    }
  },

  me: async (req, res, next) => {
    try {
      const user = await authService.me(req.user.id);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message
          }
        });
      }
      next(error);
    }
  }
};

export default authController;

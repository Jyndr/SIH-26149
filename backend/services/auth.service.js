import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const generateUserId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `USR-${random}`;
};

const authService = {
  register: async (data) => {
    try {
      const { name, email, password } = data;
      
      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Generate userId
      const userId = generateUserId();
      
      // Create user
      const user = await User.create({
        userId,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'INVESTIGATOR' // Default role
      });
      
      logger.info(`User registered: ${userId}`);
      
      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.passwordHash;
      
      return userResponse;
    } catch (error) {
      logger.error(`Error registering user: ${error.message}`);
      throw error;
    }
  },

  login: async (data) => {
    try {
      const { email, password } = data;
      
      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      // Check if active
      if (!user.isActive) {
        throw new Error('Account is disabled');
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }
      
      // Generate JWT
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      logger.info(`User logged in: ${user.userId}`);
      
      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.passwordHash;
      
      return { user: userResponse, token };
    } catch (error) {
      logger.error(`Error logging in user: ${error.message}`);
      throw error;
    }
  },

  me: async (userId) => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const userResponse = user.toObject();
      delete userResponse.passwordHash;
      
      return userResponse;
    } catch (error) {
      logger.error(`Error getting user: ${error.message}`);
      throw error;
    }
  }
};

export default authService;

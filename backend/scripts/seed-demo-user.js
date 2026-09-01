import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const demoUser = {
  userId: 'USR-DEMO1',
  name: 'Demo User',
  email: 'demo@jyndr.com',
  password: 'demo123',
  role: 'INVESTIGATOR'
};

const seedDemoUser = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: demoUser.email });
    if (existingUser) {
      console.log('Demo user already exists!');
      console.log('Email:', demoUser.email);
      console.log('Password:', demoUser.password);
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(demoUser.password, 10);

    // Create demo user
    const user = await User.create({
      userId: demoUser.userId,
      name: demoUser.name,
      email: demoUser.email,
      passwordHash,
      role: demoUser.role,
      isActive: true
    });

    console.log('\n✅ Demo user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:   ', demoUser.email);
    console.log('Password:', demoUser.password);
    console.log('Role:    ', demoUser.role);
    console.log('User ID: ', user.userId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now login at http://localhost:5174/login');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  } catch (error) {
    console.error('Error seeding demo user:', error.message);
    process.exit(1);
  }
};

seedDemoUser();

# Jyndr - Setup Guide

Complete setup instructions for the Jyndr Digital Forensics Platform.

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Docker (for MongoDB)
- Git

## Quick Start

### 1. Start MongoDB

```bash
docker run -d -p 27017:27017 --name mongodb-jyndr mongo:8.0
```

To stop MongoDB later:
```bash
docker stop mongodb-jyndr
```

To start it again:
```bash
docker start mongodb-jyndr
```

### 2. Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd client
npm install
cd ..

# Python forensic engine
cd forensic-engine
pip3 install -e .
cd ..
```

### 3. Create Demo User

```bash
npm run seed:demo
```

This creates a demo account:
- **Email:** demo@jyndr.com
- **Password:** demo123
- **Role:** INVESTIGATOR

### 4. Start the Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```
Backend runs on: http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:5174 (or 5173)

### 5. Access the Application

Open your browser and go to:
- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:3000/api/v1/health

Login with the demo credentials.

## Project Structure

```
SIH-26149/
├── client/                 # React frontend (Vite + React 19)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── features/       # Feature-specific components & hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client & services
│   │   └── store/          # Zustand state management
│   └── package.json
│
├── src/                    # Node.js backend (Express + MongoDB)
│   ├── config/            # Database & app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Auth, error handling, etc.
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Helper functions
│   └── validators/       # Zod validation schemas
│
├── forensic-engine/       # Python forensic CLI
│   ├── cli/              # Command-line interface
│   ├── core/             # Core forensic modules
│   └── formats/          # File format signatures
│
├── storage/              # File storage
│   ├── evidence/         # Uploaded evidence files
│   ├── recovered/        # Recovered files
│   └── reports/          # Generated reports
│
└── scripts/              # Utility scripts
    └── seed-demo-user.js # Create demo account
```

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (ADMIN, INVESTIGATOR, ANALYST)
- Secure password hashing with bcrypt

### Case Management
- Create and manage forensic investigation cases
- Track case status and investigators
- Case-scoped evidence and jobs

### Evidence Upload & Integrity
- Upload disk images and files
- SHA-256 hash computation and verification
- Integrity verification at any time
- Support for RAW and E01/EWF formats (with libewf-python)

### Forensic Analysis
- **Analysis:** Detect filesystem, partitions, and file signatures
- **Recovery:** Carve deleted files using signature-based detection
- Support for 10+ file formats (JPEG, PNG, PDF, ZIP, MP3, etc.)
- Chunked scanning for memory efficiency

### Data Sanitization
- Multiple sanitization methods (zero-fill, random, crypto-erase)
- Verification after sanitization
- Sanitization certificates

### Audit Trail
- Tamper-evident hash chain for all operations
- SHA-256 linking between audit entries
- Chain verification endpoint
- Complete audit log per case

### Report Generation
- Case summary reports
- Recovery reports
- Sanitization certificates
- Audit trail reports

## Environment Variables

Backend (`.env`):
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/jyndr
NODE_ENV=development
JWT_SECRET=dev-secret-key-change-in-production
CLIENT_ORIGIN=http://localhost:5173
FORENSIC_ENGINE_PATH=./forensic-engine
PYTHON_BIN=python3
```

Frontend (`client/.env`):
```env
VITE_API_BASE_URL=/api/v1
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Cases
- `GET /api/v1/cases` - List user's cases
- `POST /api/v1/cases` - Create new case
- `GET /api/v1/cases/:caseId` - Get case details
- `PATCH /api/v1/cases/:caseId` - Update case

### Evidence
- `POST /api/v1/cases/:caseId/evidence` - Upload evidence
- `GET /api/v1/cases/:caseId/evidence` - List evidence
- `GET /api/v1/evidence/:evidenceId` - Get evidence details
- `POST /api/v1/evidence/:evidenceId/verify` - Verify integrity
- `POST /api/v1/evidence/:evidenceId/analyze` - Run analysis
- `POST /api/v1/evidence/:evidenceId/recover` - Recover files

### Jobs
- `GET /api/v1/jobs/:jobId` - Get job status
- `GET /api/v1/jobs/:jobId/events` - Real-time job updates (SSE)

### Audit
- `GET /api/v1/cases/:caseId/audit` - Get audit logs
- `GET /api/v1/cases/:caseId/audit/verify-chain` - Verify chain integrity

### Reports
- `POST /api/v1/cases/:caseId/reports` - Generate report
- `GET /api/v1/cases/:caseId/reports` - List reports
- `GET /api/v1/reports/:reportId/download` - Download report

## Troubleshooting

### MongoDB Connection Issues

**Error:** "Operation `users.findOne()` buffering timed out"

**Solution:** Make sure MongoDB is running:
```bash
docker ps | grep mongodb
```

If not running, start it:
```bash
docker start mongodb-jyndr
```

### Frontend Can't Connect to Backend

**Issue:** CORS errors or connection refused

**Solution:** 
1. Check backend is running on port 3000
2. Verify `CLIENT_ORIGIN` in `.env` matches your frontend URL
3. If frontend is on different port (e.g., 5174), update `.env`:
   ```env
   CLIENT_ORIGIN=http://localhost:5174
   ```

### Python Forensic Engine Issues

**Error:** Module not found

**Solution:** Install the forensic engine:
```bash
cd forensic-engine
pip3 install -e .
```

### Port Already in Use

**Error:** Port 3000 or 5173 already in use

**Solution:** 
- Kill the process using the port:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```
- Or change the port in `.env` (backend) or `vite.config.js` (frontend)

## Development Workflow

1. **Create a case** - Start a new investigation
2. **Upload evidence** - Add disk images or files
3. **Verify integrity** - Compute and verify SHA-256 hash
4. **Analyze evidence** - Detect filesystem and partitions
5. **Recover files** - Carve deleted files from unallocated space
6. **Review recovered files** - Check recovered files and metadata
7. **Generate reports** - Create case summary or recovery report
8. **Verify audit trail** - Ensure chain integrity

## Testing

```bash
# Backend tests
npm test

# Watch mode
npm run test:watch
```

## Production Deployment

1. Update environment variables (use strong JWT_SECRET)
2. Set `NODE_ENV=production`
3. Use a proper MongoDB instance (not Docker for production)
4. Set up HTTPS/TLS
5. Configure proper CORS origins
6. Set up process manager (PM2, systemd)
7. Configure reverse proxy (nginx, Apache)

## License

Copyright © 2026 SIH Team

## Support

For issues and questions, contact the development team.

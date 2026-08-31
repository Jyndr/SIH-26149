# Jyndr - Digital Forensics Platform

**Smart India Hackathon 2026 - Problem Statement 26149**

A comprehensive digital forensics web application for secure data erasure and file recovery with tamper-evident audit trails.

[![GitHub](https://img.shields.io/badge/GitHub-ankitsingh138%2FSIH--26149-blue?logo=github)](https://github.com/ankitsingh138/SIH-26149)

## 🚀 Live Demo

**Demo Credentials:**
- Email: `demo@jyndr.com`
- Password: `demo123`

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication
- Role-based access control (ADMIN, INVESTIGATOR, ANALYST)
- Secure password hashing with bcrypt
- Protected API endpoints

### 📁 Case Management
- Create and manage forensic investigation cases
- Real-time case status tracking
- Evidence organization per case
- Multi-investigator collaboration

### 🔍 Evidence Analysis
- Upload disk images (RAW, E01/EWF formats)
- SHA-256 integrity verification
- Partition and filesystem detection
- Signature-based file carving
- Support for 10+ file formats (JPEG, PNG, PDF, ZIP, MP3, etc.)

### 💾 File Recovery
- Carve deleted files from unallocated space
- Signature-based detection engine
- Metadata extraction
- Confidence scoring for recovered files
- Chunked scanning for memory efficiency

### 🧹 Data Sanitization
- Multiple sanitization methods (zero-fill, random, crypto-erase)
- Post-sanitization verification
- Compliance certificates
- Secure data destruction

### 📊 Audit Trail
- Tamper-evident blockchain-like hash chain
- SHA-256 linking between entries
- Complete operation history
- Chain integrity verification
- Immutable audit logs

### 📄 Report Generation
- Case summary reports
- Recovery analysis reports
- Sanitization certificates
- Audit trail exports
- PDF/JSON export formats

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **React Router v7** - Client-side routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Tailwind CSS 4** - Utility-first styling
- **Vite 8** - Build tool

### Backend
- **Node.js + Express** - REST API server
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Multer** - File uploads
- **Zod** - Schema validation

### Forensic Engine
- **Python 3.10+** - Forensic CLI
- **Signature-based detection** - File carving
- **EWF/E01 support** - Evidence format handling
- **Format validators** - 10 strong validators

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (via Docker recommended)
- Git

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/ankitsingh138/SIH-26149.git
cd SIH-26149
```

2. **Start MongoDB**
```bash
docker run -d -p 27017:27017 --name mongodb-jyndr mongo:8.0
```

3. **Install dependencies**
```bash
# Backend
npm install

# Frontend
cd client
npm install
cd ..

# Python forensic engine
cd forensic-engine
pip3 install -e .
cd ..
```

4. **Configure environment**
```bash
# Create .env in project root
cp .env.example .env
# Update MongoDB URI and other settings if needed
```

5. **Seed demo user**
```bash
npm run seed:demo
```

6. **Start servers**

Terminal 1 - Backend:
```bash
npm run dev
```

Terminal 2 - Frontend:
```bash
cd client
npm run dev
```

7. **Access the application**
- Frontend: http://localhost:5174
- Backend API: http://localhost:3000
- Login with demo credentials

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Detailed installation instructions
- [API Documentation](./backend%20md%20files/03-API.md) - Complete API reference
- [Architecture](./backend%20md%20files/01-ARCHITECTURE.md) - System design
- [Database Schema](./backend%20md%20files/02-DATABASE.md) - Data models
- [Python Integration](./backend%20md%20files/04-PYTHON-INTEGRATION.md) - Forensic engine docs

## 🏗️ Project Structure

```
SIH-26149/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── features/       # Feature modules
│   │   ├── pages/          # Page components
│   │   ├── services/       # API clients
│   │   └── store/          # State management
│   └── package.json
│
├── src/                    # Node.js backend
│   ├── config/            # Configuration
│   ├── controllers/       # Route handlers
│   ├── middleware/        # Auth, validation, error handling
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── validators/       # Zod schemas
│
├── forensic-engine/       # Python forensic CLI
│   ├── cli/              # Command-line interface
│   ├── core/             # Core forensic modules
│   │   ├── carving/      # File carving
│   │   ├── detection/    # Signature detection
│   │   ├── integrity/    # Hash verification
│   │   └── validation/   # Format validators
│   └── formats/          # File signatures
│
├── storage/              # File storage
│   ├── evidence/         # Uploaded evidence
│   ├── recovered/        # Recovered files
│   └── reports/          # Generated reports
│
└── scripts/              # Utility scripts
```

## 🎯 Key Workflows

### 1. Evidence Analysis
1. Create a case
2. Upload evidence (disk image)
3. Verify integrity (SHA-256)
4. Run analysis (detect filesystem/partitions)
5. Review analysis results

### 2. File Recovery
1. Analyze evidence first
2. Run recovery job
3. Monitor job progress (real-time SSE)
4. Review recovered files
5. Download recovered artifacts

### 3. Data Sanitization
1. Select target (file/folder/drive)
2. Choose sanitization method
3. Execute sanitization job
4. Verify sanitization
5. Generate certificate

### 4. Audit Verification
1. View audit timeline
2. Verify hash chain integrity
3. Export audit logs
4. Generate compliance reports

## 🔗 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Current user

### Cases
- `GET /api/v1/cases` - List cases
- `POST /api/v1/cases` - Create case
- `GET /api/v1/cases/:id` - Case details
- `PATCH /api/v1/cases/:id` - Update case

### Evidence
- `POST /api/v1/cases/:caseId/evidence` - Upload
- `POST /api/v1/evidence/:id/verify` - Verify integrity
- `POST /api/v1/evidence/:id/analyze` - Run analysis
- `POST /api/v1/evidence/:id/recover` - Recover files

### Jobs
- `GET /api/v1/jobs/:id` - Job status
- `GET /api/v1/jobs/:id/events` - Real-time updates (SSE)

### Audit
- `GET /api/v1/cases/:caseId/audit` - Audit logs
- `GET /api/v1/cases/:caseId/audit/verify-chain` - Verify integrity

## 🧪 Testing

```bash
# Backend tests
npm test

# Watch mode
npm run test:watch
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is part of Smart India Hackathon 2026.

## 👥 Team

**SIH Problem Statement**: 26149 - Integrated Secure Data Erasure & File Recovery Tool

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/ankitsingh138/SIH-26149/issues)
- Email: Contact team members

## 🙏 Acknowledgments

- Smart India Hackathon 2026
- Open source forensic tools community
- All contributors and testers

---

**Built with ❤️ for Smart India Hackathon 2026**

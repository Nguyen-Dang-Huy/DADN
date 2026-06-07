
# IoT Smart Home Control System

A complete IoT smart home control system with real-time sensor monitoring, device control, and automatic automation features.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- MySQL 8.0+
- pnpm package manager
- Git

### Installation
```bash
# Clone repository
git clone https://github.com/Dahlia1337/DADN-HK252-Smart-Home-HDPE.git
cd DADN-HK252-Smart-Home-HDPE

# Install dependencies
pnpm install
```

### Database Setup
```bash
# Create MySQL database
mysql -u root -p < packages/web-backend/schema.sql
```

### Environment Configuration
Create `.env` files in respective packages:

**Backend (.env in packages/web-backend/):**
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=iot_smart_home

# MQTT Configuration (Adafruit IO)
MQTT_BROKER_URL=mqtt://io.adafruit.com
MQTT_USERNAME=your_adafruit_username
MQTT_KEY=your_adafruit_key

# Server Configuration
PORT=3000
```

**Frontend (.env in packages/web-frontend/):**
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### Running the Application
```bash
# Start backend
pnpm start:backend

# Start frontend (in new terminal)
pnpm dev
```

Visit `http://localhost:5173` for the dashboard.

##  Project Structure

```
├── packages/
│   ├── shared/          # Shared utilities and repositories
│   ├── web-backend/     # Node.js Express API server
│   │   ├── src/
│   │   │   ├── config/      # Database configuration
│   │   │   ├── controllers/  # API controllers
│   │   │   ├── repositories/ # Data access layer
│   │   │   ├── routes/       # API routes
│   │   │   └── services/     # Business logic & MQTT
│   │   ├── schema.sql        # Database schema
│   │   └── package.json
│   └── web-frontend/    # React dashboard
│       ├── src/
│       │   ├── api/          # API client
│       │   ├── app/          # Main app components
│       │   ├── components/   # UI components
│       │   └── routes/       # Routing
│       └── package.json
├── pnpm-workspace.yaml # Monorepo configuration
└── package.json        # Root workspace config
```

## 🔧 Development

### Available Scripts
```bash
# Install all dependencies
pnpm install

# Start backend server
pnpm start:backend

# Start frontend development server
pnpm dev

# Build frontend for production
pnpm build

# Run tests (when implemented)
pnpm test
```

### API Endpoints
- `GET /api/sensors/latest` - Get latest sensor data
- `POST /api/devices/{id}/control` - Control devices
- `POST /api/config/threshold` - Set temperature threshold
- `GET /api/logs` - Get activity history

### Database Deployment
- **Local**: Use XAMPP or MySQL installer
- **Cloud**: Use AWS RDS, Google Cloud SQL, or PlanetScale
- **Free**: Use Railway or Supabase

## 📤 Pushing Code to GitHub

### Initial Setup
```bash
# Initialize git (if not done)
git init

# Add remote repository
git remote add origin https://github.com/Dahlia1337/DADN-HK252-Smart-Home-HDPE.git

# Create main branch
git branch -M main
```

### Daily Workflow
```bash
# Check status
git status

# Add changes
git add .

# Commit with meaningful message
git commit -m "feat: add sensor monitoring feature

- Implement real-time temperature/humidity display
- Add automatic fan control based on threshold
- Update dashboard UI with sensor data"

# Push to GitHub
git push -u origin main
```

### Branching Strategy
```bash
# Create feature branch
git checkout -b feature/sensor-integration

# Work on feature...
git add .
git commit -m "feat: integrate DHT20 sensor"

# Push branch
git push -u origin feature/sensor-integration

# Create pull request on GitHub
# Merge after review
```

### Pull Request Template
When creating PRs, use this format:
```
## 🎯 Feature Summary
Brief description of what this PR implements

##  Changes Made
- [x] Backend API endpoint for sensor data
- [x] Frontend dashboard component
- [x] Database schema updates

## 🧪 Testing
- [x] Manual testing of sensor data flow
- [x] API endpoint validation
- [x] UI responsiveness check

## 📚 Documentation
- [x] Updated README with new features
- [x] API documentation updated

Closes #issue-number
```

## 🔒 Security Notes
- Never commit `.env` files with real credentials
- Use environment variables for sensitive data
- Regularly update dependencies
- Use HTTPS for production deployments

## 📞 Support
For issues or questions:
- Create GitHub issue
- Check troubleshooting section in backend README
- Review API documentation

## 📄 License
This project is part of DADN-HK252 course work.
  

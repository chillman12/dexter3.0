# DEXTER v3.0 Deployment Guide

## 🚀 Production Deployment

### **System Requirements**

#### **Minimum Requirements**
- **CPU**: 2 cores, 2.4 GHz
- **RAM**: 4 GB
- **Storage**: 10 GB SSD
- **Network**: Stable internet connection
- **OS**: Windows 10+, Ubuntu 20.04+, macOS 10.15+

#### **Recommended Requirements**
- **CPU**: 4+ cores, 3.0+ GHz
- **RAM**: 8+ GB
- **Storage**: 20+ GB NVMe SSD
- **Network**: High-speed internet (100+ Mbps)
- **OS**: Latest stable versions

### **Prerequisites Installation**

#### **1. Rust Installation**
```bash
# Install Rust (latest stable)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

#### **2. Node.js Installation**
```bash
# Download and install Node.js v18+ from https://nodejs.org/
# Or use package manager:

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (with Homebrew)
brew install node@18

# Windows (with Chocolatey)
choco install nodejs
```

#### **3. Git Installation**
```bash
# Ubuntu/Debian
sudo apt-get install git

# macOS (with Homebrew)
brew install git

# Windows: Download from https://git-scm.com/
```

### **Repository Setup**

```bash
# Clone the repository
git clone https://github.com/maximumskif/dexterupdate.git
cd dexterupdate/dester

# Verify directory structure
ls -la
# Should show: backend/ frontend/ README.md CHANGELOG.md
```

## 🔧 Backend Deployment

### **1. Build Backend**
```bash
cd backend

# Install dependencies and build
cargo build --release

# Verify build
ls target/release/
# Should show: dexter-arbitrage.exe (Windows) or dexter-arbitrage (Unix)
```

### **2. Configuration**
```bash
# Create environment file (optional)
touch .env

# Add configuration (if needed)
echo "RUST_LOG=info" >> .env
echo "API_PORT=3001" >> .env
echo "WS_PORT=3002" >> .env
```

### **3. Start Backend Service**

#### **Development Mode**
```bash
cd backend
cargo run
```

#### **Production Mode**
```bash
cd backend
RUST_LOG=info ./target/release/dexter-arbitrage
```

#### **Background Service (Linux/macOS)**
```bash
# Using nohup
nohup ./target/release/dexter-arbitrage > dexter.log 2>&1 &

# Using systemd (recommended for production)
sudo nano /etc/systemd/system/dexter.service
```

**Systemd Service File:**
```ini
[Unit]
Description=DEXTER v3.0 Arbitrage Backend
After=network.target

[Service]
Type=simple
User=dexter
WorkingDirectory=/path/to/dexterupdate/dester/backend
ExecStart=/path/to/dexterupdate/dester/backend/target/release/dexter-arbitrage
Restart=always
RestartSec=10
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable dexter.service
sudo systemctl start dexter.service
sudo systemctl status dexter.service
```

### **4. Verify Backend**
```bash
# Test API endpoints
curl http://localhost:3001/api/v1/platform-stats
curl http://localhost:3001/api/v1/market-depth/SOL/USDC

# Check WebSocket
wscat -c ws://localhost:3002
```

## 🌐 Frontend Deployment

### **1. Install Dependencies**
```bash
cd frontend
npm install

# Verify installation
npm list --depth=0
```

### **2. Environment Configuration**
```bash
# Create environment file
touch .env.local

# Add configuration
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" >> .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:3002" >> .env.local
```

### **3. Build Frontend**

#### **Development Mode**
```bash
npm run dev
# Access: http://localhost:3000
```

#### **Production Build**
```bash
# Build for production
npm run build

# Start production server
npm start
```

### **4. Production Deployment Options**

#### **Option A: PM2 (Recommended)**
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "dexter-frontend" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

#### **Option B: Docker**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run Docker container
docker build -t dexter-frontend .
docker run -d -p 3000:3000 --name dexter-frontend dexter-frontend
```

#### **Option C: Nginx Reverse Proxy**
```nginx
# /etc/nginx/sites-available/dexter
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/dexter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Health Checks & Monitoring

### **Backend Health Check**
```bash
#!/bin/bash
# health_check.sh

# Check if backend is running
if curl -f http://localhost:3001/api/v1/platform-stats > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is down"
    exit 1
fi

# Check WebSocket
if wscat -c ws://localhost:3002 -x "ping" > /dev/null 2>&1; then
    echo "✅ WebSocket is healthy"
else
    echo "❌ WebSocket is down"
    exit 1
fi
```

### **Frontend Health Check**
```bash
#!/bin/bash
# frontend_health.sh

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is down"
    exit 1
fi
```

### **Monitoring Script**
```bash
#!/bin/bash
# monitor.sh

while true; do
    echo "$(date): Checking DEXTER v3.0 services..."
    
    # Check backend
    if ! curl -f http://localhost:3001/api/v1/platform-stats > /dev/null 2>&1; then
        echo "Backend down, restarting..."
        systemctl restart dexter.service
    fi
    
    # Check frontend
    if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo "Frontend down, restarting..."
        pm2 restart dexter-frontend
    fi
    
    sleep 60
done
```

## 🐛 Troubleshooting

### **Common Issues**

#### **1. Compilation Errors**
```bash
# Issue: "use of moved value: depth"
# Solution: Already fixed in v3.0.1

# Issue: Cargo.toml not found
# Solution: Make sure you're in the backend directory
cd dester/backend
cargo run
```

#### **2. Port Already in Use**
```bash
# Find process using port
netstat -tulpn | grep :3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
cargo run -- --port 3003
```

#### **3. PowerShell Command Issues (Windows)**
```powershell
# Issue: && operator not supported
# Wrong: cd backend && cargo run
# Correct: cd backend; cargo run

# Or use separate commands
cd backend
cargo run
```

#### **4. External API Timeouts**
```bash
# Check internet connectivity
ping google.com

# Test external APIs manually
curl "https://price.jup.ag/v4/price?ids=SOL"
curl "https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/So11111111111111111111111111111111111111112"
```

#### **5. WebSocket Connection Issues**
```bash
# Check if WebSocket server is running
netstat -an | grep :3002

# Test WebSocket connection
wscat -c ws://localhost:3002

# Check firewall settings
sudo ufw allow 3002
```

### **Log Analysis**

#### **Backend Logs**
```bash
# View real-time logs
tail -f dexter.log

# Search for errors
grep -i error dexter.log

# Check specific timeframe
grep "2025-05-28" dexter.log
```

#### **Frontend Logs**
```bash
# PM2 logs
pm2 logs dexter-frontend

# Next.js logs
npm run dev 2>&1 | tee frontend.log
```

### **Performance Optimization**

#### **Backend Optimization**
```bash
# Build with optimizations
cargo build --release

# Set environment variables
export RUST_LOG=warn  # Reduce log verbosity
export TOKIO_WORKER_THREADS=4  # Optimize for your CPU
```

#### **Frontend Optimization**
```bash
# Optimize build
npm run build

# Enable compression in Nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

## 🔐 Security Considerations

### **Firewall Configuration**
```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Frontend (if direct access needed)
sudo ufw allow 3001  # Backend API (if direct access needed)
sudo ufw allow 3002  # WebSocket (if direct access needed)
```

### **SSL/TLS Setup**
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### **Environment Variables**
```bash
# Never commit sensitive data
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# Use environment variables for sensitive config
export API_KEY="your-secret-key"
export DATABASE_URL="your-db-connection"
```

## 📊 Performance Monitoring

### **System Metrics**
```bash
# CPU and Memory usage
htop

# Disk usage
df -h

# Network usage
iftop
```

### **Application Metrics**
```bash
# Backend performance
curl http://localhost:3001/api/v1/platform-stats

# Check arbitrage opportunities
curl http://localhost:3001/api/v1/arbitrage-opportunities | jq '.opportunities | length'

# WebSocket connections
curl http://localhost:3001/api/v1/platform-stats | jq '.websocket_connections'
```

## 🔄 Backup & Recovery

### **Code Backup**
```bash
# Create backup
tar -czf dexter-backup-$(date +%Y%m%d).tar.gz dexterupdate/

# Restore from backup
tar -xzf dexter-backup-20250528.tar.gz
```

### **Configuration Backup**
```bash
# Backup configuration files
cp .env .env.backup
cp .env.local .env.local.backup

# Backup systemd service
sudo cp /etc/systemd/system/dexter.service /etc/systemd/system/dexter.service.backup
```

## 📞 Support

### **Getting Help**
- **GitHub Issues**: https://github.com/maximumskif/dexterupdate/issues
- **Documentation**: Check README.md and CHANGELOG.md
- **Logs**: Always include relevant log files when reporting issues

### **Reporting Issues**
1. Include system information (OS, versions)
2. Provide error logs and stack traces
3. Describe steps to reproduce
4. Include configuration files (remove sensitive data)

---

**DEXTER v3.0 - Production Ready Deployment Guide**

*Last Updated: May 28, 2025* 
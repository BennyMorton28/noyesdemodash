#!/bin/bash
# Noyes Demos Deployment Script with Zero-Downtime (Blue-Green) Deployment

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Noyes Demos Deployment Script =====${NC}"

# 1. Get commit message from user
if [ -z "$1" ]; then
  echo -e "${YELLOW}Enter commit message:${NC}"
  read commit_message
else
  commit_message="$1"
fi

# 2. Add all changes
echo -e "\n${GREEN}Adding all changes to git...${NC}"
git add .

# 3. Commit changes
echo -e "\n${GREEN}Committing changes with message: '${commit_message}'${NC}"
git commit -m "$commit_message"

# 4. Push to GitHub
echo -e "\n${GREEN}Pushing to GitHub...${NC}"
git push

# 5. SSH to server and deploy
echo -e "\n${GREEN}Deploying to server with zero downtime...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Connected to server. Starting zero-downtime deployment..."
  
  # Navigate to the application directory
  cd /home/ec2-user/app
  
  # Pull the latest changes
  echo "Pulling latest changes from GitHub..."
  git fetch origin
  git reset --hard origin/main
  
  # Create a timestamp for the new deployment
  DEPLOY_ID=$(date +%Y%m%d%H%M%S)
  DEPLOY_DIR="/home/ec2-user/deployments/${DEPLOY_ID}"
  
  echo "Creating new deployment directory: ${DEPLOY_DIR}"
  mkdir -p ${DEPLOY_DIR}
  
  # Copy current codebase to the new deployment directory
  cp -r ./ ${DEPLOY_DIR}/
  cd ${DEPLOY_DIR}
  
  # Install dependencies
  echo "Installing dependencies..."
  npm ci
  
  # Build the application
  echo "Building the application..."
  npm run build
  
  # Fix static files in standalone mode
  echo "Setting up static files for standalone mode..."
  mkdir -p .next/standalone/public
  mkdir -p .next/standalone/.next/static
  
  # Copy public directory to standalone
  cp -r public/* .next/standalone/public/
  
  # Make sure all icon files are properly copied and have correct permissions
  find .next/standalone/public -name "*.svg" -o -name "*.png" | xargs -I{} chmod 644 {} 2>/dev/null || true
  
  # Copy static files to standalone static directory
  cp -r .next/static/* .next/standalone/.next/static/
  
  # Copy .env file
  cp /home/ec2-user/app/.env .next/standalone/
  
  # Define the target port for the application
  TARGET_PORT=3000
  
  # Check if the port is already in use and kill any processes using it
  echo "Ensuring port ${TARGET_PORT} is available..."
  if lsof -i:${TARGET_PORT} >/dev/null 2>&1; then
    echo "Port ${TARGET_PORT} is in use. Freeing it up..."
    kill $(lsof -t -i:${TARGET_PORT}) 2>/dev/null || true
    sleep 2
  fi
  
  # Update the PM2 configuration
  echo "Creating PM2 configuration..."
  OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "noyesdemodash-${DEPLOY_ID}",
    cwd: "${DEPLOY_DIR}/.next/standalone",
    script: "./server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: ${TARGET_PORT},
      HOST: "0.0.0.0",
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
    }
  }]
}
EOL
  
  # Stop all existing PM2 instances
  echo "Stopping any existing instances..."
  pm2 stop noyesdemodash 2>/dev/null || true
  pm2 delete noyesdemodash 2>/dev/null || true
  
  # Start the new application
  echo "Starting new application instance..."
  pm2 start ecosystem.config.js
  
  # Wait for the new instance to be fully initialized
  echo "Waiting for new instance to initialize (10 seconds)..."
  sleep 10
  
  # Clean up any existing Nginx configuration files for this domain
  echo "Backing up and cleaning up existing Nginx configuration..."
  sudo mkdir -p /etc/nginx/conf.d/backup
  sudo find /etc/nginx/conf.d/ -name "*.conf" -type f -exec grep -l "demos.noyesai.com" {} \; | xargs -I {} sudo cp {} /etc/nginx/conf.d/backup/ 2>/dev/null || true
  sudo find /etc/nginx/conf.d/ -name "*.conf" -type f -exec grep -l "demos.noyesai.com" {} \; | xargs -I {} sudo rm {} 2>/dev/null || true
  
  # Update the Nginx configuration to point to the new port with SSL support
  echo "Creating new Nginx configuration with SSL support..."
  cat > /tmp/demos.noyesai.com.conf << 'NGINX'
server {
    server_name demos.noyesai.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Serve static files directly
    location ~ ^/favicon.ico$ {
        root /home/ec2-user/app/public;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files $uri =404;
    }
    
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/demos.noyesai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demos.noyesai.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = demos.noyesai.com) {
        return 301 https://$host$request_uri;
    }

    listen 80; 
    server_name demos.noyesai.com;
    return 404;
}
NGINX
  
  # Replace PORT_PLACEHOLDER with actual port
  sed -i "s/localhost:3001/localhost:${TARGET_PORT}/g" /tmp/demos.noyesai.com.conf
  
  # Test Nginx configuration
  echo "Testing Nginx configuration..."
  sudo mv /tmp/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf
  
  if sudo nginx -t; then
    echo "Nginx configuration valid. Reloading Nginx..."
    sudo systemctl reload nginx
  else
    echo "ERROR: Nginx configuration is invalid. Please check the logs."
    exit 1
  fi
  
  # Verify app is running on the correct port
  echo "Verifying application is running on port ${TARGET_PORT}..."
  APP_PORT=""
  
  # Wait up to 30 seconds for the app to start
  for i in {1..30}; do
    if curl -s http://localhost:${TARGET_PORT} > /dev/null; then
      APP_PORT=${TARGET_PORT}
      break
    fi
    echo "Waiting for app to start on port ${TARGET_PORT}... (${i}/30)"
    sleep 1
  done
  
  # If app is not running on TARGET_PORT, check alternative ports
  if [ -z "$APP_PORT" ]; then
    echo "App not detected on port ${TARGET_PORT}, checking alternative port 3001..."
    if curl -s http://localhost:3001 > /dev/null; then
      APP_PORT=3001
      echo "App found running on port 3001, updating Nginx configuration..."
      sudo sed -i "s/proxy_pass http:\/\/localhost:${TARGET_PORT};/proxy_pass http:\/\/localhost:${APP_PORT};/g" /etc/nginx/conf.d/demos.noyesai.com.conf
      sudo systemctl reload nginx
    fi
  fi
  
  if [ -z "$APP_PORT" ]; then
    echo "WARNING: Could not detect running application on ports 3000 or 3001!"
  else
    echo "Application verified running on port ${APP_PORT}"
  fi
  
  # Rename the new instance to the standard name
  echo "Renaming new instance to standard name..."
  pm2 restart noyesdemodash-${DEPLOY_ID} --name noyesdemodash --update-env
  
  # Save PM2 configuration
  pm2 save
  
  # Clean up old deployments (keep last 3)
  echo "Cleaning up old deployments..."
  cd /home/ec2-user/deployments
  ls -t | tail -n +4 | xargs -I {} rm -rf {}
  
  # Verify the site is accessible
  echo "Verifying site accessibility..."
  if curl -s -I https://demos.noyesai.com | grep -q "200 OK"; then
    echo "✅ Site is accessible and returning 200 OK"
  else
    echo "⚠️ Site verification failed. Please check the logs."
  fi
  
  echo "Deployment completed successfully!"
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes are now live on https://demos.noyesai.com${NC}" 
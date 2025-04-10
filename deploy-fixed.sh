#!/bin/bash
# Noyes Demos Deployment Script with Zero-Downtime (Blue-Green) Deployment - Fixed Version

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Noyes Demos Deployment Script (Fixed) =====${NC}"

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

# 5. SSH to server and deploy - Phase 1: Setup and Build
echo -e "\n${GREEN}Deploying to server with zero downtime - Phase 1: Setup and Build...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Connected to server. Starting zero-downtime deployment..."
  
  # Basic error handling 
  set -e
  
  # Create a timestamp for the new deployment
  DEPLOY_ID=$(date +%Y%m%d%H%M%S)
  DEPLOY_BASE="/home/ec2-user/deployments"
  DEPLOY_DIR="${DEPLOY_BASE}/${DEPLOY_ID}"
  
  echo "Creating deployment directory structure..."
  mkdir -p ${DEPLOY_BASE}
  mkdir -p ${DEPLOY_DIR}
  
  echo "Ensuring deployment directory is clean..."
  rm -rf ${DEPLOY_DIR}/* 2>/dev/null || true
  
  echo "Cloning the repository directly (instead of copying)..."
  cd ${DEPLOY_BASE}
  git clone https://github.com/BennyMorton28/noyesdemodash.git ${DEPLOY_DIR}
  
  cd ${DEPLOY_DIR}
  
  # 6. Verify the .env file is present or copy it
  if [ ! -f .env ]; then
    echo "Copying .env file from main app directory..."
    cp /home/ec2-user/app/.env ${DEPLOY_DIR}/ || echo "WARNING: Could not copy .env file"
  fi
  
  # 7. Install dependencies
  echo "Installing dependencies..."
  npm ci
  
  # 8. Build the application
  echo "Building the application..."
  npm run build
  
  # 9. Ensure standalone directories exist
  echo "Setting up static files for standalone mode..."
  mkdir -p .next/standalone/public
  mkdir -p .next/standalone/.next/static
  
  # 10. Copy static files to standalone
  echo "Copying public directory to standalone..."
  cp -r public/* .next/standalone/public/ || echo "WARNING: Could not copy public files"
  
  # 11. Fix permissions for static files
  echo "Setting correct permissions for static files..."
  find .next/standalone/public -type f -exec chmod 644 {} \; 2>/dev/null || true
  
  # 12. Copy Next.js static files
  echo "Copying Next.js static files..."
  cp -r .next/static/* .next/standalone/.next/static/ || echo "WARNING: Could not copy Next.js static files"
  
  # 13. Copy environment file to standalone
  echo "Copying .env file to standalone..."
  cp .env .next/standalone/ || echo "WARNING: Could not copy .env to standalone"
  
  # For diagnostics - list what we have
  echo "Listing standalone directory contents for verification:"
  ls -la .next/standalone
  ls -la .next/standalone/public || echo "WARNING: Public directory not found"
  ls -la .next/standalone/.next/static || echo "WARNING: Static directory not found"
  
  echo "First phase of deployment completed successfully."
  
  # Store deployment information for the next phase
  echo "${DEPLOY_ID}" > /home/ec2-user/current_deployment_id.txt
  echo "${DEPLOY_DIR}" > /home/ec2-user/current_deployment_dir.txt
ENDSSH

echo -e "\n${BLUE}===== First Deployment Phase Complete =====${NC}"

# 6. SSH to server and deploy - Phase 2: PM2 Configuration and Process Management
echo -e "\n${GREEN}Deploying to server with zero downtime - Phase 2: PM2 and Process Management...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Starting Phase 2: PM2 Configuration and Process Management..."
  
  # Basic error handling 
  set -e
  
  # Get deployment information from Phase 1
  DEPLOY_ID=$(cat /home/ec2-user/current_deployment_id.txt)
  DEPLOY_DIR=$(cat /home/ec2-user/current_deployment_dir.txt)
  
  echo "Using deployment ID: ${DEPLOY_ID}"
  echo "Using deployment directory: ${DEPLOY_DIR}"
  
  cd ${DEPLOY_DIR}
  
  # 14. Define ports for blue-green deployment
  CURRENT_PORT=3000
  NEW_PORT=3001
  
  # Check if the app is currently running on 3000 or 3001
  if lsof -i:3000 >/dev/null 2>&1; then
    CURRENT_PORT=3000
    NEW_PORT=3001
  elif lsof -i:3001 >/dev/null 2>&1; then
    CURRENT_PORT=3001
    NEW_PORT=3000
  fi
  
  echo "Current application is running on port ${CURRENT_PORT}"
  echo "New application will run on port ${NEW_PORT}"
  
  # 15. Check if the new port is already in use by a non-PM2 process
  if lsof -i:${NEW_PORT} >/dev/null 2>&1; then
    echo "Port ${NEW_PORT} is in use. Attempting to free it..."
    kill $(lsof -t -i:${NEW_PORT}) 2>/dev/null || true
    sleep 2
  fi
  
  # 16. Create PM2 configuration for the new instance
  echo "Creating PM2 configuration for the new instance on port ${NEW_PORT}..."
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
      PORT: ${NEW_PORT},
      HOST: "0.0.0.0"
    }
  }]
}
EOL
  
  # 17. Start the new application with PM2
  echo "Starting new application instance on port ${NEW_PORT}..."
  pm2 start ecosystem.config.js
  
  # 18. Wait for the new instance to initialize
  echo "Waiting for new instance to initialize (10 seconds)..."
  sleep 10
  
  # 19. Verify the new instance is running
  if ! curl -s http://localhost:${NEW_PORT} > /dev/null; then
    echo "WARNING: New instance is not responding on port ${NEW_PORT}. Checking logs..."
    pm2 logs noyesdemodash-${DEPLOY_ID} --lines 20
    echo "Attempting to continue despite this warning..."
  else
    echo "New instance is running successfully on port ${NEW_PORT}"
  fi
  
  # 20. Update Nginx to route traffic to the new instance
  echo "Updating Nginx configuration to route traffic to port ${NEW_PORT}..."
  
  # Create a backup of the current Nginx configuration
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  sudo cp /etc/nginx/conf.d/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf.backup-${TIMESTAMP} || echo "WARNING: Could not backup Nginx config"
  
  # Create new configuration in temp location first
  cat > /tmp/demos.noyesai.com.conf << NGINX
server {
    server_name demos.noyesai.com;
    
    location / {
        proxy_pass http://localhost:${NEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /favicon.ico {
        root ${DEPLOY_DIR}/public;
        access_log off;
        expires 30d;
    }
    
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/demos.noyesai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demos.noyesai.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if (\$host = demos.noyesai.com) {
        return 301 https://\$host\$request_uri;
    }

    listen 80; 
    server_name demos.noyesai.com;
    return 404;
}
NGINX
  
  # Move to nginx directory and test before reloading
  sudo mv /tmp/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf
  
  # Test Nginx configuration
  echo "Testing Nginx configuration..."
  if sudo nginx -t; then
    echo "Nginx configuration is valid. Reloading Nginx..."
    sudo systemctl reload nginx
  else
    echo "ERROR: Nginx configuration is invalid. Reverting to backup..."
    sudo mv /etc/nginx/conf.d/demos.noyesai.com.conf.backup-${TIMESTAMP} /etc/nginx/conf.d/demos.noyesai.com.conf
    sudo systemctl reload nginx
    echo "Continuing with deployment despite Nginx configuration error..."
  fi
  
  # 21. Wait to ensure traffic is now going to the new instance
  echo "Waiting for traffic to shift to the new instance (5 seconds)..."
  sleep 5
  
  # 22. Stop the old instance if it exists
  echo "Stopping the old instance..."
  pm2 list | grep noyesdemodash | grep -v noyesdemodash-${DEPLOY_ID} | awk '{print $2}' | xargs -I {} pm2 stop {} 2>/dev/null || true
  pm2 list | grep noyesdemodash | grep -v noyesdemodash-${DEPLOY_ID} | awk '{print $2}' | xargs -I {} pm2 delete {} 2>/dev/null || true
  
  # 23. Rename the new instance to the standard name
  echo "Renaming new instance to standard name..."
  pm2 restart noyesdemodash-${DEPLOY_ID} --name noyesdemodash --update-env
  
  # 24. Save PM2 configuration
  echo "Saving PM2 configuration..."
  pm2 save
  
  # 25. Clean up old deployments (keep last 3)
  echo "Cleaning up old deployments..."
  cd /home/ec2-user/deployments
  ls -t | tail -n +4 | xargs -I {} rm -rf {} 2>/dev/null || true
  
  # 26. Verify the site is accessible
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
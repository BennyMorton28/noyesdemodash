#!/bin/bash
# Noyes Demos Robust Deployment Script with Better Cleanup

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Noyes Demos Robust Deployment Script =====${NC}"

# 1. Get commit message from user
if [ -z "$1" ]; then
  echo -e "${YELLOW}Enter commit message:${NC}"
  read commit_message
else
  commit_message="$1"
fi

# 2. Make the backup script executable and run it to backup server demos
if [ -f "./scripts/backup-server-demos.sh" ]; then
  chmod +x ./scripts/backup-server-demos.sh
  echo -e "\n${GREEN}Backing up server demos...${NC}"
  ./scripts/backup-server-demos.sh
  
  # After backup, we might have changes to commit
  echo -e "\n${GREEN}Checking for backup-related changes...${NC}"
  git status
fi

# 3. Add all changes
echo -e "\n${GREEN}Adding all changes to git...${NC}"
git add .

# 4. Commit changes
echo -e "\n${GREEN}Committing changes with message: '${commit_message}'${NC}"
git commit -m "$commit_message"

# 5. Push to GitHub
echo -e "\n${GREEN}Pushing to GitHub...${NC}"
git push

# 6. SSH to server and deploy (single phase with robust cleanup)
echo -e "\n${GREEN}Deploying to server...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Connected to server. Starting deployment..."
  
  # Basic error handling
  set -e
  
  # STEP 1: CLEANUP FIRST BEFORE DEPLOYMENT
  echo "Performing storage cleanup before deployment..."
  
  # Clean old PM2 logs
  echo "Cleaning PM2 logs..."
  pm2 flush
  
  # Clean old deployments except latest one
  echo "Cleaning old deployments..."
  if [ -d "/home/ec2-user/deployments" ]; then
    cd /home/ec2-user/deployments
    # Keep only the latest deployment
    ls -t | tail -n +2 | xargs -I {} sudo rm -rf {} 2>/dev/null || true
  fi
  
  # Clean temporary files
  echo "Cleaning npm cache and temporary files..."
  npm cache clean --force
  sudo rm -rf /tmp/npm-* 2>/dev/null || true
  sudo rm -rf /tmp/node-* 2>/dev/null || true
  
  # Check disk space
  echo "Current disk space usage:"
  df -h /
  
  # STEP 2: PREPARE DEPLOYMENT DIRECTORY
  # Create a clean deployment directory
  APP_DIR="/home/ec2-user/app"
  
  # Ensure it exists
  mkdir -p ${APP_DIR}
  
  # Navigate to app directory
  cd ${APP_DIR}
  
  # Back up the .env file
  if [ -f .env ]; then
    cp .env /home/ec2-user/.env.backup
    echo "Backed up .env file"
  fi
  
  # Stop current application
  echo "Stopping current application..."
  pm2 stop noyesdemodash 2>/dev/null || true
  pm2 delete noyesdemodash 2>/dev/null || true
  
  # Clean app directory
  echo "Cleaning app directory..."
  # Save the .env file and other critical files
  mkdir -p /tmp/app-backup
  if [ -f .env ]; then
    cp .env /tmp/app-backup/
  fi
  
  # IMPORTANT: Backup user-created demos before cleaning
  echo "Backing up user-created demos from standalone directory..."
  if [ -d ".next/standalone/public/demos" ]; then
    mkdir -p /tmp/app-backup/demos
    cp -r .next/standalone/public/demos/* /tmp/app-backup/demos/ 2>/dev/null || true
    echo "Backed up demo files from standalone directory"
  fi
  
  # Backup markdown files
  if [ -d ".next/standalone/public/markdown" ]; then
    mkdir -p /tmp/app-backup/markdown
    cp -r .next/standalone/public/markdown/* /tmp/app-backup/markdown/ 2>/dev/null || true
    echo "Backed up markdown files from standalone directory"
  fi
  
  # Now clean the directory
  find . -maxdepth 1 -not -name '.env' -not -name '.' -not -name '..' -exec rm -rf {} \; 2>/dev/null || true
  
  # STEP 3: GET LATEST CODE
  echo "Pulling latest code from GitHub..."
  # Clone fresh instead of pull to avoid merge conflicts
  cd /home/ec2-user
  rm -rf /home/ec2-user/temp-repo 2>/dev/null || true
  git clone https://github.com/BennyMorton28/noyesdemodash.git temp-repo
  
  # Copy all files to app directory
  cp -r temp-repo/* ${APP_DIR}/
  cp -r temp-repo/.* ${APP_DIR}/ 2>/dev/null || true
  
  # Restore .env
  if [ -f /tmp/app-backup/.env ]; then
    cp /tmp/app-backup/.env ${APP_DIR}/
    echo "Restored .env file"
  elif [ -f /home/ec2-user/.env.backup ]; then
    cp /home/ec2-user/.env.backup ${APP_DIR}/.env
    echo "Restored .env from backup"
  else
    echo "WARNING: No .env file found. Application may not function correctly."
  fi
  
  # Clean up temp repo
  rm -rf /home/ec2-user/temp-repo
  
  # STEP 4: BUILD APPLICATION
  cd ${APP_DIR}
  
  # Install dependencies
  echo "Installing dependencies..."
  npm ci
  
  # Build the application
  echo "Building the application..."
  npm run build
  
  # Make sure standalone directory is properly set up
  echo "Setting up standalone directory..."
  mkdir -p .next/standalone/public
  mkdir -p .next/standalone/.next/static
  
  # Copy static files
  echo "Copying static files to standalone directory..."
  cp -r public/* .next/standalone/public/ 2>/dev/null || true
  cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
  
  # Create necessary demo directories if they don't exist in public folder
  echo "Ensuring demo directories exist..."
  mkdir -p .next/standalone/public/demos
  mkdir -p .next/standalone/public/markdown
  mkdir -p .next/standalone/public/icons
  
  # IMPORTANT: Restore backed up user-created demos
  echo "Restoring user-created demos to standalone directory..."
  if [ -d "/tmp/app-backup/demos" ]; then
    cp -r /tmp/app-backup/demos/* .next/standalone/public/demos/ 2>/dev/null || true
    echo "Restored demo files to standalone directory"
  fi
  
  # Restore markdown files
  if [ -d "/tmp/app-backup/markdown" ]; then
    cp -r /tmp/app-backup/markdown/* .next/standalone/public/markdown/ 2>/dev/null || true
    echo "Restored markdown files to standalone directory"
  fi
  
  # Ensure full write permissions on demo directories
  echo "Setting proper permissions on public directories..."
  chmod -R 777 .next/standalone/public/demos
  chmod -R 777 .next/standalone/public/markdown
  chmod -R 777 .next/standalone/public/icons
  
  # Copy .env file to standalone directory
  cp .env .next/standalone/ 2>/dev/null || true
  
  # Modify server.js to bind to all interfaces (0.0.0.0)
  echo "Modifying server.js to bind to all interfaces..."
  SERVER_JS="${APP_DIR}/.next/standalone/server.js"
  if [ -f "${SERVER_JS}" ]; then
    # Create a backup
    cp "${SERVER_JS}" "${SERVER_JS}.backup"
    
    # Add binding to 0.0.0.0
    sed -i 's/server.listen(port)/server.listen(port, "0.0.0.0")/' "${SERVER_JS}" || echo "WARNING: Failed to modify server.js"
    
    # Check if the modification was successful
    if grep -q "server.listen(port, \"0.0.0.0\")" "${SERVER_JS}"; then
      echo "Successfully modified server.js to bind to all interfaces"
    else
      echo "WARNING: Failed to modify server.js, using original file"
      cp "${SERVER_JS}.backup" "${SERVER_JS}" 
    fi
  else
    echo "WARNING: server.js not found at ${SERVER_JS}"
  fi
  
  # Fix permissions for all files
  echo "Setting correct permissions..."
  find .next/standalone -type f -exec chmod 644 {} \; 2>/dev/null || true
  find .next/standalone -type d -exec chmod 755 {} \; 2>/dev/null || true
  chmod +x .next/standalone/server.js 2>/dev/null || true
  
  # STEP 5: CONFIGURE PM2
  echo "Creating PM2 configuration..."
  # Use a single consistent port (3000)
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "${APP_DIR}/.next/standalone",
    script: "./server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HOST: "0.0.0.0",
      HOSTNAME: "0.0.0.0",
      NEXT_PUBLIC_HOST: "0.0.0.0"
    }
  }]
}
EOL
  
  # STEP 6: UPDATE NGINX
  echo "Updating Nginx configuration..."
  
  # Create a backup of existing config
  sudo cp /etc/nginx/conf.d/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf.backup 2>/dev/null || true
  
  # Create new configuration that proxies to port 3000
  cat > /tmp/demos.noyesai.com.conf << NGINX
server {
    server_name demos.noyesai.com;
    
    # Increase maximum upload size to 50MB
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Handle static files directly from public directory
    location ~ ^/(favicon.ico|robots.txt) {
        root ${APP_DIR}/public;
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
  
  # Apply the new Nginx configuration
  sudo mv /tmp/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf
  
  # Test Nginx configuration
  echo "Testing Nginx configuration..."
  if sudo nginx -t; then
    echo "Nginx configuration is valid. Reloading Nginx..."
    sudo systemctl reload nginx
  else
    echo "ERROR: Nginx configuration is invalid. Reverting to backup..."
    sudo cp /etc/nginx/conf.d/demos.noyesai.com.conf.backup /etc/nginx/conf.d/demos.noyesai.com.conf 2>/dev/null || true
    sudo systemctl reload nginx
  fi
  
  # STEP 7: START APPLICATION
  echo "Starting application with PM2..."
  pm2 start ecosystem.config.js
  pm2 save
  
  # Wait a moment for the app to start
  echo "Waiting for application to start (5 seconds)..."
  sleep 5
  
  # STEP 8: VERIFY DEPLOYMENT
  echo "Verifying application is running..."
  echo "Testing multiple interfaces for application access..."
  
  # Try different ways to access the application
  CURL_OPTS="-s --connect-timeout 5"
  if curl $CURL_OPTS http://localhost:3000 > /dev/null; then
    echo "✅ Application is responding on localhost:3000"
  else
    echo "⚠️ Application is not responding on localhost:3000"
  fi
  
  if curl $CURL_OPTS http://127.0.0.1:3000 > /dev/null; then
    echo "✅ Application is responding on 127.0.0.1:3000"
  else
    echo "⚠️ Application is not responding on 127.0.0.1:3000"
  fi
  
  # Try server's internal hostname
  HOSTNAME=$(hostname)
  if curl $CURL_OPTS http://${HOSTNAME}:3000 > /dev/null; then
    echo "✅ Application is responding on ${HOSTNAME}:3000"
  else
    echo "⚠️ Application is not responding on ${HOSTNAME}:3000"
  fi
  
  # Check if the application is listening on port 3000
  echo "Checking if port 3000 is open and listening:"
  netstat -tulpn | grep 3000 || echo "Port 3000 not found in netstat output"
  
  # Try with ss command as well
  echo "Checking with ss command:"
  ss -tulpn | grep 3000 || echo "Port 3000 not found in ss output"
  
  # Check running processes
  echo "Checking running node processes:"
  ps aux | grep node | grep -v grep || true
  
  # Display PM2 process information
  echo "PM2 process status:"
  pm2 list
  
  # Check if server.js was modified correctly
  echo "Checking server.js modification:"
  grep -A 2 "server.listen" ${APP_DIR}/.next/standalone/server.js || echo "Could not find server.listen in server.js"
  
  # Check application logs if not responding
  echo "Displaying application logs:"
  pm2 logs noyesdemodash --lines 20 --nostream
  
  # Check if Nginx is correctly proxying
  echo "Verifying Nginx proxy..."
  if curl -s -I https://demos.noyesai.com | grep -q "200 OK"; then
    echo "✅ Site is accessible through Nginx and returning 200 OK"
  else
    echo "⚠️ Site verification through Nginx failed. Checking Nginx logs..."
    sudo tail -n 20 /var/log/nginx/error.log
  fi
  
  # STEP 9: FINAL CLEANUP
  echo "Performing final cleanup..."
  # Remove temp files
  rm -rf /tmp/app-backup 2>/dev/null || true
  
  # Check disk space after deployment
  echo "Disk space usage after deployment:"
  df -h /
  
  echo "Deployment completed!"
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes should now be live on https://demos.noyesai.com${NC}" 
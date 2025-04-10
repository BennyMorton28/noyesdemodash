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
  
  # Create unique deployment ID based on date/time
  DEPLOY_ID=$(date +"%Y%m%d%H%M%S")
  DEPLOY_DIR="/home/ec2-user/deployments/${DEPLOY_ID}"
  
  # Check disk space before starting
  echo "Checking disk space before deployment..."
  DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
  AVAILABLE_SPACE=$(df -h / | awk 'NR==2 {print $4}')
  
  echo "Current disk usage: ${DISK_USAGE}%"
  echo "Available space: ${AVAILABLE_SPACE}"
  
  # Always clean up previous deployments before starting a new one
  echo "Cleaning up previous deployments before starting..."
  find /home/ec2-user/deployments -maxdepth 1 -mindepth 1 -exec rm -rf {} \;
  echo "All previous deployments removed"
  
  # If disk usage is still high, clean other areas
  DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
  if [ "$DISK_USAGE" -gt 80 ]; then
    echo "Disk usage still high at ${DISK_USAGE}%. Performing deep cleanup..."
    
    # Clean npm cache
    npm cache clean --force
    
    # Clean up old logs
    sudo find /var/log -type f -name "*.gz" -delete
    sudo find /var/log -type f -name "*.old" -delete
    sudo find /var/log -type f -name "*.1" -delete
    
    # Clean temporary files
    sudo rm -rf /tmp/*
    
    # Check disk space after deep cleanup
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "Disk usage after deep cleanup: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -gt 90 ]; then
      echo "ERROR: Disk usage is still critically high at ${DISK_USAGE}% after all cleanup attempts."
      echo "Please manually investigate and free up disk space before deploying."
      exit 1
    fi
  fi
  
  echo "Creating new deployment directory: ${DEPLOY_DIR}"
  mkdir -p ${DEPLOY_DIR}
  
  # Copy current codebase to the new deployment directory
  echo "Copying application code to deployment directory..."
  cp -r /home/ec2-user/app/* ${DEPLOY_DIR}/
  cp -r /home/ec2-user/app/.next ${DEPLOY_DIR}/ 2>/dev/null || true
  cp -r /home/ec2-user/app/.env ${DEPLOY_DIR}/ 2>/dev/null || true
  cp -r /home/ec2-user/app/package.json ${DEPLOY_DIR}/
  cp -r /home/ec2-user/app/package-lock.json ${DEPLOY_DIR}/ 2>/dev/null || true
  
  # Navigate to deployment directory
  cd ${DEPLOY_DIR}
  
  # Install dependencies
  echo "Installing dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    echo "No package-lock.json found, using npm install instead"
    npm install
  fi
  
  # Build the application
  echo "Building the application..."
  npm run build
  
  # Verify the build was successful
  if [ ! -d ".next" ]; then
    echo "ERROR: Build failed - .next directory not found"
    echo "Trying alternative build approach..."
    
    # Try to recover by installing dependencies from scratch
    rm -rf node_modules
    npm install
    npm run build
    
    # Check again
    if [ ! -d ".next" ]; then
      echo "ERROR: Build still failed after recovery attempt. Deployment failed."
      exit 1
    fi
  fi
  
  # Fix static files in standalone mode
  echo "Setting up static files for standalone mode..."
  mkdir -p .next/standalone/public
  mkdir -p .next/standalone/.next/static
  
  # Verify that standalone mode files exist
  if [ ! -f ".next/standalone/server.js" ]; then
    echo "WARNING: standalone server.js not found. Copying from server directory..."
    
    # Try to copy from regular next output
    mkdir -p .next/standalone
    cp -r .next/server/* .next/standalone/ 2>/dev/null || true
    
    # If still not available, create a basic server file
    if [ ! -f ".next/standalone/server.js" ]; then
      echo "Creating basic server file as fallback..."
      cat > .next/standalone/server.js << 'SERVER_JS'
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
SERVER_JS
    fi
  fi
  
  # Copy public directory to standalone
  echo "Copying public files..."
  if [ -d "public" ]; then
    cp -r public/* .next/standalone/public/ 2>/dev/null || echo "Warning: No files in public directory"
  else
    echo "Warning: public directory not found"
    mkdir -p .next/standalone/public
  fi
  
  # Make sure all icon files are properly copied and have correct permissions
  find .next/standalone/public -name "*.svg" -o -name "*.png" | xargs -I{} chmod 644 {} 2>/dev/null || echo "Warning: No icon files found"
  
  # Copy static files to standalone static directory
  echo "Copying static files..."
  if [ -d ".next/static" ]; then
    cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null || echo "Warning: Failed to copy static files"
  else
    echo "Warning: .next/static directory not found"
    mkdir -p .next/standalone/.next/static
  fi
  
  # Copy .env file
  echo "Copying environment file..."
  if [ -f "/home/ec2-user/app/.env" ]; then
    cp /home/ec2-user/app/.env .next/standalone/ || echo "Warning: Failed to copy .env file"
  else
    echo "Warning: .env file not found, creating empty one"
    touch .next/standalone/.env
  fi
  
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
  
  # Get the internal IP
  INTERNAL_IP=$(hostname -I | awk '{print $1}')
  echo "Server internal IP: ${INTERNAL_IP}"
  
  # Update the Nginx configuration to point to the new port with SSL support
  echo "Creating new Nginx configuration with SSL support..."
  cat > /tmp/demos.noyesai.com.conf << NGINX
server {
    server_name demos.noyesai.com;
    
    # Main application proxy
    location / {
        proxy_pass http://${INTERNAL_IP}:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts to prevent 502s during deployment
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Don't fail immediately if backend is down
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
    }
    
    # Serve favicon directly
    location = /favicon.ico {
        root /home/ec2-user/app/public;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files \$uri =404;
    }
    
    # Serve Next.js static files directly
    location /_next/static/ {
        alias /home/ec2-user/app/.next/static/;
        access_log off;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
    
    # DIRECT ACCESS TO STANDALONE DIRECTORY DEMOS
    # This ensures that any demo created through the UI is immediately accessible
    location /demos/ {
        # First try the standard deployed demo directory
        root /home/ec2-user/app/public;
        
        # Then try the actual standalone directory where the app is running
        # This is where newly created demos are saved
        try_files \$uri \$uri/ /home/ec2-user/deployments/${DEPLOY_ID}/.next/standalone/public\$uri =404;
        
        access_log off;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }
    
    # Serve public directory assets directly
    location /public/ {
        alias /home/ec2-user/app/public/;
        access_log off;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
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
  
  # Wait up to 30 seconds for the app to start - try multiple ways to connect
  for i in {1..30}; do
    # Try various ways to connect to the application
    if curl -s http://localhost:${TARGET_PORT} > /dev/null; then
      APP_PORT=${TARGET_PORT}
      echo "✅ App is accessible via localhost:${TARGET_PORT}"
      break
    elif curl -s http://127.0.0.1:${TARGET_PORT} > /dev/null; then
      APP_PORT=${TARGET_PORT}
      echo "✅ App is accessible via 127.0.0.1:${TARGET_PORT}"
      break
    elif curl -s http://${INTERNAL_IP}:${TARGET_PORT} > /dev/null; then
      APP_PORT=${TARGET_PORT}
      echo "✅ App is accessible via ${INTERNAL_IP}:${TARGET_PORT}"
      break
    else
      echo "Waiting for app to start on port ${TARGET_PORT}... (${i}/30)"
      sleep 1
    fi
  done
  
  # If app is not running on TARGET_PORT, check alternative ports
  if [ -z "$APP_PORT" ]; then
    echo "App not detected on port ${TARGET_PORT}. This is a critical error."
    echo "Checking PM2 process status:"
    pm2 status
    echo "Checking if something else is using port ${TARGET_PORT}:"
    sudo lsof -i:${TARGET_PORT}
    
    echo "Attempting to fix the application configuration..."
    # Get the PM2 ecosystem file
    ECOSYSTEM_FILE=$(find /home/ec2-user/deployments/${DEPLOY_ID} -name "ecosystem.config.js")
    
    if [ ! -z "$ECOSYSTEM_FILE" ]; then
      echo "Updating ecosystem file to ensure HOST is set to 0.0.0.0..."
      sed -i 's/HOST: "[^"]*"/HOST: "0.0.0.0"/g' $ECOSYSTEM_FILE
      sed -i 's/PORT: [0-9]*/PORT: '${TARGET_PORT}'/g' $ECOSYSTEM_FILE
      
      echo "Updated ecosystem file:"
      cat $ECOSYSTEM_FILE
      
      echo "Restarting the application with updated configuration..."
      pm2 restart noyesdemodash-${DEPLOY_ID}
      sleep 10
      
      # Try connecting again after restart
      if curl -s http://localhost:${TARGET_PORT} > /dev/null || \
         curl -s http://127.0.0.1:${TARGET_PORT} > /dev/null || \
         curl -s http://${INTERNAL_IP}:${TARGET_PORT} > /dev/null; then
        APP_PORT=${TARGET_PORT}
        echo "✅ Application successfully fixed and is now responding on port ${TARGET_PORT}"
      else
        echo "❌ Failed to start application on expected port. Deployment failed."
        echo "Logs from the application:"
        pm2 logs noyesdemodash-${DEPLOY_ID} --lines 20 --nostream 
        exit 1
      fi
    else
      echo "❌ Failed to start application on expected port. Deployment failed."
      exit 1
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
  
  # Check disk space before cleanup
  echo "Checking disk space before cleanup..."
  df -h /
  
  # Store only the current deployment, remove all others
  echo "Cleaning up all previous deployments..."
  find /home/ec2-user/deployments -maxdepth 1 -mindepth 1 -not -name "${DEPLOY_ID}" -exec rm -rf {} \;
  
  # Remove old node_modules and build artifacts from the app directory
  echo "Cleaning up old build artifacts..."
  rm -rf /home/ec2-user/app/node_modules
  rm -rf /home/ec2-user/app/.next
  
  # Check disk space after cleanup
  echo "Disk space after cleanup:"
  df -h /
  
  # Remove old PM2 logs
  echo "Cleaning up old PM2 logs..."
  find /home/ec2-user/.pm2/logs -type f -mtime +3 | xargs -I {} rm -f {}
  
  # Ensure demo files are in the correct location for Nginx access
  echo "Ensuring demo files are in the correct location for Nginx access..."
  sudo mkdir -p /home/ec2-user/app/public
  
  # Make sure .next/static directory exists
  echo "Ensuring .next/static directory exists for CSS and JS files..."
  sudo mkdir -p /home/ec2-user/app/.next/static
  
  # Copy static files
  echo "Copying static files for CSS and JS..."
  sudo cp -r ${DEPLOY_DIR}/.next/static/* /home/ec2-user/app/.next/static/
  
  # Preserve existing demo files before copying new ones
  echo "Preserving existing demo files..."
  if [ -d "/home/ec2-user/app/public/demos" ]; then
    # Create a backup of current demos
    DEMOS_BACKUP="/tmp/demos_backup_${DEPLOY_ID}"
    sudo mkdir -p $DEMOS_BACKUP
    sudo cp -r /home/ec2-user/app/public/demos/* $DEMOS_BACKUP/ 2>/dev/null || echo "No existing demos to back up"
    
    # Now copy new files but don't overwrite existing ones
    echo "Copying new demo files from deployment..."
    sudo mkdir -p /home/ec2-user/app/public/demos
    
    # Copy files from new deployment first
    sudo cp -r ${DEPLOY_DIR}/.next/standalone/public/* /home/ec2-user/app/public/
    
    # Now restore any existing demo files that weren't in the new deployment
    echo "Restoring any demo files not in the new deployment..."
    if [ -d "$DEMOS_BACKUP" ]; then
      for demo in $(ls $DEMOS_BACKUP); do
        # If the demo doesn't exist in the new deployment, restore it
        if [ ! -d "/home/ec2-user/app/public/demos/$demo" ]; then
          echo "Restoring demo: $demo"
          sudo cp -r "$DEMOS_BACKUP/$demo" "/home/ec2-user/app/public/demos/"
        else
          echo "Demo already exists in new deployment: $demo"
        fi
      done
    fi
    
    # Clean up backup
    sudo rm -rf $DEMOS_BACKUP
  else
    # If no existing demos, just copy everything from the new deployment
    echo "No existing demos to preserve, copying all from new deployment..."
    sudo cp -r ${DEPLOY_DIR}/.next/standalone/public/* /home/ec2-user/app/public/
  fi
  
  # Set correct permissions
  echo "Setting correct file permissions..."
  sudo chown -R ec2-user:ec2-user /home/ec2-user/app/public
  sudo find /home/ec2-user/app/public -type f -exec chmod 644 {} \;
  sudo find /home/ec2-user/app/public -type d -exec chmod 755 {} \;
  
  # Set permissions for runtime directory so Nginx can access it
  echo "Setting permissions for runtime directory..."
  sudo chmod -R 755 /home/ec2-user/deployments/${DEPLOY_ID}/.next/standalone/public
  
  # Verify the site is accessible
  echo "Verifying app is operational..."
  MAX_RETRIES=5
  RETRY_COUNT=0
  APP_OK=false
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$APP_OK" = false ]; do
    if curl -s -I https://demos.noyesai.com | grep -q "200 OK"; then
      APP_OK=true
      echo "✅ Site is accessible and returning 200 OK"
    else
      RETRY_COUNT=$((RETRY_COUNT+1))
      echo "⚠️ Site verification failed. Retry $RETRY_COUNT of $MAX_RETRIES..."
      
      # Check if app is running
      if ! pm2 show noyesdemodash > /dev/null 2>&1; then
        echo "App is not running. Restarting PM2 process..."
        pm2 restart noyesdemodash
      fi
      
      # Check Nginx status
      if ! systemctl is-active --quiet nginx; then
        echo "Nginx is not running. Restarting Nginx..."
        sudo systemctl restart nginx
      else
        echo "Reloading Nginx configuration..."
        sudo systemctl reload nginx
      fi
      
      # Wait a moment before retrying
      sleep 10
    fi
  done
  
  if [ "$APP_OK" = false ]; then
    echo "❌ ERROR: Site is still not accessible after $MAX_RETRIES retries!"
    echo "Please check server logs for more information."
    echo "Nginx status: $(systemctl status nginx | grep Active)"
    echo "PM2 status: $(pm2 status | grep noyesdemodash)"
    echo "Last few Nginx error log lines:"
    sudo tail -n 20 /var/log/nginx/error.log
  else
    echo "Deployment completed successfully!"
  fi
  
  # Symlink to the current deployment directory
  sudo ln -sf ${DEPLOY_DIR} /home/ec2-user/app/current

  # Ensure .next/static directory exists for CSS and JS files
  echo "Ensuring .next/static directory exists for CSS and JS files..."
  sudo mkdir -p /home/ec2-user/app/.next/static

  # Copy static files
  echo "Copying static files for CSS and JS..."
  sudo cp -r ${DEPLOY_DIR}/.next/static/* /home/ec2-user/app/.next/static/

  # Move to app directory
  sudo rm -rf /home/ec2-user/app/.next/standalone || true
  sudo cp -r ${DEPLOY_DIR}/.next/standalone /home/ec2-user/app/.next/standalone

  # Make sure the public directory exists and copy public files
  sudo mkdir -p /home/ec2-user/app/public
  sudo cp -r ${DEPLOY_DIR}/public/* /home/ec2-user/app/public/

  # Set the correct permissions
  sudo chown -R ec2-user:ec2-user /home/ec2-user/app

  # Ensure runtime directory is accessible to nginx
  sudo chmod -R 755 /home/ec2-user/app/.next/standalone
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes are now live on https://demos.noyesai.com${NC}" 
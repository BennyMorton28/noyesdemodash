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
  
  # Copy static files to standalone static directory
  cp -r .next/static/* .next/standalone/.next/static/
  
  # Copy .env file
  cp /home/ec2-user/app/.env .next/standalone/
  
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
      PORT: 3001,
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
    }
  }]
}
EOL
  
  # Start the new application
  echo "Starting new application instance..."
  pm2 start ecosystem.config.js
  
  # Wait for the new instance to be fully initialized
  echo "Waiting for new instance to initialize (10 seconds)..."
  sleep 10
  
  # Get current active instance details before switching
  CURRENT_APP=$(pm2 list | grep "noyesdemodash " | grep "online" || echo "")
  
  # Update the Nginx configuration to point to the new port
  echo "Updating Nginx configuration..."
  cat > /tmp/noyesdemodash.conf << 'NGINX'
server {
    listen 80;
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
}
NGINX
  
  sudo mv /tmp/noyesdemodash.conf /etc/nginx/conf.d/noyesdemodash.conf
  sudo systemctl reload nginx
  
  # Stop and remove the old application instance
  if [ ! -z "$CURRENT_APP" ]; then
    echo "Stopping old application instance..."
    pm2 delete noyesdemodash || true
  fi
  
  # Rename the new instance to the standard name
  echo "Renaming new instance to standard name..."
  pm2 delete noyesdemodash || true
  pm2 restart noyesdemodash-${DEPLOY_ID} --name noyesdemodash --update-env
  
  # Save PM2 configuration
  pm2 save
  
  # Clean up old deployments (keep last 3)
  echo "Cleaning up old deployments..."
  cd /home/ec2-user/deployments
  ls -t | tail -n +4 | xargs -I {} rm -rf {}
  
  echo "Deployment completed successfully!"
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes are now live on https://demos.noyesai.com${NC}" 
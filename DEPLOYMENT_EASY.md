# Easy Deployment Guide for Noyes Demos

This document provides a simplified deployment process for the Noyes Demos platform.

## One-Step Deployment

We've created a simple deployment script that handles everything for you in one step:

```bash
./deploy.sh "Your commit message"
```

This script will:
1. Add all your changes to git
2. Commit them with your provided message
3. Push to GitHub
4. Connect to the server
5. Pull the latest changes
6. Install dependencies
7. Build the application
8. Update PM2 configuration with environment variables
9. Restart the service

## Manual Deployment Steps

If you need to perform these steps manually:

### 1. Push changes to GitHub
```bash
git add .
git commit -m "Your commit message"
git push
```

### 2. Deploy to Server
```bash
# Connect to the server
ssh noyesdemos

# Navigate to application directory
cd /home/ec2-user/app

# Pull latest changes (safer method to handle branch differences)
git fetch origin
git reset --hard origin/main

# Install dependencies
npm ci

# Build the application
npm run build

# Update PM2 configuration with environment variables
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "/home/ec2-user/app",
    script: "./.next/standalone/server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      OPENAI_API_KEY: "\${OPENAI_API_KEY}"
    }
  }]
}
EOL

# Restart the application
pm2 reload ecosystem.config.js
```

## Server SSH Configuration

The SSH configuration is set up in your `~/.ssh/config` file:

```
Host noyesdemos
    HostName demos.noyesai.com
    User ec2-user
    IdentityFile "/Users/benny/Downloads/Noyes/Noyes AI/Kellogg/bmsd-case-demo-key.pem"
    StrictHostKeyChecking no
```

This allows you to simply use `ssh noyesdemos` to connect to the server.

## Environment Variables

The application requires the following environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key

These should be set in a `.env` file in the application root directory. The deployment script will automatically include them in the PM2 configuration.

## Troubleshooting

If you encounter issues:

1. **SSH Connection Problems**: Ensure your key file has the correct permissions (600):
   ```bash
   chmod 600 "/Users/benny/Downloads/Noyes/Noyes AI/Kellogg/bmsd-case-demo-key.pem"
   ```

2. **Deployment Failures**: Connect to the server manually to debug:
   ```bash
   ssh noyesdemos
   ```

3. **Application Not Running**: Check PM2 status:
   ```bash
   pm2 status
   ```
   
   And logs:
   ```bash
   pm2 logs noyesdemodash
   ```

4. **Environment Variables Missing**: If the application shows an error related to missing API keys:
   ```bash
   ssh noyesdemos
   cd /home/ec2-user/app
   pm2 env 0 | grep OPENAI
   ``` 
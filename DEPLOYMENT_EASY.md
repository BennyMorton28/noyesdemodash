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
8. Restart the service

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

# Restart the application
pm2 restart noyesdemodash
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
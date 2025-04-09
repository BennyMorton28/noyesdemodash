# Deployment Guide for AI Demo Platform

This guide provides instructions for deploying the AI Demo Platform on a Linux server.

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git
- Linux server with at least 1GB RAM
- Proper firewall configuration to allow HTTP/HTTPS traffic

## Environment Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd demo-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
4. Edit the `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Building for Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Test the production build locally:
   ```bash
   npm run start
   ```

## Deployment Options

### Option 1: Manual Deployment

1. Transfer the built application to your server using SCP or SFTP:
   ```bash
   scp -r .next package.json public server.js node_modules user@your-server:/path/to/app
   ```

2. Set up a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "demo-platform" -- start
   pm2 save
   pm2 startup
   ```

### Option 2: Using Docker

1. Create a Dockerfile in the project root:
   ```
   FROM node:18-alpine AS base

   # Install dependencies only when needed
   FROM base AS deps
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci

   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   # Production image, copy all the files and run next
   FROM base AS runner
   WORKDIR /app

   ENV NODE_ENV production

   # Create a non-root user
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs

   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

   USER nextjs

   EXPOSE 3000

   ENV PORT 3000

   CMD ["node", "server.js"]
   ```

2. Build and run the Docker container:
   ```bash
   docker build -t demo-platform .
   docker run -p 3000:3000 -e OPENAI_API_KEY=your_key_here demo-platform
   ```

### Option 3: Using a PaaS (Platform as a Service)

The application is also compatible with services like:
- Vercel (optimized for Next.js)
- Netlify
- Railway
- Render

Follow the platform-specific deployment instructions and set up the necessary environment variables.

## File Directories and Permissions

Ensure these directories exist and have proper write permissions:

1. `public/demos` - For storing demo configurations
2. `public/markdown` - For storing markdown files

```bash
mkdir -p public/demos public/markdown
chmod 755 public/demos public/markdown
```

## Nginx Configuration (Optional)

If you're using Nginx as a reverse proxy:

```
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Setting Up HTTPS with Let's Encrypt

1. Install Certbot:
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. Obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. Set up auto-renewal:
   ```bash
   sudo systemctl status certbot.timer
   ```

## Monitoring and Maintenance

1. Set up application monitoring:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. Set up regular backups of the data directories:
   ```bash
   sudo apt install rsync
   # Add a cron job for regular backups
   echo "0 2 * * * rsync -a /path/to/app/public/demos /path/to/backup/" | sudo tee -a /etc/crontab
   ```

## Troubleshooting

- **File permissions issues**: Ensure the user running the Node.js process has write access to the `public/demos` and `public/markdown` directories.
- **API key errors**: Verify that the OPENAI_API_KEY environment variable is correctly set.
- **Port conflicts**: If port 3000 is already in use, modify the PORT environment variable.

## Security Considerations

1. Never commit `.env` files with real API keys to version control
2. Consider setting up API key rotation
3. Implement rate limiting if your application receives high traffic
4. Regularly update dependencies with `npm audit fix`

## Performance Optimization

1. Enable Gzip compression in your web server
2. Set up a CDN for static assets
3. Consider enabling browser caching for static files 
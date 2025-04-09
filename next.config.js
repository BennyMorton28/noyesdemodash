/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Create a standalone build that doesn't require the full Node.js runtime
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header for security
  compress: true, // Enable gzip compression
  // Handle environment variables for API keys in a production environment
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  images: {
    domains: [], // Add domains for external images if needed
    // On Linux servers, sharp is generally more efficient than the default image optimizer
    // If you encounter issues, you can disable it with { unoptimized: true }
  },
  // Increase the timeout for serverless functions if needed
  serverRuntimeConfig: {
    // Will only be available on the server side
    timeoutMs: 60000, // 60 seconds
  },
};

module.exports = nextConfig; 
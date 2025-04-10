import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const basePath = process.cwd();
    const publicPath = path.join(basePath, 'public');
    const demosPath = path.join(publicPath, 'demos');
    const markdownPath = path.join(publicPath, 'markdown');
    
    // Check if directories exist
    const publicExists = fs.existsSync(publicPath);
    const demosExists = fs.existsSync(demosPath);
    const markdownExists = fs.existsSync(markdownPath);
    
    // Get list of demos if directory exists
    let demosList: string[] = [];
    if (demosExists) {
      demosList = fs.readdirSync(demosPath);
    }
    
    // Get list of markdown files if directory exists
    let markdownFiles: string[] = [];
    if (markdownExists) {
      markdownFiles = fs.readdirSync(markdownPath);
    }
    
    // Get environment info
    const nodeEnv = process.env.NODE_ENV || 'unknown';
    const isStandalone = fs.existsSync(path.join(basePath, 'server.js'));
    
    // Get server.js location if it exists
    let serverJsPath: string | null = null;
    if (isStandalone) {
      serverJsPath = path.join(basePath, 'server.js');
    } else if (fs.existsSync(path.join(basePath, '.next', 'standalone', 'server.js'))) {
      serverJsPath = path.join(basePath, '.next', 'standalone', 'server.js');
    }
    
    return NextResponse.json({
      message: 'Debug information',
      paths: {
        basePath,
        publicPath,
        demosPath,
        markdownPath,
        serverJsPath
      },
      directoryExists: {
        publicExists,
        demosExists,
        markdownExists,
        isStandalone
      },
      contents: {
        demosList,
        markdownFiles,
        demoCount: demosList.length,
        markdownCount: markdownFiles.length
      },
      environment: {
        nodeEnv,
        platform: process.platform,
        architecture: process.arch
      }
    });
  } catch (error: any) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to gather debug information', details: error.message },
      { status: 500 }
    );
  }
} 
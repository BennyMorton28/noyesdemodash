import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// List of static demo IDs that should be excluded from API results
const staticDemoIds = ['math-assistant', 'writing-assistant', 'language-assistant', 'coding-assistant'];

/**
 * Helper function to get the correct file path in both development and production environments
 * Ensures files are always saved to the proper public directory regardless of environment
 */
function getBasePath(): string {
  const cwd = process.cwd();
  console.log(`Current working directory: ${cwd}`);
  
  // Check if we're in the standalone build
  const isStandalone = cwd.includes('.next/standalone');
  if (isStandalone) {
    // In the standalone build on the server, we need to save to the parent app directory
    console.log('Detected standalone build environment');
    // Directly return the app directory path regardless of where we are in the standalone structure
    return '/home/ec2-user/app';
  }
  
  // In development or normal production (not standalone), use current directory
  return cwd;
}

// Helper function to ensure directories exist
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
}

// Helper function to validate a path is writable
function validatePathWritable(filePath: string): boolean {
  try {
    const dirPath = path.dirname(filePath);
    ensureDirectoryExists(dirPath);
    
    // Try to write a test file
    const testPath = path.join(dirPath, '.write-test');
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath); // Clean up
    return true;
  } catch (error) {
    console.error(`Path ${filePath} is not writable:`, error);
    return false;
  }
}

export async function GET() {
  try {
    // Get all dynamic demos from the public/demos directory
    const demosDir = path.join(getBasePath(), 'public', 'demos');
    const dynamicDemos = [];

    if (fs.existsSync(demosDir)) {
      const demoFolders = fs.readdirSync(demosDir);
      
      for (const folder of demoFolders) {
        // Skip static demo folders
        if (staticDemoIds.includes(folder)) continue;
        
        const configPath = path.join(demosDir, folder, 'config.json');
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(configData);
          dynamicDemos.push(config);
        }
      }
    }

    return new NextResponse(JSON.stringify(dynamicDemos), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error listing demos:', error);
    return new NextResponse('Error listing demos', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const demoData = JSON.parse(formData.get('demo') as string);
    
    // Validate required fields
    if (!demoData.id || !demoData.title || !demoData.author || !demoData.assistants) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Get the correct base path for file operations
    const basePath = getBasePath();
    console.log(`Using base path: ${basePath} for demo creation`);

    // Create necessary directories
    const demoDir = path.join(basePath, 'public', 'demos', demoData.id);
    const markdownDir = path.join(basePath, 'public', 'markdown');
    
    // Use our helper function to create directories
    ensureDirectoryExists(demoDir);
    ensureDirectoryExists(markdownDir);
    
    // Validate that critical paths are writable
    const demoConfigPath = path.join(demoDir, 'config.json');
    if (!validatePathWritable(demoConfigPath)) {
      console.error(`Cannot write to demo config path: ${demoConfigPath}`);
      return new NextResponse('Server file access error', { status: 500 });
    }

    // Save demo icon if provided
    if (formData.has('icon')) {
      const iconFile = formData.get('icon') as File;
      const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
      const iconPath = path.join(demoDir, 'icon.svg');
      fs.writeFileSync(iconPath, iconBuffer);
      console.log(`Saved demo icon to: ${iconPath}`);
      demoData.icon = `demos/${demoData.id}/icon.svg`;
    }

    // Save demo explainer markdown
    const explainerFile = formData.get('explainer') as File;
    if (explainerFile) {
      const explainerBuffer = Buffer.from(await explainerFile.arrayBuffer());
      const explainerPath = path.join(demoDir, 'explainer.md');
      fs.writeFileSync(explainerPath, explainerBuffer);
      console.log(`Saved explainer markdown to: ${explainerPath}`);
    } else {
      return new NextResponse('Demo explainer markdown is required', { status: 400 });
    }

    // Save markdown files and icons for each assistant
    for (const assistant of demoData.assistants) {
      // Save assistant markdown file
      const markdownFile = formData.get(`markdown_${assistant.id}`) as File;
      if (markdownFile) {
        const markdownBuffer = Buffer.from(await markdownFile.arrayBuffer());
        
        // Save in public markdown directory with standardized naming
        const publicMarkdownPath = path.join(markdownDir, `${demoData.id}-${assistant.id}.md`);
        fs.writeFileSync(publicMarkdownPath, markdownBuffer);
        console.log(`Saved assistant markdown to: ${publicMarkdownPath}`);
      } else {
        return new NextResponse(`Markdown file is required for assistant "${assistant.name}"`, { status: 400 });
      }

      // Save assistant icon if provided
      const assistantIconFile = formData.get(`icon_${assistant.id}`) as File;
      if (assistantIconFile) {
        const iconBuffer = Buffer.from(await assistantIconFile.arrayBuffer());
        
        // Create assistants directory if it doesn't exist
        const assistantsDir = path.join(demoDir, 'assistants', assistant.id);
        ensureDirectoryExists(assistantsDir);
        
        // Save the icon in the assistant's directory
        const iconPath = path.join(assistantsDir, 'icon.svg');
        fs.writeFileSync(iconPath, iconBuffer);
        console.log(`Saved assistant icon to: ${iconPath}`);
        assistant.icon = `demos/${demoData.id}/assistants/${assistant.id}/icon.svg`;
      }
    }

    // Save demo configuration
    fs.writeFileSync(demoConfigPath, JSON.stringify(demoData, null, 2));
    console.log(`Saved demo config to: ${demoConfigPath}`);

    return new NextResponse(JSON.stringify({ success: true, demo: demoData }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error creating demo:', error);
    return new NextResponse(`Error creating demo: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
} 
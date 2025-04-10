import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// List of static demo IDs that should be excluded from API results
const staticDemoIds = ['math-assistant', 'writing-assistant', 'language-assistant', 'coding-assistant'];

/**
 * Helper function to get the correct file path in both development and production environments
 * In both development and production, we use process.cwd() which should point to the correct location
 */
function getBasePath(): string {
  return process.cwd();
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

// Helper function to ensure both public and standalone directories exist
function getSavePaths(): { publicPath: string, standalonePath: string | null } {
  const basePath = getBasePath();
  const publicPath = basePath;
  
  // Check if we're in production on the server
  const isProduction = process.env.NODE_ENV === 'production';
  const isServer = typeof window === 'undefined';
  
  if (isProduction && isServer) {
    // Check if we're on the EC2 server
    const isEC2 = basePath === '/home/ec2-user/app';
    if (isEC2) {
      // Also save to standalone directory
      return {
        publicPath,
        standalonePath: '/home/ec2-user/app/.next/standalone'
      };
    }
  }
  
  // In all other cases, only use publicPath
  return { publicPath, standalonePath: null };
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

    // Get the paths for saving files
    const { publicPath, standalonePath } = getSavePaths();
    console.log(`Using paths: publicPath=${publicPath}, standalonePath=${standalonePath || 'none'} for demo creation`);

    // Create necessary directories in the public path
    const demoDir = path.join(publicPath, 'public', 'demos', demoData.id);
    const markdownDir = path.join(publicPath, 'public', 'markdown');
    
    // Use our helper function to create directories
    ensureDirectoryExists(demoDir);
    ensureDirectoryExists(markdownDir);
    
    // If we have a standalone path, also create directories there
    let standaloneDemoDir: string | null = null;
    let standaloneMarkdownDir: string | null = null;
    
    if (standalonePath) {
      standaloneDemoDir = path.join(standalonePath, 'public', 'demos', demoData.id);
      standaloneMarkdownDir = path.join(standalonePath, 'public', 'markdown');
      
      ensureDirectoryExists(standaloneDemoDir);
      ensureDirectoryExists(standaloneMarkdownDir);
    }
    
    // Validate that critical paths are writable
    const demoConfigPath = path.join(demoDir, 'config.json');
    if (!validatePathWritable(demoConfigPath)) {
      console.error(`Cannot write to demo config path: ${demoConfigPath}`);
      return new NextResponse('Server file access error', { status: 500 });
    }

    // Save demo icon if provided - to both locations
    if (formData.has('icon')) {
      const iconFile = formData.get('icon') as File;
      const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
      
      // Save to public directory
      const iconPath = path.join(demoDir, 'icon.svg');
      fs.writeFileSync(iconPath, iconBuffer);
      console.log(`Saved demo icon to: ${iconPath}`);
      
      // Also save to standalone directory if it exists
      if (standaloneDemoDir) {
        const standaloneIconPath = path.join(standaloneDemoDir, 'icon.svg');
        fs.writeFileSync(standaloneIconPath, iconBuffer);
        console.log(`Also saved demo icon to standalone: ${standaloneIconPath}`);
      }
      
      demoData.icon = `demos/${demoData.id}/icon.svg`;
    }

    // Save demo explainer markdown - to both locations
    const explainerFile = formData.get('explainer') as File;
    if (explainerFile) {
      const explainerBuffer = Buffer.from(await explainerFile.arrayBuffer());
      
      // Save to public directory
      const explainerPath = path.join(demoDir, 'explainer.md');
      fs.writeFileSync(explainerPath, explainerBuffer);
      console.log(`Saved explainer markdown to: ${explainerPath}`);
      
      // Also save to standalone directory if it exists
      if (standaloneDemoDir) {
        const standaloneExplainerPath = path.join(standaloneDemoDir, 'explainer.md');
        fs.writeFileSync(standaloneExplainerPath, explainerBuffer);
        console.log(`Also saved explainer markdown to standalone: ${standaloneExplainerPath}`);
      }
    } else {
      return new NextResponse('Demo explainer markdown is required', { status: 400 });
    }

    // Save markdown files and icons for each assistant - to both locations
    for (const assistant of demoData.assistants) {
      // Save assistant markdown file
      const markdownFile = formData.get(`markdown_${assistant.id}`) as File;
      if (markdownFile) {
        const markdownBuffer = Buffer.from(await markdownFile.arrayBuffer());
        
        // Save in public markdown directory with standardized naming
        const publicMarkdownPath = path.join(markdownDir, `${demoData.id}-${assistant.id}.md`);
        fs.writeFileSync(publicMarkdownPath, markdownBuffer);
        console.log(`Saved assistant markdown to: ${publicMarkdownPath}`);
        
        // Also save to standalone directory if it exists
        if (standaloneMarkdownDir) {
          const standaloneMarkdownPath = path.join(standaloneMarkdownDir, `${demoData.id}-${assistant.id}.md`);
          fs.writeFileSync(standaloneMarkdownPath, markdownBuffer);
          console.log(`Also saved assistant markdown to standalone: ${standaloneMarkdownPath}`);
        }
      } else {
        return new NextResponse(`Markdown file is required for assistant "${assistant.name}"`, { status: 400 });
      }

      // Save assistant icon if provided - to both locations
      const assistantIconFile = formData.get(`icon_${assistant.id}`) as File;
      if (assistantIconFile) {
        const iconBuffer = Buffer.from(await assistantIconFile.arrayBuffer());
        
        // Create assistants directory if it doesn't exist in public
        const assistantsDir = path.join(demoDir, 'assistants', assistant.id);
        ensureDirectoryExists(assistantsDir);
        
        // Save the icon in the assistant's directory in public
        const iconPath = path.join(assistantsDir, 'icon.svg');
        fs.writeFileSync(iconPath, iconBuffer);
        console.log(`Saved assistant icon to: ${iconPath}`);
        
        // Also save to standalone directory if it exists
        if (standaloneDemoDir) {
          const standaloneAssistantsDir = path.join(standaloneDemoDir, 'assistants', assistant.id);
          ensureDirectoryExists(standaloneAssistantsDir);
          
          const standaloneIconPath = path.join(standaloneAssistantsDir, 'icon.svg');
          fs.writeFileSync(standaloneIconPath, iconBuffer);
          console.log(`Also saved assistant icon to standalone: ${standaloneIconPath}`);
        }
        
        assistant.icon = `demos/${demoData.id}/assistants/${assistant.id}/icon.svg`;
      }
    }

    // Save demo configuration to both locations
    fs.writeFileSync(demoConfigPath, JSON.stringify(demoData, null, 2));
    console.log(`Saved demo config to: ${demoConfigPath}`);
    
    // Also save to standalone directory if it exists
    if (standaloneDemoDir) {
      const standaloneDemoConfigPath = path.join(standaloneDemoDir, 'config.json');
      fs.writeFileSync(standaloneDemoConfigPath, JSON.stringify(demoData, null, 2));
      console.log(`Also saved demo config to standalone: ${standaloneDemoConfigPath}`);
    }

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
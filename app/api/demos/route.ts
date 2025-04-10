import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// List of static demo IDs that should be excluded from API results
const staticDemoIds = ['math-assistant', 'writing-assistant', 'language-assistant', 'coding-assistant'];

export async function GET() {
  try {
    // Get all dynamic demos from the public/demos directory
    const demosDir = path.join(process.cwd(), 'public', 'demos');
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

    // Create necessary directories
    const demoDir = path.join(process.cwd(), 'public', 'demos', demoData.id);
    const markdownDir = path.join(process.cwd(), 'public', 'markdown');
    fs.mkdirSync(demoDir, { recursive: true });
    fs.mkdirSync(markdownDir, { recursive: true });

    // Save demo icon if provided
    if (formData.has('icon')) {
      const iconFile = formData.get('icon') as File;
      const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
      fs.writeFileSync(path.join(demoDir, 'icon.svg'), iconBuffer);
      demoData.icon = `demos/${demoData.id}/icon.svg`;
    }

    // Save demo explainer markdown
    const explainerFile = formData.get('explainer') as File;
    if (explainerFile) {
      const explainerBuffer = Buffer.from(await explainerFile.arrayBuffer());
      fs.writeFileSync(path.join(demoDir, 'explainer.md'), explainerBuffer);
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
      } else {
        return new NextResponse(`Markdown file is required for assistant "${assistant.name}"`, { status: 400 });
      }

      // Save assistant icon if provided
      const assistantIconFile = formData.get(`icon_${assistant.id}`) as File;
      if (assistantIconFile) {
        const iconBuffer = Buffer.from(await assistantIconFile.arrayBuffer());
        
        // Create assistants directory if it doesn't exist
        const assistantsDir = path.join(demoDir, 'assistants', assistant.id);
        fs.mkdirSync(assistantsDir, { recursive: true });
        
        // Save the icon in the assistant's directory
        const iconPath = path.join(assistantsDir, 'icon.svg');
        fs.writeFileSync(iconPath, iconBuffer);
        assistant.icon = `demos/${demoData.id}/assistants/${assistant.id}/icon.svg`;
      }
    }

    // Save demo configuration
    const demoConfigPath = path.join(demoDir, 'config.json');
    fs.writeFileSync(demoConfigPath, JSON.stringify(demoData, null, 2));

    return new NextResponse(JSON.stringify({ success: true, demo: demoData }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error creating demo:', error);
    return new NextResponse('Error creating demo', { status: 500 });
  }
} 
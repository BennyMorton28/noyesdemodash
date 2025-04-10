import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';  // Using fs.promises for async operations
import fsSync from 'fs'; // Sync operations for path checks
import path from 'path';
import { removeSync } from 'fs-extra'; // We'll use fs-extra for directory removal

/**
 * Helper function to get the correct file path in both development and production environments
 * In both development and production, we use process.cwd() which should point to the correct location
 */
function getBasePath(): string {
  return process.cwd();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Properly await the params object
    const { id: demoId } = await Promise.resolve(params);
    
    if (!demoId) {
      return new NextResponse('Demo ID is required', { status: 400 });
    }

    // Use the correct base path
    const basePath = getBasePath();

    // Try to load the demo config
    const configPath = path.join(basePath, 'public', 'demos', demoId, 'config.json');
    
    try {
      // Using async fs operations
      await fs.access(configPath);
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      return new NextResponse(JSON.stringify(config), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // If file doesn't exist, try loading from static config
      return new NextResponse('Demo not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error reading demo config:', error);
    return new NextResponse('Error reading demo config', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: demoId } = await Promise.resolve(params);
    
    if (!demoId) {
      return new NextResponse('Demo ID is required', { status: 400 });
    }

    // Check if it's a static demo
    const staticDemoIds = ['math-assistant', 'writing-assistant', 'language-assistant', 'coding-assistant'];
    if (staticDemoIds.includes(demoId)) {
      return new NextResponse('Cannot delete static demos', { status: 403 });
    }

    // Use the correct base path
    const basePath = getBasePath();

    // Get the demo config first to identify all resources to delete
    const configPath = path.join(basePath, 'public', 'demos', demoId, 'config.json');
    let assistants: { id: string }[] = [];
    
    try {
      await fs.access(configPath);
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      assistants = config.assistants || [];
    } catch (error) {
      return new NextResponse('Demo not found', { status: 404 });
    }

    // Delete all related files in the following order:
    
    // 1. Delete markdown files for all assistants
    const markdownDir = path.join(basePath, 'public', 'markdown');
    for (const assistant of assistants) {
      try {
        const markdownPath = path.join(markdownDir, `${demoId}-${assistant.id}.md`);
        await fs.unlink(markdownPath).catch(() => {
          // Ignore errors if file doesn't exist
          console.log(`Markdown file not found: ${markdownPath}`);
        });
      } catch (error) {
        console.error(`Error deleting markdown for assistant ${assistant.id}:`, error);
        // Continue with other deletions even if one fails
      }
    }

    // 2. Delete the entire demo directory with all assets
    const demoDir = path.join(basePath, 'public', 'demos', demoId);
    try {
      await removeSync(demoDir);
    } catch (error) {
      console.error(`Error deleting demo directory: ${demoDir}`, error);
      return new NextResponse('Failed to delete demo files', { status: 500 });
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error deleting demo:', error);
    return new NextResponse('Error deleting demo', { status: 500 });
  }
} 
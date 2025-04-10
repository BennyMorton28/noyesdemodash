import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Helper function to get the correct file path in both development and production environments
 * In both development and production, we use process.cwd() which should point to the correct location
 */
function getBasePath(): string {
  return process.cwd();
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const demoId = await Promise.resolve(params.id);
    console.log(`Fetching markdown for demo: ${demoId}`);
    
    const basePath = getBasePath();
    
    // Load the demo's markdown file
    let markdownContent = '';
    try {
      // Try to find the markdown in the public directory first
      const markdownPath = path.join(basePath, 'public', 'markdown', `${demoId}.md`);
      
      // Check if file exists
      if (!fs.existsSync(markdownPath)) {
        // Try alternative location for legacy support
        const legacyPath = path.join(basePath, 'assistants', `${demoId}.md`);
        if (!fs.existsSync(legacyPath)) {
          console.error(`Demo markdown file not found at ${markdownPath} or ${legacyPath}`);
          return NextResponse.json(
            { error: `Demo ${demoId} not found` },
            { status: 404 }
          );
        }
        markdownContent = fs.readFileSync(legacyPath, 'utf8');
      } else {
        markdownContent = fs.readFileSync(markdownPath, 'utf8');
      }
      
      console.log(`Successfully loaded markdown for demo ${demoId}`);
    } catch (error) {
      console.error(`Error loading markdown for demo ${demoId}:`, error);
      return NextResponse.json(
        { error: `Failed to load demo ${demoId}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ content: markdownContent });
  } catch (error) {
    console.error('Error fetching markdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markdown' },
      { status: 500 }
    );
  }
} 
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const demoId = await Promise.resolve(params.id);
    console.log(`Fetching markdown for demo: ${demoId}`);
    
    // Load the demo's markdown file
    let markdownContent = '';
    try {
      const markdownPath = path.join(process.cwd(), 'assistants', `${demoId}.md`);
      
      // Check if file exists
      if (!fs.existsSync(markdownPath)) {
        console.error(`Demo markdown file not found: ${markdownPath}`);
        return NextResponse.json(
          { error: `Demo ${demoId} not found` },
          { status: 404 }
        );
      }

      markdownContent = fs.readFileSync(markdownPath, 'utf8');
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
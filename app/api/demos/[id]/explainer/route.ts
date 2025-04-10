import { NextRequest, NextResponse } from 'next/server';
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const demoId = await Promise.resolve(params.id);
    console.log(`Fetching explainer markdown for demo: ${demoId}`);
    
    const basePath = getBasePath();
    
    // Load the demo's explainer markdown file
    let markdownContent = '';
    try {
      const markdownPath = path.join(basePath, 'public', 'demos', demoId, 'explainer.md');
      
      // Check if file exists
      if (!fs.existsSync(markdownPath)) {
        console.error(`Demo explainer markdown file not found: ${markdownPath}`);
        return NextResponse.json(
          { error: `Explainer for demo ${demoId} not found` },
          { status: 404 }
        );
      }

      markdownContent = fs.readFileSync(markdownPath, 'utf8');
      console.log(`Successfully loaded explainer markdown for demo ${demoId}`);
    } catch (error) {
      console.error(`Error loading explainer markdown for demo ${demoId}:`, error);
      return NextResponse.json(
        { error: `Failed to load explainer for demo ${demoId}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ content: markdownContent });
  } catch (error) {
    console.error('Error fetching explainer markdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch explainer markdown' },
      { status: 500 }
    );
  }
} 
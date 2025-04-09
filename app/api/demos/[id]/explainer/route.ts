import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

    // Define paths to check for markdown files
    const paths = [
      path.join(process.cwd(), 'public', 'markdown', `${demoId}-explainer.md`),
      path.join(process.cwd(), 'public', 'demos', demoId, 'explainer.md'),
      // Add path for newly created demos in the standalone directory
      path.join(process.cwd(), '.next', 'standalone', 'public', 'demos', demoId, 'explainer.md')
    ];

    // Try each path in sequence
    for (const filePath of paths) {
      try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        return new NextResponse(content, {
          headers: {
            'Content-Type': 'text/markdown',
          },
        });
      } catch (error) {
        // Continue to next path if file not found
        continue;
      }
    }

    // If no file was found in any location
    return new NextResponse('Explainer not found', { status: 404 });
  } catch (error) {
    console.error('Error reading explainer:', error);
    return new NextResponse('Error reading explainer', { status: 500 });
  }
} 
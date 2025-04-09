import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; assistantId: string } }
) {
  try {
    // Get the dynamic params from the URL segments
    const segments = request.nextUrl.pathname.split('/');
    const demoId = segments[3]; // demos/[id]/assistants/[assistantId]/markdown
    const assistantId = segments[5];

    if (!demoId || !assistantId) {
      return new NextResponse('Invalid demo or assistant ID', { status: 400 });
    }

    // Define paths to check for markdown files
    const paths = [
      // Check in the public markdown directory first for static demos
      path.join(process.cwd(), 'public', 'markdown', `${demoId}-${assistantId}.md`),
      // Then check in the assistants directory for legacy support
      path.join(process.cwd(), 'assistants', `${demoId}-${assistantId}.md`),
      // Finally check in a demo-specific directory for dynamic demos
      path.join(process.cwd(), 'public', 'demos', demoId, 'markdown', `${assistantId}.md`)
    ];

    // Try each path until we find the file
    for (const filePath of paths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return new NextResponse(content, {
          headers: {
            'Content-Type': 'text/markdown',
          },
        });
      }
    }

    // If no file is found, return 404
    return new NextResponse('Markdown file not found', { status: 404 });
  } catch (error) {
    console.error('Error reading markdown file:', error);
    return new NextResponse('Error reading markdown file', { status: 500 });
  }
} 
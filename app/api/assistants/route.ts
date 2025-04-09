import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const assistantsDir = path.join(process.cwd(), 'assistants');
    
    // Check if the assistants directory exists
    if (!fs.existsSync(assistantsDir)) {
      return NextResponse.json({ assistants: [] });
    }
    
    // Read all markdown files in the assistants directory
    const files = fs.readdirSync(assistantsDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    // Extract assistant information from the markdown files
    const assistants = markdownFiles.map(file => {
      const id = file.replace('.md', '');
      const content = fs.readFileSync(path.join(assistantsDir, file), 'utf8');
      
      // Extract name and description from the markdown content
      // Assuming the first line is the name and the second line is the description
      const lines = content.split('\n');
      const name = lines[0].replace('# ', '').trim();
      const description = lines[1]?.trim() || '';
      
      return {
        id,
        name,
        description
      };
    });
    
    return NextResponse.json({ assistants });
  } catch (error) {
    console.error('Error listing assistants:', error);
    return NextResponse.json(
      { error: 'Failed to list assistants' },
      { status: 500 }
    );
  }
} 
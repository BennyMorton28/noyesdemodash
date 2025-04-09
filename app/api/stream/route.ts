import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client with API key from environment variable
const client = new OpenAI();

export async function POST(req: Request) {
  try {
    const { prompt, assistantId, demoId } = await req.json();

    if (!prompt || !assistantId || !demoId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try to load the markdown instructions
    let instructions = '';
    const markdownPaths = [
      // First try the public markdown directory
      path.join(process.cwd(), 'public', 'markdown', `${demoId}-${assistantId}.md`),
      // Then try the demo-specific directory
      path.join(process.cwd(), 'public', 'demos', demoId, 'markdown', `${assistantId}.md`),
      // Finally try the legacy location
      path.join(process.cwd(), 'assistants', `${assistantId}.md`)
    ];

    for (const markdownPath of markdownPaths) {
      if (fs.existsSync(markdownPath)) {
        instructions = fs.readFileSync(markdownPath, 'utf-8');
        break;
      }
    }

    if (!instructions) {
      return NextResponse.json(
        { error: 'Assistant instructions not found' },
        { status: 404 }
      );
    }

    // Create the full prompt with instructions
    const fullPrompt = `You are an AI assistant with the following instructions:

${instructions}

User: ${prompt}`;

    try {
      const stream = await client.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        stream: true,
      });

      // Create a new TransformStream for streaming the response
      const encoder = new TextEncoder();
      const stream_response = new TransformStream();

      // Start processing the stream
      (async () => {
        const writer = stream_response.writable.getWriter();

        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              const data = {
                item_id: event.item_id,
                output_index: event.output_index,
                content_index: event.content_index,
                delta: event.delta,
              };
              await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream processing error' })}\n\n`)
          );
        } finally {
          await writer.close();
        }
      })();

      // Return the readable stream
      return new NextResponse(stream_response.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (error) {
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to process request with OpenAI API' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
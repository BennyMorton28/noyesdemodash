import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST() {
  try {
    // Only allow this endpoint in production environment
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { message: 'Server restart only available in production' },
        { status: 400 }
      );
    }

    // Execute PM2 restart command
    await execPromise('pm2 restart noyesdemodash');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Server restart initiated' 
    });
  } catch (error) {
    console.error('Error restarting server:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to restart server' },
      { status: 500 }
    );
  }
} 
import React, { useState, useEffect } from 'react';

interface ProcessingDemoOverlayProps {
  demoId: string;
  demoTitle: string;
  onComplete: () => void;
}

export default function ProcessingDemoOverlay({ demoId, demoTitle, onComplete }: ProcessingDemoOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const startProcessing = async () => {
      try {
        // Step 1: Restart the server
        setStatus('Preparing your demo environment...');
        setProgress(10);
        
        const restartResponse = await fetch('/api/server/restart', {
          method: 'POST',
        });
        
        if (!restartResponse.ok) {
          throw new Error('Failed to prepare demo environment');
        }
        
        setProgress(30);
        setStatus('Optimizing your demo files...');
        
        // Step 2: Poll for the availability of the demo's icon file
        // This indicates the server has restarted and the files are accessible
        let iconAvailable = false;
        const maxAttempts = 15;
        let attempts = 0;
        
        while (!iconAvailable && attempts < maxAttempts) {
          if (!mounted) return;
          
          try {
            // Increase progress with each attempt
            setProgress(30 + Math.min(60, attempts * 4));
            
            // Try to fetch the icon file to see if it's available yet
            const iconResponse = await fetch(`/demos/${demoId}/icon.svg`, {
              method: 'HEAD',
              // Add cache buster to prevent browser caching
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (iconResponse.ok) {
              iconAvailable = true;
              setStatus('Finalizing your demo...');
              setProgress(95);
            } else {
              // Wait before trying again
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
              setStatus(`Setting up your content (${attempts}/${maxAttempts})...`);
            }
          } catch (e) {
            console.log('Error checking demo availability:', e);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!iconAvailable) {
          throw new Error('Demo preparation timed out. Please refresh and try again.');
        }
        
        // Final steps - everything is ready!
        setProgress(100);
        setStatus('Demo ready!');
        setIsComplete(true);
        
        // Short delay before completing to show the "Demo ready!" message
        setTimeout(() => {
          if (mounted) {
            onComplete();
          }
        }, 1000);
        
      } catch (error) {
        console.error('Error processing demo:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };
    
    startProcessing();
    
    return () => {
      mounted = false;
    };
  }, [demoId, onComplete]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-8 shadow-xl text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          {isComplete ? 'Ready!' : 'Processing Your Demo'}
        </h2>
        
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          {isComplete 
            ? `"${demoTitle}" is ready to view` 
            : `We're setting up "${demoTitle}" for you...`}
        </p>
        
        {error ? (
          <div className="mb-6">
            <div className="bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 p-4 rounded-md text-sm">
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Refresh Page
            </button>
          </div>
        ) : (
          <>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status}
            </p>
            
            {isComplete && (
              <button
                onClick={onComplete}
                className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                View Demo Now
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
} 
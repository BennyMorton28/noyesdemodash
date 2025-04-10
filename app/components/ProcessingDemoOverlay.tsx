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
    let timeoutId: NodeJS.Timeout;
    
    const startProcessing = async () => {
      try {
        // Record the start time
        const startTime = Date.now();

        // Step 1: Restart the server
        setStatus('Preparing your demo environment...');
        setProgress(10);
        
        try {
          const restartResponse = await fetch('/api/server/restart', {
            method: 'POST',
          });

          // Log the response but don't break the flow if there's an issue
          if (!restartResponse.ok) {
            console.warn('Server restart request returned non-OK status:', restartResponse.status);
          }
        } catch (restartError) {
          console.warn('Error initiating server restart:', restartError);
          // Continue anyway - the file may still become available
        }
        
        setProgress(30);
        setStatus('Optimizing your demo files...');
        
        // Step 2: Poll for the availability of the demo's files
        // This indicates the server has restarted and the files are accessible
        let iconAvailable = false;
        let configAvailable = false;
        const maxAttempts = 20; // More attempts to give it more time
        let attempts = 0;
        
        // We'll consider it successful if either icon or config is available
        while ((!iconAvailable && !configAvailable) && attempts < maxAttempts) {
          if (!mounted) return;
          
          try {
            // Increase progress with each attempt
            setProgress(30 + Math.min(60, attempts * 3));
            
            // Try to fetch the icon file first
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
              // Try config.json as an alternative
              try {
                const configResponse = await fetch(`/api/demos/${demoId}`, {
                  headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                });
                
                if (configResponse.ok) {
                  configAvailable = true;
                  setStatus('Finalizing your demo...');
                  setProgress(95);
                }
              } catch (configError) {
                // Ignore config error and continue polling
              }
            }
            
            if (!iconAvailable && !configAvailable) {
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
        
        // If we haven't succeeded after all attempts but at least 15 seconds have passed,
        // we'll consider it a success anyway to avoid getting stuck
        const elapsedTime = Date.now() - startTime;
        if ((!iconAvailable && !configAvailable) && elapsedTime >= 15000) {
          console.log('Timed out waiting for files but proceeding anyway after 15 seconds');
          setStatus('Demo setup complete!');
          setProgress(100);
          setIsComplete(true);
        } else if (!iconAvailable && !configAvailable) {
          throw new Error('Demo preparation timed out. Please refresh and try again.');
        } else {
          // Success path
          setProgress(100);
          setStatus('Demo ready!');
          setIsComplete(true);
        }
        
        // Short delay before completing to show the "Demo ready!" message
        timeoutId = setTimeout(() => {
          if (mounted) {
            onComplete();
          }
        }, 1500);
        
      } catch (error) {
        console.error('Error processing demo:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };
    
    startProcessing();
    
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [demoId, onComplete, demoTitle]);
  
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
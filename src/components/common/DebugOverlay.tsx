import { useDemoStore } from '@/store/demoStore';
import { XMarkIcon } from '@heroicons/react/24/outline';

export const DebugOverlay = () => {
  const { debugMode, toggleDebugMode, currentSession } = useDemoStore();

  if (!debugMode) {
    return (
      <button
        onClick={toggleDebugMode}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-800 text-white p-4 rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Debug Panel</h3>
        <button onClick={toggleDebugMode}>
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-2">
        <div className="border-b border-gray-700 pb-2">
          <h4 className="font-medium">Current Session</h4>
          <pre className="text-xs mt-1 overflow-auto max-h-40">
            {JSON.stringify(currentSession, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}; 
import { Assistant } from '@/types';
import { useDemoStore } from '@/store/demoStore';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface AssistantSelectorProps {
  assistants: Assistant[];
  onSelect: (assistant: Assistant) => void;
}

export const AssistantSelector = ({ assistants, onSelect }: AssistantSelectorProps) => {
  const { currentSession } = useDemoStore();

  const isAssistantUnlocked = (assistant: Assistant) => {
    if (!assistant.password) return true;
    return currentSession?.unlockedAssistantIds.includes(assistant.id) ?? false;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {assistants.map((assistant) => {
        const isUnlocked = isAssistantUnlocked(assistant);
        
        return (
          <button
            key={assistant.id}
            onClick={() => isUnlocked && onSelect(assistant)}
            className={`relative p-4 rounded-lg border transition-all ${
              isUnlocked
                ? 'bg-white hover:border-blue-500 cursor-pointer'
                : 'bg-gray-100 cursor-not-allowed'
            }`}
          >
            <div className="aspect-square relative mb-2">
              {assistant.iconPath ? (
                <Image
                  src={assistant.iconPath}
                  alt={assistant.name}
                  fill
                  className={`object-cover rounded-lg ${
                    !isUnlocked && 'filter grayscale'
                  }`}
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-2xl text-gray-400">{assistant.name[0]}</span>
                </div>
              )}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <LockClosedIcon className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <h3 className="text-sm font-medium text-center">{assistant.name}</h3>
            {!isUnlocked && assistant.displayWhenLocked.description && (
              <p className="text-xs text-gray-500 text-center mt-1">
                {assistant.displayWhenLocked.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}; 
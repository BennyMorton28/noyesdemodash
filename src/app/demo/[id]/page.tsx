import { useDemoStore } from '@/store/demoStore';
import { Layout } from '@/components/common/Layout';
import { ChatInterface } from '@/components/demo/ChatInterface';
import { AssistantSelector } from '@/components/demo/AssistantSelector';
import { MarkdownViewer } from '@/components/demo/MarkdownViewer';
import { PasswordModal } from '@/components/demo/PasswordModal';
import { useState } from 'react';
import { Assistant } from '@/types';

interface DemoPageProps {
  params: {
    id: string;
  };
}

export default function DemoPage({ params }: DemoPageProps) {
  const { demos, currentSession, setCurrentSession } = useDemoStore();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Assistant | null>(null);

  const demo = demos.find((d) => d.id === params.id);

  if (!demo) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Demo not found</h1>
          <p className="mt-2 text-gray-600">The demo you're looking for doesn't exist.</p>
        </div>
      </Layout>
    );
  }

  const handleAssistantSelect = (assistant: Assistant) => {
    if (assistant.password && !currentSession?.unlockedAssistantIds.includes(assistant.id)) {
      setPasswordTarget(assistant);
      setIsPasswordModalOpen(true);
      return;
    }
    setSelectedAssistant(assistant);
  };

  const handlePasswordSubmit = (password: string) => {
    if (!passwordTarget) return;

    if (password === passwordTarget.password) {
      setCurrentSession({
        ...currentSession,
        unlockedAssistantIds: [
          ...(currentSession?.unlockedAssistantIds || []),
          passwordTarget.id,
        ],
      });
      setSelectedAssistant(passwordTarget);
    }

    setIsPasswordModalOpen(false);
    setPasswordTarget(null);
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 h-full gap-4">
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <h1 className="text-2xl font-bold">{demo.name}</h1>
              <AssistantSelector
                assistants={demo.assistants}
                onSelect={handleAssistantSelect}
              />
            </div>
            {selectedAssistant ? (
              <ChatInterface assistant={selectedAssistant} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select an assistant to start chatting
              </div>
            )}
          </div>
          <div className="h-full overflow-auto border rounded-lg">
            <MarkdownViewer content={demo.explanationMarkdownPath} />
          </div>
        </div>
      </div>
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPasswordTarget(null);
        }}
        onSubmit={handlePasswordSubmit}
        title={`Unlock ${passwordTarget?.name || 'Assistant'}`}
      />
    </Layout>
  );
} 
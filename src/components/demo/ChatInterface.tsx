import { useState } from 'react';
import { ChatMessage, Assistant } from '@/types';
import { useDemoStore } from '@/store/demoStore';

interface ChatInterfaceProps {
  assistant: Assistant;
}

export const ChatInterface = ({ assistant }: ChatInterfaceProps) => {
  const [message, setMessage] = useState('');
  const { currentSession, setCurrentSession } = useDemoStore();

  const handleSend = async () => {
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      timestamp: Date.now(),
      sender: 'user',
    };

    // Update session with new message
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        chatHistory: [...currentSession.chatHistory, newMessage],
      });
    }

    setMessage('');

    // TODO: Implement OpenAI streaming response
    // This is where we'll add the OpenAI integration
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentSession?.chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}; 
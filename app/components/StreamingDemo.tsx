'use client';

import { useState, useRef, useEffect } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import DemoIcon from './DemoIcon';

interface StreamingResponse {
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

interface StreamingDemoProps {
  assistantId: string;
  assistantName: string;
  demoId: string;
  assistantIcon?: string;
}

interface Message {
  type: 'user' | 'assistant';
  content: string;
}

interface Props {
  node?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

export default function StreamingDemo({ assistantId, assistantName, demoId, assistantIcon }: StreamingDemoProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Add effect to focus input field after AI response is complete
  useEffect(() => {
    // Focus the input when loading finishes (AI stops responding)
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !assistantId) return;

    setIsLoading(true);
    setError(null);
    
    // Add user message immediately
    setMessages(prev => [...prev, { type: 'user', content: input }]);
    const currentInput = input;
    setInput(''); // Clear input right away

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Format messages for the API request
      const messageHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      // Add the current message (this was already added to the messages state but not included in our messageHistory yet)
      messageHistory.push({
        role: 'user',
        content: currentInput
      });

      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: currentInput,
          messageHistory: messageHistory,
          assistantId: assistantId,
          demoId: demoId
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      // Add assistant message placeholder
      setMessages(prev => [...prev, { type: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      let accumulatedResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamingResponse;
              accumulatedResponse += data.delta;
              // Update the last message (which is the assistant's response)
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = accumulatedResponse;
                return newMessages;
              });
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Streaming error:', err);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      
      // No focus management needed
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      abortControllerRef.current = null;
      
      // No focus management needed
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* Assistant Name Header - Fixed at top of chat */}
      <div className="flex-none bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          {assistantIcon && (
            <div className="mr-3">
              <DemoIcon icon={assistantIcon} name={assistantName} size={32} />
            </div>
          )}
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{assistantName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your AI assistant</p>
          </div>
        </div>
      </div>

      {/* Chat Messages - Scrollable area */}
      <div 
        ref={chatContainerRef}
        className="absolute top-[72px] bottom-[60px] left-0 right-0 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-900"
        style={{ paddingBottom: '80px' }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white ml-4'
                  : 'bg-white dark:bg-gray-800 mr-4'
              }`}
            >
              {message.type === 'user' ? (
                <p className="whitespace-pre-wrap m-0 text-white">{message.content}</p>
              ) : (
                <div className="prose prose-sm md:prose-base dark:prose-invert math-content max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeKatex, {throwOnError: false, output: 'html', trust: true}], rehypeHighlight]}
                    components={{
                      h1: ({node, ...props}: Props) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                      h2: ({node, ...props}: Props) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
                      h3: ({node, ...props}: Props) => <h3 className="text-xl font-medium mt-4 mb-2" {...props} />,
                      p: ({node, ...props}: Props) => <p className="my-4 leading-relaxed" {...props} />,
                      ul: ({node, ...props}: Props) => <ul className="list-disc list-inside my-4 space-y-2" {...props} />,
                      ol: ({node, ...props}: Props) => <ol className="list-decimal list-inside my-4 space-y-2" {...props} />,
                      li: ({node, ...props}: Props) => <li className="ml-4" {...props} />,
                      code: ({className, children, ...props}: Props) => {
                        const isInline = !className?.includes('language-');
                        return isInline ? (
                          <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>{children}</code>
                        ) : (
                          <code className="block bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto text-sm" {...props}>{children}</code>
                        );
                      },
                      pre: ({node, ...props}: Props) => <pre className="bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto" {...props} />,
                      blockquote: ({node, ...props}: Props) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic" {...props} />,
                      a: ({node, ...props}: Props) => <a className="text-blue-500 hover:text-blue-600 underline" {...props} />,
                      table: ({node, ...props}: Props) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600" {...props} /></div>,
                      th: ({node, ...props}: Props) => <th className="px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left" {...props} />,
                      td: ({node, ...props}: Props) => <td className="px-4 py-2 border-t border-gray-200 dark:border-gray-700" {...props} />,
                      img: ({node, ...props}: Props) => <img className="max-w-full h-auto rounded my-4" {...props} />
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} className="h-[20px]" />
      </div>

      {/* Input Box - Fixed at bottom, hugging the bottom bar */}
      <div className="fixed bottom-[60px] left-0 md:w-1/2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Cancel
            </button>
          )}
        </form>
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 
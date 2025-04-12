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
import { TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

export default function StreamingDemo({ assistantId, assistantName, demoId, assistantIcon }: StreamingDemoProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportOptionsRef = useRef<HTMLDivElement>(null);

  // Close export options when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportOptionsRef.current && !exportOptionsRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Function to handle clearing the chat
  const handleClearChat = () => {
    // If there's an ongoing request, abort it
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset all chat-related state
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setError(null);
    
    // Focus the input field after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

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

  // Function to export chat as PDF
  const exportAsPDF = async () => {
    if (!chatContainerRef.current || messages.length === 0) return;
    
    try {
      // Close export options menu
      setShowExportOptions(false);
      
      // Create a clone of the chat container to prepare for capture
      const chatClone = chatContainerRef.current.cloneNode(true) as HTMLElement;
      
      // Apply safe styling
      chatClone.style.position = 'absolute';
      chatClone.style.left = '-9999px';
      chatClone.style.top = '0';
      chatClone.style.width = '800px'; // Wider for better fit
      chatClone.style.backgroundColor = '#ffffff';
      chatClone.style.padding = '20px';
      chatClone.style.color = '#000000';
      
      // Add a header with the assistant name at the top
      const header = document.createElement('div');
      header.style.fontSize = '24px';
      header.style.fontWeight = 'bold';
      header.style.marginBottom = '30px';
      header.style.textAlign = 'center';
      header.style.color = '#000000';
      header.textContent = `Conversation with ${assistantName}`;
      chatClone.prepend(header);
      
      // Better styling for the message bubbles
      const messageElements = chatClone.querySelectorAll('.flex');
      messageElements.forEach(messageEl => {
        if (messageEl instanceof HTMLElement) {
          // Add proper spacing between messages
          messageEl.style.marginBottom = '20px';
          
          // Style bubble containers individually
          const bubbleContainer = messageEl.querySelector('div:not(.prose)');
          if (bubbleContainer instanceof HTMLElement) {
            // Apply styles based on message type
            const isUserMessage = bubbleContainer.classList.contains('bg-blue-500');
            
            // Clear background classes and apply direct styles
            bubbleContainer.className = '';
            bubbleContainer.style.padding = '12px';
            bubbleContainer.style.borderRadius = '12px';
            bubbleContainer.style.maxWidth = '75%';
            bubbleContainer.style.marginLeft = isUserMessage ? 'auto' : '0';
            bubbleContainer.style.marginRight = isUserMessage ? '0' : 'auto';
            
            // Set background and text colors directly
            if (isUserMessage) {
              bubbleContainer.style.backgroundColor = '#3b82f6'; // blue-500
              bubbleContainer.style.color = '#ffffff';
            } else {
              bubbleContainer.style.backgroundColor = '#ffffff'; // white
              bubbleContainer.style.color = '#000000';
              bubbleContainer.style.border = '1px solid #e5e7eb'; // Add border for assistant messages
            }
            
            // Add subtle shadows
            bubbleContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }
          
          // Ensure text content is properly styled in user messages
          const userTextContent = messageEl.querySelector('p');
          if (userTextContent instanceof HTMLElement && bubbleContainer instanceof HTMLElement) {
            const isUserBubble = bubbleContainer.style.backgroundColor === '#3b82f6';
            userTextContent.style.margin = '0';
            userTextContent.style.padding = '0';
            userTextContent.style.whiteSpace = 'pre-wrap';
            userTextContent.style.color = isUserBubble ? '#ffffff' : '#000000';
          }
          
          // Style markdown content in assistant messages
          const assistantContent = messageEl.querySelector('.prose');
          if (assistantContent instanceof HTMLElement) {
            assistantContent.style.color = '#000000';
            assistantContent.style.fontSize = '14px';
            assistantContent.style.lineHeight = '1.5';
            
            // Style all text elements within markdown
            const textElements = assistantContent.querySelectorAll('p, li, h1, h2, h3, blockquote, td, th');
            textElements.forEach(el => {
              if (el instanceof HTMLElement) {
                el.style.color = '#000000';
                el.style.margin = '8px 0';
              }
            });
            
            // Style code blocks
            const codeElements = assistantContent.querySelectorAll('pre, code');
            codeElements.forEach(el => {
              if (el instanceof HTMLElement) {
                el.style.backgroundColor = '#f3f4f6'; // gray-100
                el.style.color = '#111827'; // gray-900
                el.style.padding = el.tagName === 'PRE' ? '12px' : '2px 4px';
                el.style.borderRadius = '4px';
                el.style.fontFamily = 'monospace';
              }
            });
          }
        }
      });
      
      // Add to document body temporarily
      document.body.appendChild(chatClone);
      
      // Use html2canvas with better configuration
      const canvas = await html2canvas(chatClone, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        onclone: (clonedDoc) => {
          // Force any remaining problematic styles
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            if (el instanceof HTMLElement) {
              const computedStyle = window.getComputedStyle(el);
              if (computedStyle.backgroundColor.includes('oklch')) {
                el.style.backgroundColor = '#ffffff';
              }
              if (computedStyle.color.includes('oklch')) {
                el.style.color = '#000000';
              }
            }
          });
        }
      });
      
      // Convert canvas to PDF using jsPDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`chat-with-${assistantName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Clean up
      document.body.removeChild(chatClone);
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      setError('Failed to export chat as PDF');
    }
  };
  
  // Function to export chat as PNG - use same styling improvements as PDF
  const exportAsPNG = async () => {
    if (!chatContainerRef.current || messages.length === 0) return;
    
    try {
      // Close export options menu
      setShowExportOptions(false);
      
      // Create a clone of the chat container to prepare for capture
      const chatClone = chatContainerRef.current.cloneNode(true) as HTMLElement;
      
      // Apply safe styling
      chatClone.style.position = 'absolute';
      chatClone.style.left = '-9999px';
      chatClone.style.top = '0';
      chatClone.style.width = '800px'; // Wider for better fit
      chatClone.style.backgroundColor = '#ffffff';
      chatClone.style.padding = '20px';
      chatClone.style.color = '#000000';
      
      // Add a header with the assistant name at the top
      const header = document.createElement('div');
      header.style.fontSize = '24px';
      header.style.fontWeight = 'bold';
      header.style.marginBottom = '30px';
      header.style.textAlign = 'center';
      header.style.color = '#000000';
      header.textContent = `Conversation with ${assistantName}`;
      chatClone.prepend(header);
      
      // Better styling for the message bubbles
      const messageElements = chatClone.querySelectorAll('.flex');
      messageElements.forEach(messageEl => {
        if (messageEl instanceof HTMLElement) {
          // Add proper spacing between messages
          messageEl.style.marginBottom = '20px';
          
          // Get message type by checking for justify-end class
          const isUserMessage = messageEl.classList.contains('justify-end');
          
          // Style bubble containers individually
          const bubbleContainer = messageEl.querySelector('div:not(.prose)');
          if (bubbleContainer instanceof HTMLElement) {
            // Clear background classes and apply direct styles
            bubbleContainer.className = '';
            bubbleContainer.style.padding = '12px';
            bubbleContainer.style.borderRadius = '12px';
            bubbleContainer.style.maxWidth = '75%';
            bubbleContainer.style.marginLeft = isUserMessage ? 'auto' : '0';
            bubbleContainer.style.marginRight = isUserMessage ? '0' : 'auto';
            
            // Set background and text colors directly
            if (isUserMessage) {
              bubbleContainer.style.backgroundColor = '#3b82f6'; // blue-500
              bubbleContainer.style.color = '#ffffff';
            } else {
              bubbleContainer.style.backgroundColor = '#ffffff'; // white
              bubbleContainer.style.color = '#000000';
              bubbleContainer.style.border = '1px solid #e5e7eb'; // Add border for assistant messages
            }
            
            // Add subtle shadows
            bubbleContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }
          
          // Ensure text content is properly styled in user messages
          const userTextContent = messageEl.querySelector('p');
          if (userTextContent instanceof HTMLElement && bubbleContainer instanceof HTMLElement) {
            const isUserBubble = isUserMessage;
            userTextContent.style.margin = '0';
            userTextContent.style.padding = '0';
            userTextContent.style.whiteSpace = 'pre-wrap';
            userTextContent.style.color = isUserBubble ? '#ffffff' : '#000000';
          }
          
          // Style markdown content in assistant messages
          const assistantContent = messageEl.querySelector('.prose');
          if (assistantContent instanceof HTMLElement) {
            assistantContent.style.color = '#000000';
            assistantContent.style.fontSize = '14px';
            assistantContent.style.lineHeight = '1.5';
            
            // Style all text elements within markdown
            const textElements = assistantContent.querySelectorAll('p, li, h1, h2, h3, blockquote, td, th');
            textElements.forEach(el => {
              if (el instanceof HTMLElement) {
                el.style.color = '#000000';
                el.style.margin = '8px 0';
              }
            });
            
            // Style code blocks
            const codeElements = assistantContent.querySelectorAll('pre, code');
            codeElements.forEach(el => {
              if (el instanceof HTMLElement) {
                el.style.backgroundColor = '#f3f4f6'; // gray-100
                el.style.color = '#111827'; // gray-900
                el.style.padding = el.tagName === 'PRE' ? '12px' : '2px 4px';
                el.style.borderRadius = '4px';
                el.style.fontFamily = 'monospace';
              }
            });
          }
        }
      });
      
      // Add to document body temporarily
      document.body.appendChild(chatClone);
      
      // Use html2canvas with better configuration
      const canvas = await html2canvas(chatClone, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        onclone: (clonedDoc) => {
          // Force any remaining problematic styles
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            if (el instanceof HTMLElement) {
              const computedStyle = window.getComputedStyle(el);
              if (computedStyle.backgroundColor.includes('oklch')) {
                el.style.backgroundColor = '#ffffff';
              }
              if (computedStyle.color.includes('oklch')) {
                el.style.color = '#000000';
              }
            }
          });
        }
      });
      
      // Create a download link
      const link = document.createElement('a');
      link.download = `chat-with-${assistantName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      // Clean up
      document.body.removeChild(chatClone);
    } catch (error) {
      console.error('Error exporting as PNG:', error);
      setError('Failed to export chat as PNG');
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* Assistant Name Header - Fixed at top of chat */}
      <div className="flex-none bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
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
          <div className="flex space-x-2">
            <div className="relative" ref={exportOptionsRef}>
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="flex items-center px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                disabled={messages.length === 0}
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                Export
              </button>
              
              {showExportOptions && (
                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                  <div className="py-1">
                    <button
                      onClick={exportAsPNG}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Export as PNG
                    </button>
                    <button
                      onClick={exportAsPDF}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Export as PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleClearChat}
              className="flex items-center px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              disabled={messages.length === 0}
            >
              <TrashIcon className="w-4 h-4 mr-1" />
              Clear Chat
            </button>
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
                      h1: ({children, ...props}: React.ComponentPropsWithoutRef<'h1'>) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props}>{children}</h1>,
                      h2: ({children, ...props}: React.ComponentPropsWithoutRef<'h2'>) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props}>{children}</h2>,
                      h3: ({children, ...props}: React.ComponentPropsWithoutRef<'h3'>) => <h3 className="text-xl font-medium mt-4 mb-2" {...props}>{children}</h3>,
                      p: ({children, ...props}: React.ComponentPropsWithoutRef<'p'>) => <p className="my-4 leading-relaxed" {...props}>{children}</p>,
                      ul: ({children, ...props}: React.ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc list-inside my-4 space-y-2" {...props}>{children}</ul>,
                      ol: ({children, ...props}: React.ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal list-inside my-4 space-y-2" {...props}>{children}</ol>,
                      li: ({children, ...props}: React.ComponentPropsWithoutRef<'li'>) => <li className="ml-4" {...props}>{children}</li>,
                      code: ({className, children, ...props}: React.ComponentPropsWithoutRef<'code'>) => {
                        const isInline = !className?.includes('language-');
                        return isInline ? (
                          <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>{children}</code>
                        ) : (
                          <code className="block bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto text-sm" {...props}>{children}</code>
                        );
                      },
                      pre: ({children, ...props}: React.ComponentPropsWithoutRef<'pre'>) => <pre className="bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto" {...props}>{children}</pre>,
                      blockquote: ({children, ...props}: React.ComponentPropsWithoutRef<'blockquote'>) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic" {...props}>{children}</blockquote>,
                      a: ({children, ...props}: React.ComponentPropsWithoutRef<'a'>) => <a className="text-blue-500 hover:text-blue-600 underline" {...props}>{children}</a>,
                      table: ({children, ...props}: React.ComponentPropsWithoutRef<'table'>) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600" {...props}>{children}</table></div>,
                      th: ({children, ...props}: React.ComponentPropsWithoutRef<'th'>) => <th className="px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left" {...props}>{children}</th>,
                      td: ({children, ...props}: React.ComponentPropsWithoutRef<'td'>) => <td className="px-4 py-2 border-t border-gray-200 dark:border-gray-700" {...props}>{children}</td>,
                      img: ({...props}: React.ComponentPropsWithoutRef<'img'>) => <img className="max-w-full h-auto rounded my-4" {...props} />
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
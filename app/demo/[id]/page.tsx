'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import StreamingDemo from '../../components/StreamingDemo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import { ArrowLeftIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import DemoIcon from '../../components/DemoIcon';
import PasswordInput from '../../components/PasswordInput';

interface Assistant {
  id: string;
  name: string;
  description: string;
  icon?: string;
  hasPassword: boolean;
  password?: string;
}

interface DemoConfig {
  id: string;
  title: string;
  author: string;
  icon?: string;
  assistants: Assistant[];
}

// Demo configurations
const demoConfigs: Record<string, DemoConfig> = {
  'math-assistant': {
    id: 'math-assistant',
    title: 'Math Assistant',
    author: 'Benny',
    icon: 'math',
    assistants: [
      {
        id: 'math-assistant',
        name: 'Math Assistant',
        description: 'Helps with mathematical problems and concepts',
        hasPassword: false
      }
    ]
  },
  'writing-assistant': {
    id: 'writing-assistant',
    title: 'Writing Assistant',
    author: 'Benny',
    icon: 'writing',
    assistants: [
      {
        id: 'writing-assistant',
        name: 'Writing Assistant',
        description: 'Helps with writing and content creation',
        hasPassword: false
      }
    ]
  },
  'language-assistant': {
    id: 'language-assistant',
    title: 'Language Assistant',
    author: 'Benny',
    icon: 'language',
    assistants: [
      {
        id: 'language-assistant',
        name: 'Language Assistant',
        description: 'Helps with language learning and translation',
        hasPassword: false
      },
      {
        id: 'language-assistant-advanced',
        name: 'Advanced Language Assistant',
        description: 'Advanced language analysis and translation',
        hasPassword: true,
        password: 'lang123'
      }
    ]
  },
  'coding-assistant': {
    id: 'coding-assistant',
    title: 'Coding Assistant',
    author: 'Benny',
    icon: 'coding',
    assistants: [
      {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Reviews code and suggests improvements',
        hasPassword: false
      },
      {
        id: 'debug-helper',
        name: 'Debug Helper',
        description: 'Helps with debugging code issues',
        hasPassword: true,
        password: 'code123'
      }
    ]
  }
};

export default function DemoInterface() {
  const params = useParams();
  const demoId = params.id as string;
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [unlockedAssistants, setUnlockedAssistants] = useState<Set<string>>(new Set());
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [demoConfig, setDemoConfig] = useState<DemoConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to load markdown content - now only loads demo explainer
  const loadExplainerMarkdown = async (demoId: string) => {
    try {
      const path = `/demos/${demoId}/explainer.md`;
      console.log(`Loading demo explainer from: ${path}`);
      
      const response = await fetch(path);
      if (response.ok) {
        const content = await response.text();
        console.log(`Successfully loaded demo explainer`);
        return content;
      }
      
      console.error(`Failed to load demo explainer`);
      return '# Error loading demo information\n\nPlease try again later.';
    } catch (error) {
      console.error('Error loading demo explainer:', error);
      return '# Error loading demo information\n\nPlease try again later.';
    }
  };

  // Function to check password
  const checkPassword = (assistantId: string, password: string): boolean => {
    if (!demoConfig) return false;
    const assistant = demoConfig.assistants.find(a => a.id === assistantId);
    return assistant?.password === password;
  };

  // Function to unlock an assistant
  const unlockAssistant = (assistantId: string) => {
    setUnlockedAssistants(prev => new Set([...prev, assistantId]));
  };

  // Fetch the demo configuration and load explainer markdown
  useEffect(() => {
    const fetchDemoConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let config: DemoConfig | null = null;
        
        // First try to fetch from the API
        console.log(`Fetching demo config from API: ${demoId}`);
        const response = await fetch(`/api/demos/${demoId}`);
        
        if (response.ok) {
          config = await response.json();
          console.log(`Successfully fetched demo config from API: ${demoId}`);
          setDemoConfig(config);
        } else {
          // If not found in API, check static configs
          console.log(`Checking static configs for demo: ${demoId}`);
          if (demoConfigs[demoId]) {
            config = demoConfigs[demoId];
            setDemoConfig(config);
          } else {
            console.error(`Demo not found in API or static configs: ${demoId}`);
            setError('Demo not found');
          }
        }

        // If we have a config, load the explainer markdown
        if (config) {
          const content = await loadExplainerMarkdown(config.id);
          setMarkdownContent(content);
          
          // Auto-select the first non-password-protected assistant
          const firstAvailableAssistant = config.assistants.find(assistant => !assistant.hasPassword);
          if (firstAvailableAssistant) {
            setSelectedAssistant(firstAvailableAssistant);
          } else if (config.assistants.length > 0) {
            // If all assistants require passwords, select the first one anyway
            setSelectedAssistant(config.assistants[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching demo:', error);
        setError('An error occurred while loading the demo');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDemoConfig();
  }, [demoId]);

  const handleAssistantClick = (assistant: Assistant) => {
    if (assistant.hasPassword && !unlockedAssistants.has(assistant.id)) {
      setSelectedAssistant(assistant);
      setPasswordError(null);
    } else {
      setSelectedAssistant(assistant);
    }
  };

  // If demo is loading, show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading demo...</p>
        </div>
      </div>
    );
  }

  // If demo doesn't exist, show error
  if (error || !demoConfig) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error || 'Demo Not Found'}
          </h1>
          <Link
            href="/"
            className="text-blue-500 hover:text-blue-600 flex items-center justify-center gap-2"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const assistants = demoConfig.assistants;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <ArrowLeftIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </Link>
              <div className="flex items-center">
                {demoConfig.icon ? (
                  <DemoIcon icon={demoConfig.icon} name={demoConfig.title} size={32} />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full mr-2" />
                )}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {demoConfig.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">By {demoConfig.author}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Side - Chat Interface */}
        <div className="w-full md:w-1/2 flex flex-col">
          {/* Fixed Assistant Selection Header */}
          <div className="flex-none bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 sticky top-[72px] z-10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Assistants</h2>
            <div className="flex flex-wrap gap-2">
              {assistants.map((assistant) => {
                const isUnlocked = unlockedAssistants.has(assistant.id);
                const isSelected = selectedAssistant?.id === assistant.id;
                const isLocked = assistant.hasPassword && !isUnlocked;

                return (
                  <div
                    key={assistant.id}
                    className={`relative ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : isLocked
                        ? 'bg-gray-100 dark:bg-gray-800 opacity-70'
                        : 'bg-white dark:bg-gray-800'
                    } rounded-lg shadow-md p-3 cursor-pointer transition-all duration-200`}
                    onClick={() => !isLocked && handleAssistantClick(assistant)}
                  >
                    <div className="flex items-center">
                      {assistant.icon ? (
                        <DemoIcon key={`icon-${assistant.id}`} icon={assistant.icon} name={assistant.name} size={24} />
                      ) : (
                        <div key={`default-icon-${assistant.id}`} className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full mr-2" />
                      )}
                      <span className="text-lg mr-2">{assistant.name}</span>
                      {isLocked ? (
                        <LockClosedIcon key={`lock-${assistant.id}`} className="h-4 w-4 text-gray-500" />
                      ) : (
                        <LockOpenIcon key={`unlock-${assistant.id}`} className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {assistant.description}
                    </p>
                    {isLocked && (
                      <PasswordInput
                        assistantId={assistant.id}
                        onUnlock={unlockAssistant}
                        checkPassword={checkPassword}
                        onError={(error) => setPasswordError(error)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Chat Content */}
          <div className="flex-1">
            {selectedAssistant ? (
              <StreamingDemo 
                assistantId={selectedAssistant.id} 
                assistantName={selectedAssistant.name}
                demoId={demoConfig.id}
                assistantIcon={selectedAssistant.icon}
              />
            ) : (
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 m-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Select an assistant to start chatting
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Fixed Markdown Documentation */}
        <div className="hidden md:block fixed right-0 top-[72px] bottom-[60px] w-1/2 overflow-y-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          <div className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex, rehypeHighlight]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-xl font-medium mt-4 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="my-4 leading-relaxed" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside my-4 space-y-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside my-4 space-y-2" {...props} />,
                li: ({node, ...props}) => <li className="ml-4" {...props} />,
                code: ({className, children, ...props}: any) => {
                  const isInline = !className?.includes('language-');
                  return isInline ? (
                    <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>{children}</code>
                  ) : (
                    <code className="block bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto text-sm" {...props}>{children}</code>
                  );
                },
                pre: ({node, ...props}) => <pre className="bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic" {...props} />,
                a: ({node, ...props}) => <a className="text-blue-500 hover:text-blue-600 underline" {...props} />,
                table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600" {...props} /></div>,
                th: ({node, ...props}) => <th className="px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left" {...props} />,
                td: ({node, ...props}) => <td className="px-4 py-2 border-t border-gray-200 dark:border-gray-700" {...props} />,
                img: ({node, ...props}) => <img className="max-w-full h-auto rounded my-4" {...props} />
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2023 Noyes Demos. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <button className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                Help
              </button>
              <button className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                Settings
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 
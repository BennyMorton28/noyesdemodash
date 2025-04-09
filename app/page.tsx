'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import DemoIcon from './components/DemoIcon';
import CreateDemoModal from './components/CreateDemoModal';

// Add a confirmation modal component for deletion
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: ConfirmModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h2>
        <p className="mb-6 text-gray-700 dark:text-gray-300">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface Demo {
  id: string;
  title: string;
  author: string;
  icon?: string;  // Optional icon path
  assistants: {
    id: string;
    name: string;
    description: string;
    icon?: string;  // Optional icon path
    hasPassword: boolean;
  }[];
}

// Mock data for demos
const initialDemos: Demo[] = [
  {
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
        hasPassword: true
      }
    ]
  },
  {
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
  {
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
  {
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
        hasPassword: true
      }
    ]
  }
];

export default function Dashboard() {
  const [demos, setDemos] = useState<Demo[]>(initialDemos);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [demoToDelete, setDemoToDelete] = useState<Demo | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{message: string, isError: boolean} | null>(null);

  // Fetch demos when component mounts
  useEffect(() => {
    const fetchDemos = async () => {
      try {
        const response = await fetch('/api/demos');
        if (response.ok) {
          const dynamicDemos = await response.json();
          // Filter out any dynamic demos that have the same ID as static demos
          const newDynamicDemos = dynamicDemos.filter(
            (demo: Demo) => !initialDemos.some(staticDemo => staticDemo.id === demo.id)
          );
          setDemos([...initialDemos, ...newDynamicDemos]);
        }
      } catch (error) {
        console.error('Error fetching demos:', error);
        // Fallback to initial demos if fetch fails
        setDemos(initialDemos);
      }
    };

    fetchDemos();
  }, []);

  const handleCreateDemo = (newDemo: Demo) => {
    setDemos(prev => [...prev, newDemo]);
  };

  const handleDeleteClick = (e: React.MouseEvent, demo: Demo) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if it's a static demo
    const staticDemoIds = ['math-assistant', 'writing-assistant', 'language-assistant', 'coding-assistant'];
    if (staticDemoIds.includes(demo.id)) {
      setDeleteStatus({
        message: "Cannot delete built-in demos",
        isError: true
      });
      
      // Auto-hide the message after 3 seconds
      setTimeout(() => {
        setDeleteStatus(null);
      }, 3000);
      
      return;
    }
    
    setDemoToDelete(demo);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!demoToDelete) return;
    
    try {
      const response = await fetch(`/api/demos/${demoToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove the demo from the list
        setDemos(prev => prev.filter(demo => demo.id !== demoToDelete.id));
        setDeleteStatus({
          message: `"${demoToDelete.title}" has been deleted`,
          isError: false
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete demo');
      }
    } catch (error) {
      console.error('Error deleting demo:', error);
      setDeleteStatus({
        message: `Failed to delete demo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true
      });
    } finally {
      setIsDeleteModalOpen(false);
      setDemoToDelete(null);
      
      // Auto-hide the message after 3 seconds
      setTimeout(() => {
        setDeleteStatus(null);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Noyes Demos</h1>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Demo
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Welcome, User</span>
              <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Message */}
      {deleteStatus && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md shadow-md ${
          deleteStatus.isError 
            ? 'bg-red-100 text-red-700 border border-red-200' 
            : 'bg-green-100 text-green-700 border border-green-200'
        }`}>
          {deleteStatus.message}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <div key={demo.id} className="relative group">
              <Link
                href={`/demo/${demo.id}`}
                className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {demo.icon ? (
                      <DemoIcon icon={demo.icon} name={demo.title} size={32} />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {demo.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {demo.assistants.length} assistant{demo.assistants.length !== 1 ? 's' : ''} • By {demo.author}
                    </p>
                  </div>
                  <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
              
              {/* Delete Button - Shown on hover */}
              <button
                onClick={(e) => handleDeleteClick(e, demo)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white dark:bg-gray-700 shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50 dark:hover:bg-red-900"
                aria-label={`Delete ${demo.title}`}
              >
                <TrashIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Create Demo Modal */}
      <CreateDemoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateDemo}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDemoToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Demo"
        message={`Are you sure you want to delete "${demoToDelete?.title}"? This action cannot be undone and will remove all associated files.`}
      />
    </div>
  );
}

import { useState, useRef } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import DemoIcon from './DemoIcon';
import Modal from './Modal';

interface Assistant {
  id: string;
  name: string;
  description: string;
  icon?: string;
  hasPassword: boolean;
  password?: string;
  markdownFile?: File;
  iconFile?: File;
}

interface CreateDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (demo: any) => void;
}

export default function CreateDemoModal({ isOpen, onClose, onSave }: CreateDemoModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [explainerFile, setExplainerFile] = useState<File | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>([{
    id: 'assistant-1',
    name: '',
    description: '',
    hasPassword: false,
    markdownFile: undefined
  }]);
  const [markdownFiles, setMarkdownFiles] = useState<Record<string, File>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateAssistantId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
    }
  };

  const handleMarkdownChange = (assistantId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMarkdownFiles(prev => ({
        ...prev,
        [assistantId]: file
      }));
    }
  };

  const handleAssistantChange = (index: number, field: keyof Assistant, value: any) => {
    const newAssistants = [...assistants];
    newAssistants[index] = {
      ...newAssistants[index],
      [field]: value
    };
    
    // Update assistant ID when name changes
    if (field === 'name') {
      newAssistants[index].id = generateAssistantId(value);
    }
    
    setAssistants(newAssistants);
  };

  const handleAssistantIconChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store the file in the assistant object
      const newAssistants = [...assistants];
      newAssistants[index] = {
        ...newAssistants[index],
        iconFile: file
      };
      setAssistants(newAssistants);
    }
  };

  const handleMarkdownFileChange = (index: number, file: File | null) => {
    const newAssistants = [...assistants];
    newAssistants[index] = {
      ...newAssistants[index],
      markdownFile: file || undefined
    };
    setAssistants(newAssistants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Generate URL-friendly ID from title
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      // Create demo object
      const demo = {
        id,
        title,
        author,
        icon: iconFile ? `demos/${id}/icon.svg` : undefined,
        assistants: assistants.map(assistant => ({
          id: assistant.id,
          name: assistant.name,
          description: assistant.description,
          hasPassword: assistant.hasPassword,
          password: assistant.password,
          icon: assistant.iconFile ? `demos/${id}/assistants/${assistant.id}/icon.svg` : undefined
        }))
      };

      // Create FormData and append demo data
      const formData = new FormData();
      formData.append('demo', JSON.stringify(demo));
      
      // Append demo icon if selected
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      // Append demo explainer markdown
      if (explainerFile) {
        formData.append('explainer', explainerFile);
      } else {
        throw new Error('Demo explainer markdown is required');
      }
      
      // Append markdown files and icons for each assistant
      for (const assistant of assistants) {
        const markdownFile = assistant.markdownFile;
        if (markdownFile) {
          formData.append(`markdown_${assistant.id}`, markdownFile);
        } else {
          throw new Error(`Markdown file is required for assistant "${assistant.name}"`);
        }

        // Append assistant icon if provided
        if (assistant.iconFile) {
          formData.append(`icon_${assistant.id}`, assistant.iconFile);
        }
      }

      // Send to API
      const response = await fetch('/api/demos', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to create demo');
      }

      const result = await response.json();
      
      // Reset form and close modal
      setTitle('');
      setAuthor('');
      setIconFile(null);
      setExplainerFile(null);
      setAssistants([{
        id: 'assistant-1',
        name: '',
        description: '',
        hasPassword: false,
        markdownFile: undefined,
        iconFile: undefined
      }]);
      onClose();
      
      // Call the onSave callback with the new demo
      if (onSave) {
        onSave(result.demo);
      }
    } catch (error) {
      console.error('Error creating demo:', error);
      alert(error instanceof Error ? error.message : 'Failed to create demo. Please try again.');
    }
  };

  if (!isOpen) return null;

  // Common input class to maintain consistency
  const inputClass = "mt-2 px-4 py-3 block w-full bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white transition duration-150 ease-in-out";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const fileInputClass = "mt-2 block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-200 hover:file:bg-blue-100 dark:hover:file:bg-blue-800 focus:outline-none";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Create New Demo</h2>
        
        {/* Demo Title */}
        <div className="space-y-1">
          <label className={labelClass} htmlFor="demo-title">Demo Title</label>
          <input
            id="demo-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Enter a title for your demo"
            required
          />
        </div>

        {/* Author */}
        <div className="space-y-1">
          <label className={labelClass} htmlFor="demo-author">Author</label>
          <input
            id="demo-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputClass}
            placeholder="Your name"
            required
          />
        </div>

        {/* Demo Explainer Markdown */}
        <div className="space-y-1">
          <label className={labelClass} htmlFor="explainer-file">Demo Explainer (Markdown)</label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            This markdown file will be shown in the right panel of your demo and should explain how to use the demo and its assistants.
          </p>
          <input
            id="explainer-file"
            type="file"
            accept=".md,text/markdown"
            onChange={(e) => setExplainerFile(e.target.files?.[0] || null)}
            className={fileInputClass}
            required
            aria-label="Upload demo explainer markdown file"
          />
        </div>

        {/* Icon Upload */}
        <div className="space-y-1">
          <label className={labelClass} htmlFor="demo-icon">Demo Icon (SVG)</label>
          <input
            id="demo-icon"
            type="file"
            accept=".svg"
            onChange={(e) => setIconFile(e.target.files?.[0] || null)}
            className={fileInputClass}
            aria-label="Upload demo icon SVG file"
          />
        </div>

        {/* Assistant Fields */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-800 dark:text-white pt-2">Assistants</h3>
          {assistants.map((assistant, index) => (
            <div key={index} className="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="space-y-1">
                <label className={labelClass} htmlFor={`assistant-name-${index}`}>Assistant Name</label>
                <input
                  id={`assistant-name-${index}`}
                  type="text"
                  value={assistant.name}
                  onChange={(e) => handleAssistantChange(index, 'name', e.target.value)}
                  className={inputClass}
                  placeholder="Name of the assistant"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor={`assistant-desc-${index}`}>Description</label>
                <textarea
                  id={`assistant-desc-${index}`}
                  value={assistant.description}
                  onChange={(e) => handleAssistantChange(index, 'description', e.target.value)}
                  className={inputClass}
                  rows={3}
                  placeholder="Describe what this assistant does"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor={`assistant-icon-${index}`}>Assistant Icon (SVG)</label>
                <input
                  id={`assistant-icon-${index}`}
                  type="file"
                  accept=".svg"
                  onChange={(e) => handleAssistantIconChange(index, e)}
                  className={fileInputClass}
                  aria-label={`Upload icon for assistant ${assistant.name || index+1}`}
                />
              </div>
              
              <div className="space-y-1">
                <label className={labelClass} htmlFor={`markdown-file-${index}`}>Markdown Content</label>
                <input
                  id={`markdown-file-${index}`}
                  type="file"
                  accept=".md,text/markdown"
                  onChange={(e) => handleMarkdownFileChange(index, e.target.files?.[0] || null)}
                  className={fileInputClass}
                  required
                  aria-label={`Upload markdown content for assistant ${assistant.name || index+1}`}
                />
              </div>
              
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id={`password-${index}`}
                  checked={assistant.hasPassword}
                  onChange={(e) => handleAssistantChange(index, 'hasPassword', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  aria-label="Require password protection"
                />
                <label htmlFor={`password-${index}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Require Password
                </label>
              </div>
              
              {assistant.hasPassword && (
                <div className="space-y-1 mt-3">
                  <label className={labelClass} htmlFor={`assistant-password-${index}`}>Password</label>
                  <input
                    id={`assistant-password-${index}`}
                    type="password"
                    value={assistant.password || ''}
                    onChange={(e) => handleAssistantChange(index, 'password', e.target.value)}
                    className={inputClass}
                    placeholder="Enter password"
                    required={assistant.hasPassword}
                  />
                </div>
              )}
              
              {assistants.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newAssistants = [...assistants];
                    newAssistants.splice(index, 1);
                    setAssistants(newAssistants);
                  }}
                  className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
                >
                  <TrashIcon className="h-4 w-4 mr-1" /> Remove Assistant
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={() => setAssistants([...assistants, {
              id: `assistant-${assistants.length + 1}`,
              name: '',
              description: '',
              hasPassword: false
            }])}
            className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            <PlusIcon className="h-4 w-4 mr-1" /> Add Assistant
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Create Demo
          </button>
        </div>
      </form>
    </Modal>
  );
} 
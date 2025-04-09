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

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-bold">Create New Demo</h2>
        
        {/* Demo Title */}
        <div>
          <label className="block text-sm font-medium">Demo Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {/* Author */}
        <div>
          <label className="block text-sm font-medium">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {/* Demo Explainer Markdown */}
        <div>
          <label className="block text-sm font-medium">Demo Explainer (Markdown)</label>
          <p className="text-sm text-gray-500 mb-2">
            This markdown file will be shown in the right panel of your demo and should explain how to use the demo and its assistants.
          </p>
          <input
            type="file"
            accept=".md,text/markdown"
            onChange={(e) => setExplainerFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        {/* Icon Upload */}
        <div>
          <label className="block text-sm font-medium">Demo Icon (SVG)</label>
          <input
            type="file"
            accept=".svg"
            onChange={(e) => setIconFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Assistant Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Assistants</h3>
          {assistants.map((assistant, index) => (
            <div key={index} className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium">Assistant Name</label>
                <input
                  type="text"
                  value={assistant.name}
                  onChange={(e) => handleAssistantChange(index, 'name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={assistant.description}
                  onChange={(e) => handleAssistantChange(index, 'description', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Assistant Icon (SVG)</label>
                <input
                  type="file"
                  accept=".svg"
                  onChange={(e) => handleAssistantIconChange(index, e)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {assistant.iconFile && (
                  <p className="mt-1 text-sm text-green-600">
                    Icon selected: {assistant.iconFile.name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Instructions (Markdown)</label>
                <p className="text-sm text-gray-500 mb-2">
                  This markdown file contains the instructions for how this assistant should behave.
                </p>
                <input
                  type="file"
                  accept=".md,text/markdown"
                  onChange={(e) => handleMarkdownFileChange(index, e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={assistant.hasPassword}
                    onChange={(e) => handleAssistantChange(index, 'hasPassword', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm">Password Protected</label>
                </div>
                {assistant.hasPassword && (
                  <div className="flex-1">
                    <input
                      type="password"
                      value={assistant.password || ''}
                      onChange={(e) => handleAssistantChange(index, 'password', e.target.value)}
                      placeholder="Enter password"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}
              </div>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const newAssistants = assistants.filter((_, i) => i !== index);
                    setAssistants(newAssistants);
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove Assistant
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
            className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Assistant
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Demo
          </button>
        </div>
      </form>
    </Modal>
  );
} 
export interface Assistant {
  id: string;
  name: string;
  iconPath?: string;
  password?: string;
  isAvailableAtStart: boolean;
  promptMarkdownPath: string;
  orderIndex: number;
  displayWhenLocked: {
    description?: string;
    previewImage?: string;
  }
}

export interface Demo {
  id: string;
  name: string;
  iconPath?: string;
  password?: string;
  explanationMarkdownPath: string;
  assistants: Assistant[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: number;
  sender: 'user' | string; // string will be assistant ID
  assistantId?: string;
}

export interface DemoSession {
  demoId: string;
  unlockedAssistantIds: string[];
  chatHistory: ChatMessage[];
  activeAssistantId?: string;
} 
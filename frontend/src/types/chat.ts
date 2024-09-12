export interface Step {
  step: string;
  explanation: string;
}

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  steps?: Step[];
  strategy?: string;
}

export interface Conversation {
  id: number;
  title: string;
  date: string;
  messages: Message[];
}

export interface ChatInterfaceProps {
  conversation: Conversation | null;
  setConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  updateConversation: (conversation: Conversation) => void;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export interface QueuedStep {
  step: string;
  explanation: string;
}
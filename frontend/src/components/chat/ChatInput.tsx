import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Mic, Image as ImageIcon } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSendMessage: () => void;
  isProcessing: boolean;
}

export function ChatInput({ input, setInput, handleSendMessage, isProcessing }: ChatInputProps) {
  return (
    <div className="p-4 border-t">
      <div className="flex items-center">
        <Input
          className="flex-1"
          placeholder="Write a message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <Button variant="ghost" className="ml-2" onClick={handleSendMessage} disabled={isProcessing}>
          <Send className="w-5 h-5" />
        </Button>
        <Button variant="ghost" className="ml-2">
          <Mic className="w-5 h-5" />
        </Button>
        <Button variant="ghost" className="ml-2">
          <ImageIcon className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
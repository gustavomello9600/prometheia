import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Message } from '@/types/chat';
import { MessageCard } from '@/components/chat/MessageCard';

interface ChatMessagesProps {
  messages: Message[];
  expandedSteps: { [key: string]: boolean };
  toggleSteps: (messageId: string) => void;
  expandedExplanations: { [key: string]: boolean };
  toggleExplanation: (messageId: string, stepIndex: number) => void;
  activeMessageSteps: { [key: string]: number[] };
  initialRevealComplete: { [key: string]: boolean };
  messagesEndRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}

export function ChatMessages({
  messages,
  expandedSteps,
  toggleSteps,
  expandedExplanations,
  toggleExplanation,
  activeMessageSteps,
  initialRevealComplete,
  messagesEndRef,
  children
}: ChatMessagesProps) {
  return (
    <ScrollArea className="flex-1 h-full overflow-y-auto">
      <div className="space-y-4 p-4">
        {messages.map((message, index) => (
          <React.Fragment key={index}>
            <MessageCard
              message={message}
              expandedSteps={expandedSteps}
              toggleSteps={toggleSteps}
              expandedExplanations={expandedExplanations}
              toggleExplanation={toggleExplanation}
              activeMessageSteps={activeMessageSteps}
              initialRevealComplete={initialRevealComplete}
            />
          </React.Fragment>
        ))}
        {children}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
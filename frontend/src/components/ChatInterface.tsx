"use client";

import React from 'react';
import { useChat } from '@/hooks/useChat';
import { useThinking } from '@/hooks/useThinking';
import { useMobile } from '@/hooks/useMobile';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import { ChatInterfaceProps } from '@/types/chat';

const STEP_DISPLAY_TIME = 5000;

export default function ChatInterface({
  conversation,
  setConversation,
  updateConversation,
  toggleSidebar,
  isSidebarOpen
}: ChatInterfaceProps) {
  const {
    messages,
    input,
    setInput,
    handleSendMessage,
    isProcessing,
    expandedSteps,
    toggleSteps,
    expandedExplanations,
    toggleExplanation,
    activeMessageSteps,
    initialRevealComplete,
    isLastAIMessage,
    messagesEndRef
  } = useChat(conversation, setConversation, updateConversation, STEP_DISPLAY_TIME);

  const {
    isThinkingVisible,
    isThinkingTimeoutComplete,
    currentStep,
    currentExplanation
  } = useThinking(STEP_DISPLAY_TIME);

  const { isMobile } = useMobile();

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Select a conversation or start a new chat</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${isMobile && isSidebarOpen ? 'hidden' : 'block'}`}>
      <ChatHeader
        conversation={conversation}
        updateConversation={updateConversation}
        toggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />

      <ChatMessages
        messages={messages}
        isLastAIMessage={isLastAIMessage}
        messagesEndRef={messagesEndRef}
        expandedSteps={expandedSteps}
        toggleSteps={toggleSteps}
        expandedExplanations={expandedExplanations}
        toggleExplanation={toggleExplanation}
        activeMessageSteps={activeMessageSteps}
        initialRevealComplete={initialRevealComplete}
        isThinkingTimeoutComplete={isThinkingTimeoutComplete}
      >
        <ThinkingIndicator
          isVisible={isThinkingVisible}
          currentStep={currentStep}
          currentExplanation={currentExplanation}
        />
      </ChatMessages>

      <ChatInput
        input={input}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
        isProcessing={isProcessing}
      />
    </div>
  );
}

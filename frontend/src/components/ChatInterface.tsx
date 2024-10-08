"use client";

import React, { useState, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { useMobile } from '@/hooks/useMobile';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatInterfaceProps } from '@/types/chat';

const STEP_DISPLAY_TIME = 1000;

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
    expandedSteps,
    toggleSteps,
    expandedExplanations,
    toggleExplanation,
    activeMessageSteps,
    initialRevealComplete,
    messagesEndRef,
    isProcessing
  } = useChat(conversation, setConversation, updateConversation, STEP_DISPLAY_TIME);

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

      <div className="flex-1 overflow-hidden relative">
        <ChatMessages
          messages={messages}
          messagesEndRef={messagesEndRef}
          expandedSteps={expandedSteps}
          toggleSteps={toggleSteps}
          expandedExplanations={expandedExplanations}
          toggleExplanation={toggleExplanation}
          activeMessageSteps={activeMessageSteps}
          initialRevealComplete={initialRevealComplete}
        />
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
        isProcessing={isProcessing}
      />
    </div>
  );
}

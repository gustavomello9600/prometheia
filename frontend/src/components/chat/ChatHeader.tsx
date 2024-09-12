import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Menu } from 'lucide-react';
import { Conversation } from '@/types/chat';
import { updateConversationTitle } from '@/lib/api';

interface ChatHeaderProps {
  conversation: Conversation;
  updateConversation: (conversation: Conversation) => void;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function ChatHeader({ conversation, updateConversation, toggleSidebar, isSidebarOpen }: ChatHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation.title);

  const handleTitleUpdate = async () => {
    if (conversation && editedTitle !== conversation.title) {
      try {
        await updateConversationTitle(conversation.id, editedTitle);
        updateConversation({ ...conversation, title: editedTitle });
      } catch (error) {
        console.error('Error updating conversation title:', error);
      }
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex items-center p-4 border-b">
      <Button variant="ghost" className="mr-2" onClick={toggleSidebar}>
        {isSidebarOpen ? <ArrowLeft className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </Button>
      <Avatar className="w-10 h-10">
        <AvatarImage src="/placeholder.svg?height=40&width=40" alt="AI Avatar" />
        <AvatarFallback>iΛ.</AvatarFallback>
      </Avatar>
      <div className="ml-3 flex-1 min-w-0">
        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleUpdate}
            onKeyPress={(e) => e.key === 'Enter' && handleTitleUpdate()}
            className="bg-transparent border-b focus:outline-none text-xl font-bold w-full"
            autoFocus
          />
        ) : (
          <h2 className="text-xl font-bold cursor-pointer truncate" onClick={() => setIsEditingTitle(true)}>
            {conversation.title || 'New Conversation'}
          </h2>
        )}
      </div>
    </div>
  );
}
"use client";

import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Plus, Search, Settings, LogOut, Trash2 } from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import { useSession, signOut } from 'next-auth/react';
import * as api from '@/lib/api';
import axios from 'axios';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { format } from 'date-fns';

interface Conversation {
  id: number;
  title: string;
  date: string;
  messages: Message[];
}

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768); // Adjust this breakpoint as needed
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: session, status, update } = useSession();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [isFetched, setIsFetched] = useState(false);

  const { toast } = useToast();

  // Debugging: Log session and status
  useEffect(() => {
    console.log("Session:", session);
    console.log("Status:", status);
  }, [session, status]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user?.id) {
        try {
          const userData = await api.getUserById(session.user.id);
          if (userData.success && userData.user.name) {
            setCurrentName(userData.user.name);
            setNewName(userData.user.name);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setIsFetched(true);
        }
      }
    };

    if (status === 'authenticated' && session?.user?.id) {
      fetchUserData();
    }
  }, [status, session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      fetchUserConversations();
    }
  }, [status, session]);

  const fetchUserConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token might be expired, try to refresh
        await update();
      }
    }
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(true);
      setActiveConversation(null);
    } else {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  const createNewConversation = async () => {
    try {
      const newConversation = {
        title: `New Conversation ${conversations.length + 1}`,
        date: new Date().toISOString(),
      };

      const savedConversation = await api.createConversation(newConversation.title, newConversation.date);
      setConversations([savedConversation, ...conversations]);
      setActiveConversation(savedConversation);
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  };

  const openChat = (conversation: Conversation) => {
    setActiveConversation(conversation);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const updateConversation = (updatedConversation: Conversation) => {
    setActiveConversation(updatedConversation);
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  };

  const userInitials = currentName
    ? currentName.split(' ').map(n => n[0]).join('').toUpperCase()
    : '??';

  const handleNameEdit = async () => {
    if (isEditingName) {
      try {
        await api.updateUserName(newName);
        setCurrentName(newName);
        setIsEditingName(false);
        await update();
      } catch (error) {
        console.error('Error updating name:', error);
        setNewName(currentName);
      }
    } else {
      setIsEditingName(true);
    }
  };

  const deleteConversation = async (conversationId: number) => {
    try {
      await api.deleteConversation(conversationId);
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
      }
      toast({
        title: "Conversation deleted",
        description: "The conversation has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete the conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (activeConversation) {
      const updatedActiveConversation = conversations.find(conv => conv.id === activeConversation.id);
      if (updatedActiveConversation) {
        setActiveConversation(updatedActiveConversation);
      }
    }
  }, [conversations]);

  const sortConversations = (convs: Conversation[]) => {
    return [...convs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside 
        className={`${
          isMobile 
            ? (isSidebarOpen ? 'w-full' : 'w-0') 
            : (isSidebarOpen ? 'w-72' : 'w-0')
        } transition-all duration-300 ease-in-out overflow-hidden fixed md:relative h-full`}
      >
        <div className={`flex flex-col h-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'opacity-100 p-4' : 'opacity-0 p-0'}`}>
          <div className="flex items-center justify-between mb-6">
            <Link href="/landing" className="text-xl font-bold">
              Promethe<span className="text-accent-foreground">iΛ</span>.
            </Link>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-grow flex flex-col overflow-hidden">
            <div className="flex justify-center mb-4">
              <Button className="w-full" variant="ghost" onClick={createNewConversation}>
                <Plus className="mr-2 h-4 w-4" /> New Chat
              </Button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
              <Input 
                type="search" 
                placeholder="Search conversations" 
                className="pl-10 w-full"
              />
            </div>
            <ScrollArea className="flex-grow relative">
              <nav>
                <ul className="space-y-1">
                  {sortConversations(conversations).map((conv) => {
                    const isActive = activeConversation?.id === conv.id;
                    return (
                      <li key={conv.id} className="relative group">
                        <button 
                          onClick={() => openChat(conv)}
                          className={`w-full flex items-center p-2 rounded-md transition-colors ${
                            isActive 
                              ? 'bg-primary/10 text-primary' 
                              : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          <MessageSquare className={`mr-2 h-4 w-4 flex-shrink-0 ${
                            isActive ? 'text-primary' : ''
                          }`} />
                          <div className="flex-1 min-w-0 text-left pr-8">
                            <span className={`block truncate text-sm max-w-[182px] ${
                              isActive ? 'font-semibold' : ''
                            }`}>{conv.title}</span>
                            <span className={`block truncate text-xs ${
                              isActive ? 'text-primary/70' : 'text-muted-foreground'
                            }`}>{format(new Date(conv.date), 'PPpp')}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-8 w-4 accent-foreground"/>
                          </button>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </ScrollArea>
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center mb-4">
              <Avatar className="w-10 h-10 mr-3">
                <AvatarFallback>
                  {isFetched && currentName
                    ? currentName.split(' ').filter((_, i, arr) => i === 0 || i === arr.length - 1).map(n => n[0]).join('').toUpperCase()
                    : ''}
                </AvatarFallback>
              </Avatar>
              <div>
                {isEditingName ? (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleNameEdit}
                    onKeyPress={(e) => e.key === 'Enter' && handleNameEdit()}
                  />
                ) : (
                  <p className="font-medium cursor-pointer" onClick={() => setIsEditingName(true)}>
                    {isFetched ? currentName || 'Unknown User' : ''}
                  </p>
                )}
                <p className="text-sm text-muted-foreground truncate w-full max-w-[150px]">
                  {session?.user?.email || ''}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full border-muted-foreground hover:border-foreground"
              onClick={() => signOut({ callbackUrl: '/landing' })}
            >
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col ${isMobile && isSidebarOpen ? 'hidden' : 'block'} w-full`}>
        <ChatInterface 
          conversation={activeConversation} 
          setConversation={setActiveConversation}
          updateConversation={updateConversation}
          toggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      </main>
    </div>
  );
}

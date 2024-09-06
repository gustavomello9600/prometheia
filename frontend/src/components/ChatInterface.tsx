"use client";

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, Mic, Image as ImageIcon, ArrowLeft, Menu, ChevronDown, ChevronUp } from 'lucide-react';
import { createMessage, getMessages, getLLMResponse, updateConversationTitle } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Step {
  step: string;
  explanation: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  steps?: Step[];
}

interface Conversation {
  id: number;
  title: string;
  date: string;
  messages: Message[];
}

interface ChatInterfaceProps {
  conversation: Conversation | null;
  setConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  updateConversation: (conversation: Conversation) => void;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const inflateAnimation = keyframes`
  from { transform: scale(0); }
  to { transform: scale(1); }
`;

const textRevealAnimation = keyframes`
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
`;

const extendLineAnimation = keyframes`
  from { height: 0; }
  to { height: 100%; }
`;

const fadeInAnimation = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const StepTimeline = styled.ul`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0.5rem;
  gap: 0.5rem;
`;

const Step = styled.li<{ isActive: boolean; delay: number }>`
  display: flex;
  align-items: flex-start;
  opacity: 0;
  animation: ${fadeInAnimation} 0.5s ease-in forwards;
  animation-delay: ${props => props.delay}ms;
  position: relative;
  padding-left: 1rem;
`;

const StepText = styled.span<{ isActive: boolean; delay: number }>`
  font-size: 0.875rem;
  color: var(--primary-foreground);
  position: relative;
  display: inline-block;
  clip-path: inset(0 100% 0 0);
  animation: ${textRevealAnimation} 0.5s ease-in forwards;
  animation-delay: ${props => props.delay + 250}ms;
`;

const Bullet = styled.div<{ isActive: boolean; delay: number }>`
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background-color: hsl(var(--primary));
  margin-right: 0.5rem;
  transform: scale(0);
  animation: ${inflateAnimation} 0.5s ease-out forwards;
  animation-delay: ${props => props.delay + 500}ms;
  position: relative;
  z-index: 1;
  margin-top: 0.45rem;
`;

const Line = styled.div<{ isActive: boolean; delay: number }>`
  position: absolute;
  left: 1.23rem;
  top: 1rem;
  bottom: 0;
  width: 0.1rem;
  background-color: hsl(var(--primary));
  transform-origin: top;
  height: 0;
  animation: ${extendLineAnimation} 0.5s ease-out forwards;
  animation-delay: ${props => props.delay + 750}ms;
`;

const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding-top: 0.1rem;
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const StepExplanation = styled.p<{ delay: number; isInitialReveal: boolean }>`
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
  opacity: 0;
  animation: ${fadeInAnimation} 0.5s ease-in forwards;
  animation-delay: ${props => props.isInitialReveal ? props.delay + 1000 : 0}ms;
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: hsl(var(--secondary));
  border-radius: 20px;
  width: fit-content;
`;

const Logo = styled.span`
  font-weight: bold;
  font-size: 14px;
  margin-right: 8px;
`;

const Dot = styled.span`
  width: 6px;
  height: 6px;
  background: hsl(var(--primary));
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.3s linear infinite;

  &:nth-child(2) {
    animation-delay: -1.1s;
  }

  &:nth-child(3) {
    animation-delay: -0.9s;
  }

  @keyframes bounce {
    0%, 60%, 100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-3px);
    }
  }
`;

export default function ChatInterface({ conversation, setConversation, updateConversation, toggleSidebar, isSidebarOpen }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation?.title || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({});
  const [activeMessageSteps, setActiveMessageSteps] = useState<{ [key: string]: number[] }>({});
  const [isMobile, setIsMobile] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState<{ [key: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialRevealComplete, setInitialRevealComplete] = useState<{ [key: string]: boolean }>({});
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768); // Adjust this breakpoint as needed
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  useEffect(() => {
    if (conversation) {
      const fetchMessages = async () => {
        try {
          const fetchedMessages = await getMessages(conversation.id);
          setMessages(fetchedMessages);
          const initialExpandedSteps = fetchedMessages.reduce((acc, msg, index) => {
            if (msg.steps) {
              acc[index] = false;
            }
            return acc;
          }, {});
          setExpandedSteps(initialExpandedSteps);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      fetchMessages();
      setEditedTitle(conversation.title);
    }
  }, [conversation]);
  
  const handleSendMessage = async () => {
    if (input.trim() === '' || !conversation) return;

    const userMessage: Message = { id: Date.now().toString(), type: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsWaitingForResponse(true);

    try {
      await createMessage(conversation.id, userMessage);

      // Prepare the conversation history with distinctive markers
      const conversationHistory = updatedMessages.map(msg => 
        `###${msg.type.toUpperCase()}###\n${msg.content}\n###END###`
      ).join('\n');
      
      // Send the entire conversation history to the LLM along with the conversation ID
      const llmResponse = await getLLMResponse(conversationHistory, conversation.id);
      const aiMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: llmResponse.message,
        steps: llmResponse.steps,
      };
      await createMessage(conversation.id, aiMessage);

      setMessages(prevMessages => [...prevMessages, aiMessage]);
      updateConversation({
        ...conversation,
        messages: [...conversation.messages, userMessage, aiMessage],
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsWaitingForResponse(false);
    }
  };

  const toggleSteps = (messageId: string) => {
    setExpandedSteps(prev => {
      const newExpandedState = !prev[messageId];
      
      // If we're hiding the steps, reset the initialRevealComplete state for this message
      if (!newExpandedState) {
        setInitialRevealComplete(prevRevealState => ({
          ...prevRevealState,
          [messageId]: false
        }));
        
        // Also reset the activeMessageSteps for this message
        setActiveMessageSteps(prevActiveSteps => ({
          ...prevActiveSteps,
          [messageId]: []
        }));
        
        // Reset expanded explanations for this message
        setExpandedExplanations(prevExpandedExplanations => {
          const newExpandedExplanations = { ...prevExpandedExplanations };
          Object.keys(newExpandedExplanations).forEach(key => {
            if (key.startsWith(`${messageId}-`)) {
              delete newExpandedExplanations[key];
            }
          });
          return newExpandedExplanations;
        });
      }
      
      return {
        ...prev,
        [messageId]: newExpandedState
      };
    });

    // If we're expanding the steps and they weren't expanded before, start the animation
    if (!expandedSteps[messageId]) {
      animateSteps(messageId);
    }
  };

  const animateSteps = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message?.steps) {
      message.steps.forEach((step, index) => {
        setTimeout(() => {
          setActiveMessageSteps(prev => ({
            ...prev,
            [messageId]: [...(prev[messageId] || []), index],
          }));
          if (index === message.steps.length - 1) {
            setInitialRevealComplete(prev => ({
              ...prev,
              [messageId]: true
            }));
          }
        }, index * 500);
      });
    }
  };

  const toggleExplanation = (messageId: string, stepIndex: number) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [`${messageId}-${stepIndex}`]: !prev[`${messageId}-${stepIndex}`]
    }));
  };

  const customRenderers = {
    h1: ({node, ...props}) => <h1 style={{fontSize: '2rem', margin: '20px 0', lineHeight: '1.2'}} {...props} />,
    h2: ({node, ...props}) => <h2 style={{fontSize: '1.5rem', margin: '18px 0', lineHeight: '1.3'}} {...props} />,
    h3: ({node, ...props}) => <h3 style={{fontSize: '1.375rem', margin: '16px 0', lineHeight: '1.3', fontWeight: 'bold'}} {...props} />,
    h4: ({node, ...props}) => <h4 style={{fontSize: '1.125rem', margin: '14px 0', lineHeight: '1.3', fontWeight: 'bold'}} {...props} />,
    h5: ({node, ...props}) => <h5 style={{fontSize: '1rem', margin: '12px 0', lineHeight: '1.4', fontWeight: 'bold'}} {...props} />,
    h6: ({node, ...props}) => <h6 style={{fontSize: '0.875rem', margin: '10px 0', lineHeight: '1.4'}} {...props} />,
    code: ({node, inline, className, children, ...props}) => {
      const match = /language-(\w+)/.exec(className || '')
      return !inline ? (
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      )
    },
    ul: ({node, ...props}) => (
      <ul style={{
        paddingLeft: '1.5rem',
        marginBottom: '1rem',
        listStyleType: 'disc'
      }} {...props} />
    ),
    li: ({node, ...props}) => (
      <li style={{
        marginBottom: '0.5rem'
      }} {...props} />
    ),
    ol: ({node, ...props}) => (
      <ol style={{
        paddingLeft: '1.5rem',
        marginBottom: '1rem',
        listStyleType: 'decimal'
      }} {...props} />
    ),
    p: ({node, ...props}) => <p style={{marginBottom: '1rem'}} {...props} />
  };
  

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Select a conversation or start a new chat</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${isMobile && isSidebarOpen ? 'hidden' : 'block'}`}>
      {/* Header */}
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
              {conversation?.title || 'New Conversation'}
            </h2>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-[70%] p-3 bg-secondary text-secondary-foreground`}>
                {message.type === 'user' ? (
                  <p className="text-base">{message.content}</p>
                ) : (
                  <ReactMarkdown 
                    className="text-base prose dark:prose-invert max-w-none"
                    components={customRenderers}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.type === 'ai' && message.steps && message.steps.length > 0 && (
                  <>
                    <button onClick={() => toggleSteps(message.id)} className="mt-2 text-sm underline focus:outline-none">
                      {expandedSteps[message.id] ? 'Hide steps' : 'Show steps'}
                    </button>
                    {expandedSteps[message.id] && (
                      <StepTimeline>
                        {message.steps.map((step, stepIndex) => {
                          const isActive = activeMessageSteps[message.id]?.includes(stepIndex);
                          const delay = stepIndex * 500;
                          return (
                            <Step key={stepIndex} isActive={isActive} delay={delay}>
                              <Bullet isActive={isActive} delay={delay} />
                              {stepIndex < message.steps.length - 1 && <Line isActive={isActive} delay={delay} />}
                              <StepContent>
                                <StepHeader onClick={() => toggleExplanation(message.id, stepIndex)}>
                                  <StepText isActive={isActive} delay={delay}>{step.step}</StepText>
                                  {expandedExplanations[`${message.id}-${stepIndex}`] ? (
                                    <ChevronUp size={16} />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </StepHeader>
                                {expandedExplanations[`${message.id}-${stepIndex}`] && (
                                  <StepExplanation 
                                    delay={delay} 
                                    isInitialReveal={!initialRevealComplete[message.id]}
                                  >
                                    {step.explanation}
                                  </StepExplanation>
                                )}
                              </StepContent>
                            </Step>
                          );
                        })}
                      </StepTimeline>
                    )}
                  </>
                )}
              </Card>
            </div>
          ))}
          {isWaitingForResponse && (
            <div className="flex justify-start">
              <TypingIndicator>
                <Logo className="text-accent-foreground">iΛ</Logo>
                <Dot />
                <Dot />
                <Dot />
              </TypingIndicator>
            </div>
          )}
          <div ref={messagesEndRef} /> {/* This empty div is our scroll anchor */}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex items-center">
          <Input
            className="flex-1"
            placeholder="Write a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button variant="ghost" className="ml-2" onClick={handleSendMessage}>
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
    </div>
  );
}

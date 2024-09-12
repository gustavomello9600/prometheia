"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, Mic, Image as ImageIcon, ArrowLeft, Menu, ChevronDown, ChevronUp } from 'lucide-react';
import { createMessage, getMessages, getLLMResponseStream, updateConversationTitle } from '@/lib/api';
import ReactMarkdown, { Components } from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const STEP_DISPLAY_TIME = 5000;

interface Step {
  step: string;
  explanation: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  steps?: Step[];
  strategy?: string;
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

const extendLineAnimation = keyframes`
  from { height: 0; }
  to { height: 100%; }
`;

const fadeOutAnimation = keyframes`
  from { opacity: 1; max-height: 200px; margin-bottom: 1rem; }
  to { opacity: 0; max-height: 0; margin-bottom: 0; }
`;

const fadeInAnimation = keyframes`
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 200px; }
`;

const FadingWrapper = styled.div<{ isVisible: boolean }>`
  opacity: ${props => props.isVisible ? 1 : 0};
  max-height: ${props => props.isVisible ? '200px' : '0'};
  margin-bottom: ${props => props.isVisible ? '1rem' : '0'};
  transition: opacity 1s ease-out, max-height 1s ease-out, margin-bottom 1s ease-out;
  overflow: hidden;
`;

const stepRevealAnimation = keyframes`
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
`;

const RevealingText = styled.span<{ animationKey: string | number }>`
  display: inline-block;
  animation: ${stepRevealAnimation} 0.5s ease-in-out forwards;
  animation-play-state: ${props => props.animationKey ? 'running' : 'paused'};
`;

const LogoAnimation = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const AnimatedLogo = styled.span`
  font-weight: bold;
  font-size: 24px;
  animation: ${LogoAnimation} 2s infinite;
  display: inline-block;
  min-width: 30px;
  text-align: center;
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
  animation: ${stepRevealAnimation} 0.75s ease-in-out forwards;
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

const StepExplanation = styled.p<{ isVisible: boolean; delay: number }>`
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
  opacity: ${props => props.isVisible ? 1 : 0};
  max-height: ${props => props.isVisible ? '200px' : '0'};
  transition: opacity 0.3s ease-in-out, max-height 0.3s ease-in-out;
  overflow: hidden;

  ${props => props.isVisible && css`
    animation: ${fadeInAnimation} 0.3s ease-in-out forwards;
  `}
`;

interface QueuedStep {
  step: string;
  explanation: string;
}

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
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<string>('');
  const [currentExplanation, setCurrentExplanation] = useState<string>('');
  const [isMessageComplete, setIsMessageComplete] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);
  const stepQueueRef = useRef<QueuedStep[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isThinkingTimeoutComplete, setIsThinkingTimeoutComplete] = useState(true);
  const [isThinkingVisible, setIsThinkingVisible] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
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
          const initialExpandedSteps = fetchedMessages.reduce((acc: {[key: string]: boolean}, msg: Message, index: number) => {
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
  
  const processStepQueue = useCallback(() => {
    if (stepQueueRef.current.length === 0) {
      return;
    }
  
    const step = stepQueueRef.current.shift()!;
    setCurrentStep(step.step);
    setCurrentExplanation(step.explanation);
  
    // Schedule the next step processing
    processingTimeoutRef.current = setTimeout(() => {
      if (stepQueueRef.current.length > 0) {
        processStepQueue();
      }
    }, STEP_DISPLAY_TIME);
  }, []);

  const queueStep = useCallback((step: QueuedStep) => {
    stepQueueRef.current.push(step);
    if (stepQueueRef.current.length === 1 && !processingTimeoutRef.current) {
      processStepQueue();
    }
  }, [processStepQueue]);

  const startThinking = useCallback(() => {
    setIsThinkingTimeoutComplete(false);
    setCurrentStep('');
    setCurrentExplanation('');
    stepQueueRef.current = [];
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    setIsThinkingVisible(true);
    processStepQueue();
  }, [processStepQueue]);

  const stopThinking = useCallback(() => {
    const processRemainingSteps = () => {
      if (stepQueueRef.current.length > 0) {
        processStepQueue();
        setTimeout(processRemainingSteps, STEP_DISPLAY_TIME);
      } else {
        // Queue is empty, start fading out
        setIsThinkingVisible(false);
        // Wait for fade-out transition before completing
        setTimeout(() => {
          setIsThinkingTimeoutComplete(true);
          setCurrentStep('');
          setCurrentExplanation('');
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
          }
        }, 1000); // Match this with the transition duration in FadingContent
      }
    };

    // Start processing remaining steps
    processRemainingSteps();
  }, [processStepQueue]);

  const isLastAIMessage = useCallback((messageId: string) => {
    const aiMessages = messages.filter(m => m.type === 'ai');
    return aiMessages.length > 0 && aiMessages[aiMessages.length - 1].id === messageId;
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '' || !conversation || isProcessing) return;
  
    setIsProcessing(true);
    setIsMessageComplete(false);
    setIsThinkingTimeoutComplete(false);
    setIsThinkingVisible(true);
    setCurrentStep('');
    setCurrentExplanation('');
    stepQueueRef.current = [];
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    startThinking();
  
    const userMessage: Message = { id: Date.now().toString(), type: 'user', content: input };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
  
    const aiMessage: Message = { id: (Date.now() + 1).toString(), type: 'ai', content: '', steps: [] };
    setProcessingMessageId(aiMessage.id);
  
    let accumulatedContent = '';
    let accumulatedSteps: Step[] = [];
    let accumulatedStrategy = '';
    let isStreamComplete = false;
  
    try {
      await createMessage(conversation.id, userMessage);
  
      setMessages(prevMessages => [...prevMessages, aiMessage]);
  
      const conversationHistory = [...messages, userMessage].map(msg => 
        `###${msg.type.toUpperCase()}###\n${msg.content}\n###END###`
      ).join('\n');
  
      const streamHandler = await getLLMResponseStream(conversationHistory, conversation.id);
  
      const closeStream = streamHandler((chunk) => {
        if (isStreamComplete) return;
  
        if (chunk.type === 'content') {
          accumulatedContent += chunk.data;
          
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessage.id);
            if (aiMessageIndex !== -1) {
              updatedMessages[aiMessageIndex] = {
                ...updatedMessages[aiMessageIndex],
                content: accumulatedContent,
              };
            }
            return updatedMessages;
          });
  
        } else if (chunk.type === 'steps') {
          const newStep = chunk.data;
          accumulatedSteps.push(newStep);
          
          queueStep(newStep);
          
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessage.id);
            if (aiMessageIndex !== -1) {
              updatedMessages[aiMessageIndex] = {
                ...updatedMessages[aiMessageIndex],
                steps: accumulatedSteps,
              };
            }
            return updatedMessages;
          });
  
        } else if (chunk.type === 'strategy') {
          accumulatedStrategy = chunk.data;
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessage.id);
            if (aiMessageIndex !== -1) {
              updatedMessages[aiMessageIndex] = {
                ...updatedMessages[aiMessageIndex],
                strategy: accumulatedStrategy,
              };
            }
            return updatedMessages;
          });
        } else if (chunk.type === 'error') {
          console.error('Error from server:', chunk.data);
          toast({
            title: "Error",
            description: chunk.data,
            variant: "destructive",
          });
        } else if (chunk.type === 'end') {
          isStreamComplete = true;
          stopThinking();
          saveAIMessage({
            ...aiMessage,
            content: accumulatedContent,
            steps: accumulatedSteps,
            strategy: accumulatedStrategy,
          });
        }
      });

    } catch (error) {
      setIsProcessing(false);
      setProcessingMessageId(null);
      stopThinking();
      console.error('Error in handleSendMessage:', error);
      toast({
        title: "Error",
        description: "An error occurred while processing your message. Please try again.",
        variant: "destructive",
      });
  
    } finally {
      setTimeout(() => {
        setProcessingMessageId(null);
        setIsMessageComplete(true);
        setIsProcessing(false);
      }, STEP_DISPLAY_TIME);
    }
  };

  const saveAIMessage = async (msg: Message) => {
    if (!conversation) return;
  
    try {
      await createMessage(conversation.id, msg);
      console.log('AI message saved successfully.');
    } catch (error) {
      console.error('Error saving AI message:', error);
      toast({
        title: "Error",
        description: "Failed to save the AI response. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSteps = (messageId: string) => {
    setExpandedSteps(prev => {
      const newExpandedState = !prev[messageId];
      
      if (!newExpandedState) {
        setInitialRevealComplete(prevRevealState => ({
          ...prevRevealState,
          [messageId]: false
        }));
        
        setActiveMessageSteps(prevActiveSteps => ({
          ...prevActiveSteps,
          [messageId]: []
        }));
        
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
          if (message?.steps && index === message.steps.length - 1) {
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
    h1: ({node, ...props}: {node: any, [key: string]: any}) => <h1 style={{fontSize: '2rem', margin: '20px 0', lineHeight: '1.2'}} {...props} />,
    h2: ({node, ...props}: {node: any, [key: string]: any}) => <h2 style={{fontSize: '1.5rem', margin: '18px 0', lineHeight: '1.3'}} {...props} />,
    h3: ({node, ...props}: {node: any, [key: string]: any}) => <h3 style={{fontSize: '1.375rem', margin: '16px 0', lineHeight: '1.3', fontWeight: 'bold'}} {...props} />,
    h4: ({node, ...props}: {node: any, [key: string]: any}) => <h4 style={{fontSize: '1.125rem', margin: '14px 0', lineHeight: '1.3', fontWeight: 'bold'}} {...props} />,
    h5: ({node, ...props}: {node: any, [key: string]: any}) => <h5 style={{fontSize: '1rem', margin: '12px 0', lineHeight: '1.4', fontWeight: 'bold'}} {...props} />,
    h6: ({node, ...props}: {node: any, [key: string]: any}) => <h6 style={{fontSize: '0.875rem', margin: '10px 0', lineHeight: '1.4'}} {...props} />,
    code: ({node, inline, className, children, ...props}: {node: any, inline: boolean, className: string, children: React.ReactNode, [key: string]: any}) => {
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
    ul: ({node, ...props}: {node: any, [key: string]: any}) => (
      <ul style={{
        paddingLeft: '1.5rem',
        marginBottom: '1rem',
        listStyleType: 'disc'
      }} {...props} />
    ),
    li: ({node, ...props}: {node: any, [key: string]: any}) => (
      <li style={{
        marginBottom: '0.5rem'
      }} {...props} />
    ),
    ol: ({node, ...props}: {node: any, [key: string]: any}) => (
      <ol style={{
        paddingLeft: '1.5rem',
        marginBottom: '1rem',
        listStyleType: 'decimal'
      }} {...props} />
    ),
    p: ({node, ...props}: {node: any, [key: string]: any}) => <p style={{marginBottom: '1rem'}} {...props} />
  };
  

  const ThinkingIndicator: React.FC = () => {
    return (
      <FadingWrapper isVisible={isThinkingVisible}>
          <div className="mb-2">
            <div className="flex items-center space-x-2">
              <AnimatedLogo className="text-accent-foreground">iΛ.</AnimatedLogo>
              <h3 className="text-lg font-semibold">
                <RevealingText animationKey={currentStep}>
                  {currentStep || 'Thinking...'}
                </RevealingText>
              </h3>
            </div>
            {currentExplanation && (
              <p className="text-sm text-muted-foreground mt-1">
                <RevealingText animationKey={currentExplanation}>
                  {currentExplanation}
                </RevealingText>
              </p>
            )}
          </div>
      </FadingWrapper>
    );
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
                  <>
                    {!isThinkingTimeoutComplete && isLastAIMessage(message.id) && (
                      <ThinkingIndicator />
                    )}
                    {message.strategy && <Badge variant="default" className="mb-2 text-xs px-2 py-0.5">{message.strategy}</Badge>}
                    <ReactMarkdown 
                      className="text-base prose dark:prose-invert max-w-none"
                      components={customRenderers as Components}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {message.steps && message.steps.length > 0 && (
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
                                <Step key={`${message.id}-${stepIndex}`} isActive={isActive} delay={delay}>
                                  <Bullet isActive={isActive} delay={delay} />
                                  {stepIndex < message.steps.length - 1 && <Line isActive={isActive} delay={delay} />}
                                  <StepContent>
                                    <StepHeader onClick={() => toggleExplanation(message.id, stepIndex)}>
                                      <StepText isActive={isActive} delay={delay}>{step.step}</StepText>
                                      {expandedExplanations[`${message.id}-${stepIndex}`] ? (
                                        <ChevronUp size={16} className="ml-2" />
                                      ) : (
                                        <ChevronDown size={16} className="ml-2" />
                                      )}
                                    </StepHeader>
                                    {expandedExplanations[`${message.id}-${stepIndex}`] && (
                                      <StepExplanation 
                                        isVisible={expandedExplanations[`${message.id}-${stepIndex}`]} 
                                        delay={delay} 
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
                  </>
                )}
              </Card>
            </div>
          ))}
          <div ref={messagesEndRef} />
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

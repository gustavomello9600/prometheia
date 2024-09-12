import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, Conversation, Step, QueuedStep } from '@/types/chat';
import { createMessage, getMessages, getLLMResponseStream, updateConversationTitle } from '@/lib/api';
import { useToast } from "@/hooks/use-toast";

export function useChat(
  conversation: Conversation | null,
  setConversation: React.Dispatch<React.SetStateAction<Conversation | null>>,
  updateConversation: (conversation: Conversation) => void,
  stepDisplayTime: number
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({});
  const [expandedExplanations, setExpandedExplanations] = useState<{ [key: string]: boolean }>({});
  const [activeMessageSteps, setActiveMessageSteps] = useState<{ [key: string]: number[] }>({});
  const [initialRevealComplete, setInitialRevealComplete] = useState<{ [key: string]: boolean }>({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation?.title || '');
  const [isMessageComplete, setIsMessageComplete] = useState<boolean>(false);
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);
  const [isThinkingTimeoutComplete, setIsThinkingTimeoutComplete] = useState(true);
  const [isThinkingVisible, setIsThinkingVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [currentExplanation, setCurrentExplanation] = useState<string>('');
  const { toast } = useToast();

  const stepQueueRef = useRef<QueuedStep[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleTitleUpdate = useCallback(async () => {
    if (conversation && editedTitle !== conversation.title) {
      try {
        await updateConversationTitle(conversation.id, editedTitle);
        updateConversation({ ...conversation, title: editedTitle });
      } catch (error) {
        console.error('Error updating conversation title:', error);
      }
    }
    setIsEditingTitle(false);
  }, [conversation, editedTitle, updateConversation]);

  const processStepQueue = useCallback(() => {
    if (stepQueueRef.current.length === 0) {
      return;
    }
  
    const step = stepQueueRef.current.shift()!;
    setCurrentStep(step.step);
    setCurrentExplanation(step.explanation);
  
    processingTimeoutRef.current = setTimeout(() => {
      if (stepQueueRef.current.length > 0) {
        processStepQueue();
      }
    }, stepDisplayTime);
  }, [stepDisplayTime]);

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
        setTimeout(processRemainingSteps, stepDisplayTime);
      } else {
        setIsThinkingVisible(false);
        setTimeout(() => {
          setIsThinkingTimeoutComplete(true);
          setCurrentStep('');
          setCurrentExplanation('');
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
          }
        }, 1000);
      }
    };

    processRemainingSteps();
  }, [processStepQueue, stepDisplayTime]);

  const isLastAIMessage = useCallback((messageId: string) => {
    const aiMessages = messages.filter(m => m.type === 'ai');
    return aiMessages.length > 0 && aiMessages[aiMessages.length - 1].id === messageId;
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
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
      }, stepDisplayTime);
    }
  }, [conversation, messages, input, isProcessing, startThinking, stopThinking, queueStep, toast, stepDisplayTime]);

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

  const toggleSteps = useCallback((messageId: string) => {
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
  }, [expandedSteps]);

  const animateSteps = useCallback((messageId: string) => {
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
  }, [messages]);

  const toggleExplanation = useCallback((messageId: string, stepIndex: number) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [`${messageId}-${stepIndex}`]: !prev[`${messageId}-${stepIndex}`]
    }));
  }, []);

  return {
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
    isEditingTitle,
    setIsEditingTitle,
    editedTitle,
    setEditedTitle,
    handleTitleUpdate,
    isMessageComplete,
    processingMessageId,
    isThinkingTimeoutComplete,
    isThinkingVisible,
    currentStep,
    currentExplanation,
    isLastAIMessage,
    messagesEndRef,
  };
}
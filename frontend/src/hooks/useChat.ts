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

  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stepQueueRef = useRef<QueuedStep[]>([]);
  const userMessageTimestampRef = useRef<number | null>(null);
  const shouldScrollRef = useRef(false);

  const getFormattedTimestamp = () => {
    if (!userMessageTimestampRef.current) return '00000ms';
    const elapsed = Date.now() - userMessageTimestampRef.current;
    return elapsed.toString().padStart(5, '0') + 'ms';
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
          shouldScrollRef.current = true; // Set to true when conversation is first loaded
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      fetchMessages();
      setEditedTitle(conversation.title);
    }
  }, [conversation]);

  const scrollToBottom = useCallback(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollRef.current = false;
    }
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
    if (stepQueueRef.current.length === 0) return;
    console.log(`[${getFormattedTimestamp()}] Processing step queue`);
    console.log(`[${getFormattedTimestamp()}] Queue before remove: ${JSON.stringify(stepQueueRef.current)}`);
    const step = stepQueueRef.current.shift()!;
    console.log(`[${getFormattedTimestamp()}] Queue after remove: ${JSON.stringify(stepQueueRef.current)}`);
    
    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages];
      const thinkingMessageIndex = updatedMessages.findIndex(msg => msg.isThinking);
      if (thinkingMessageIndex !== -1) {
        updatedMessages[thinkingMessageIndex] = {
          ...updatedMessages[thinkingMessageIndex],
          currentStep: step.step,
          currentExplanation: step.explanation,
        };
      }
      return updatedMessages;
    });
  }, []);

  const queueStep = useCallback((step: QueuedStep) => {
    console.log(`[${getFormattedTimestamp()}] Step received`);
    console.log(`[${getFormattedTimestamp()}] Queue before add: ${JSON.stringify(stepQueueRef.current)}`);
    stepQueueRef.current.push(step);
    console.log(`[${getFormattedTimestamp()}] Queue after add: ${JSON.stringify(stepQueueRef.current)}`);
  }, []);

  const startThinking = useCallback(async (message: Message) => {
    console.log(`[${getFormattedTimestamp()}] Started thinking`);

    const processNextStep = async () => {
      console.log(`[${getFormattedTimestamp()}] Entered thinking loop`);
      while (true) {
        console.log(`[${getFormattedTimestamp()}] Thinking message:`, message);
        
        console.log(`[${getFormattedTimestamp()}] Message receivedStopThinking:`, message.receivedStopThinking);
        if (message.receivedStopThinking) {
          console.log(`[${getFormattedTimestamp()}] Exiting processing loop`);
          break;
        }

        if (stepQueueRef.current.length > 0 && !message.ongoingQueueProcessing) {
          message.ongoingQueueProcessing = true;
          
          processStepQueue();
          await new Promise(resolve => setTimeout(resolve, stepDisplayTime));
          
          message.ongoingQueueProcessing = false;
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`[${getFormattedTimestamp()}] Exited thinking loop`);
    };

    // Start the processing loop and wait for the first iteration to complete
    await new Promise<void>(resolve => {
      setTimeout(() => {
        processNextStep();
        resolve();
      }, 0);
    });
  }, [messages, processStepQueue, stepDisplayTime]);

  const stopThinking = useCallback(async (message: Message) => {
    console.log(`[${getFormattedTimestamp()}] Signaled stop`);
    message.receivedStopThinking = true;

    console.log(`[${getFormattedTimestamp()}] Step queue before stop: ${JSON.stringify(stepQueueRef.current)}`);
    console.log(`[${getFormattedTimestamp()}] Processing remaining steps`);
    const processRemainingSteps = async () => {
      while (stepQueueRef.current.length > 0) {
        if (message.ongoingQueueProcessing) {
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          message.ongoingQueueProcessing = true;
          processStepQueue();
          await new Promise(resolve => setTimeout(resolve, stepDisplayTime));
          message.ongoingQueueProcessing = false;
        }
      }
    };

    await processRemainingSteps();

    setMessages(prevMessages => {
      return prevMessages.map(msg => 
        msg.id === message.id 
          ? { ...msg, isThinking: false, currentStep: '', currentExplanation: '' }
          : msg
      );
    });

    console.log(`[${getFormattedTimestamp()}] Actual stop`);
  }, [processStepQueue, stepDisplayTime]);

  const handleSendMessage = useCallback(async () => {
    if (input.trim() === '' || !conversation || isProcessing) return;

    setIsProcessing(true);
    userMessageTimestampRef.current = Date.now();
  
    const userMessage: Message = { id: Date.now().toString(), type: 'user', content: input };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    shouldScrollRef.current = true; // Set to true when a new user message is added
  
    const aiMessage: Message = { 
      id: (Date.now() + 1).toString(), 
      type: 'ai', 
      content: '', 
      steps: [],
      isThinking: false,
      ongoingQueueProcessing: false,
      receivedStopThinking: false,
      currentStep: '',
      currentExplanation: '',
    };
  
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
          
          if (!aiMessage.isThinking) {
            aiMessage.isThinking = true;
            aiMessage.currentStep = '';
            aiMessage.currentExplanation = '';
            aiMessage.receivedStopThinking = false;
            aiMessage.ongoingQueueProcessing = false;
            startThinking(aiMessage);
          }

          aiMessage.steps = accumulatedSteps;
  
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
          stopThinking(aiMessage);
          saveAIMessage({
            ...aiMessage,
            content: accumulatedContent,
            steps: accumulatedSteps,
            strategy: accumulatedStrategy,
          });
        }
      });

    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      toast({
        title: "Error",
        description: "An error occurred while processing your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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

  const sendMessage = useCallback(async (message: string) => {
    // Set the timestamp when the user sends a message
    userMessageTimestampRef.current = Date.now();
    // ... rest of the sendMessage function ...
  }, [/* existing dependencies */]);

  return {
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
    isEditingTitle,
    setIsEditingTitle,
    editedTitle,
    setEditedTitle,
    handleTitleUpdate,
    messagesEndRef,
    isProcessing
  };
}
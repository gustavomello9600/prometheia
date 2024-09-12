import { useState, useCallback, useRef } from 'react';

interface QueuedStep {
  step: string;
  explanation: string;
}

export function useThinking(stepDisplayTime: number) {
  const [isThinkingVisible, setIsThinkingVisible] = useState(false);
  const [isThinkingTimeoutComplete, setIsThinkingTimeoutComplete] = useState(true);
  const [currentStep, setCurrentStep] = useState('');
  const [currentExplanation, setCurrentExplanation] = useState('');

  const stepQueueRef = useRef<QueuedStep[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return {
    isThinkingVisible,
    isThinkingTimeoutComplete,
    currentStep,
    currentExplanation,
    startThinking,
    stopThinking,
    queueStep
  };
}
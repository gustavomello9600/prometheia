import React, { useState, useEffect } from 'react';
import {
  FadingWrapper,
  AnimatedLogo,
  RevealingText
} from '@/styles/chatStyles';

interface ThinkingIndicatorProps {
  isVisible: boolean;
  currentStep: string;
  currentExplanation: string;
}

export function ThinkingIndicator({ isVisible, currentStep, currentExplanation }: ThinkingIndicatorProps) {
  const [isRendered, setIsRendered] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
    } else {
      const timer = setTimeout(() => setIsRendered(false), 1000); // Match this with the transition duration
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <FadingWrapper isVisible={isVisible}>
      {(isRendered || isVisible) && (
        <div>
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
      )}
    </FadingWrapper>
  );
}
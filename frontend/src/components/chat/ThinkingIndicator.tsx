import React from 'react';
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
  return (
    <FadingWrapper isVisible={isVisible}>
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
}
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import ReactMarkdown, { Components } from 'react-markdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '@/types/chat';
import {
  StepTimeline,
  Step,
  Bullet,
  Line,
  StepContent,
  StepHeader,
  StepText,
  StepExplanation
} from '@/styles/chatStyles';

interface MessageCardProps {
  message: Message;
  expandedSteps: { [key: string]: boolean };
  toggleSteps: (messageId: string) => void;
  expandedExplanations: { [key: string]: boolean };
  toggleExplanation: (messageId: string, stepIndex: number) => void;
  activeMessageSteps: { [key: string]: number[] };
  initialRevealComplete: { [key: string]: boolean };
  isThinkingTimeoutComplete: boolean;
  isLastAIMessage: (messageId: string) => boolean;
}

export function MessageCard({
  message,
  expandedSteps,
  toggleSteps,
  expandedExplanations,
  toggleExplanation,
  activeMessageSteps,
  initialRevealComplete,
  isThinkingTimeoutComplete,
  isLastAIMessage
}: MessageCardProps) {
  const customRenderers: Components = {
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

  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[70%] p-3 bg-secondary text-secondary-foreground`}>
        {message.type === 'user' ? (
          <p className="text-base">{message.content}</p>
        ) : (
          <>
            {message.strategy && <Badge variant="default" className="mb-2 text-xs px-2 py-0.5">{message.strategy}</Badge>}
            <ReactMarkdown 
              className="text-base prose dark:prose-invert max-w-none"
              components={customRenderers}
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
  );
}

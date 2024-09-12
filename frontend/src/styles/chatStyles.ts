import styled, { keyframes, css } from 'styled-components';

export const inflateAnimation = keyframes`
  from { transform: scale(0); }
  to { transform: scale(1); }
`;

export const extendLineAnimation = keyframes`
  from { height: 0; }
  to { height: 100%; }
`;

export const fadeOutAnimation = keyframes`
  from { opacity: 1; max-height: none; margin-bottom: 1rem; }
  to { opacity: 0; max-height: 0; margin-bottom: 0; }
`;

export const fadeInAnimation = keyframes`
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: none; }
`;

export const stepRevealAnimation = keyframes`
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
`;

export const LogoAnimation = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

export const FadingWrapper = styled.div<{ isVisible: boolean }>`
  max-height: ${props => props.isVisible ? '200px' : '0'};
  margin-bottom: ${props => props.isVisible ? '1rem' : '0'};
  transition: max-height 2s ease-out, margin-bottom 2s ease-out;
`;

export const RevealingText = styled.span<{ animationKey: string | number }>`
  display: inline-block;
  animation: ${stepRevealAnimation} 0.5s ease-in-out forwards;
  animation-play-state: ${props => props.animationKey ? 'running' : 'paused'};
`;

export const AnimatedLogo = styled.span`
  font-weight: bold;
  font-size: 24px;
  animation: ${LogoAnimation} 2s infinite;
  display: inline-block;
  min-width: 30px;
  text-align: center;
`;

export const StepTimeline = styled.ul`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0.5rem;
  gap: 0.5rem;
  overflow: hidden;
`;

export const Step = styled.li<{ isActive: boolean; delay: number; height?: string }>`
  display: flex;
  align-items: flex-start;
  opacity: 0;
  animation: ${fadeInAnimation} 0.5s ease-in forwards;
  animation-delay: ${props => props.delay}ms;
  position: relative;
  padding-left: 1rem;
  height: auto;  // Allow arbitrary height
  max-height: none;  // Remove any max-height restrictions
`;

export const StepText = styled.span<{ isActive: boolean; delay: number }>`
  font-size: 0.875rem;
  color: var(--primary-foreground);
  position: relative;
  display: inline-block;
  clip-path: inset(0 100% 0 0);
  animation: ${stepRevealAnimation} 0.75s ease-in-out forwards;
  animation-delay: ${props => props.delay + 250}ms;
`;

export const Bullet = styled.div<{ isActive: boolean; delay: number }>`
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

export const Line = styled.div<{ isActive: boolean; delay: number }>`
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

export const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding-top: 0.1rem;
`;

export const StepHeader = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
`;

export const StepExplanation = styled.p<{ isVisible: boolean; delay: number }>`
  margin-left: 1.5rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
  opacity: ${props => props.isVisible ? 1 : 0};
  max-height: ${props => props.isVisible ? '3000px' : '0'};
  overflow: hidden;
  transition: opacity 0.3s ease-in-out, max-height 0.5s ease-in-out;

  ${props => props.isVisible && css`
    animation: ${fadeInAnimation} 0.3s ease-in-out forwards;
  `}
`;
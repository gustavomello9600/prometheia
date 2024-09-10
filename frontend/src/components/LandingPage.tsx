"use client"

import React, { useRef, useState, useEffect } from 'react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel"
import useEmblaCarousel from 'embla-carousel-react'
import { Clipboard, Lightbulb, Users, Rocket, Brush, Bolt, Briefcase, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import styled, { keyframes } from 'styled-components'
import { useTheme } from "next-themes"

interface Scenario {
  title: string;
  userMessage: string;
  aiResponse: string;
  steps: { step: string; explanation: string }[];
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

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

const ChatMessage = styled.div<{ delay: number }>`
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-in forwards;
  animation-delay: ${props => props.delay}ms;
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
  animation: ${fadeIn} 0.5s ease-in forwards;
  animation-delay: ${props => props.delay}ms;
  position: relative;
  padding-left: 1rem;
`;

const StepText = styled.span<{ isActive: boolean; delay: number }>`
  font-size: 0.875rem;
  color: var(--foreground);
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
  left: 1.26rem;
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

const StepExplanation = styled.p`
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-in forwards;
`;

const CARD_WIDTH = '600px';
const ARROW_SIZE = '30px'; // Define a fixed size for the arrows

// Ensure the carousel wrapper has enough width and manages overflow properly
const ChatCardWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden; /* Hide overflow content */
  padding: 0 ${ARROW_SIZE}; /* Padding to handle arrows */
  box-sizing: border-box;
`;

// Ensure the arrows are well-positioned
const StyledCarouselPrevious = styled(CarouselPrevious)`
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  background-color: hsl(var(--background));
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
  z-index: 20;
  width: ${ARROW_SIZE};
  height: ${ARROW_SIZE};
  &:hover {
    opacity: 0.8;
  }
`;

const StyledCarouselNext = styled(CarouselNext)`
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  background-color: hsl(var(--background));
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
  z-index: 20;
  width: ${ARROW_SIZE};
  height: ${ARROW_SIZE};
  &:hover {
    opacity: 0.8;
  }
`;

const ChatCardCarousel = () => {
  const scenarios = [
    {
      title: "E-commerce Optimization",
      userMessage: "How can I optimize the performance of my e-commerce website during high-traffic sales events?",
      aiResponse: "Certainly! I'd be happy to help you optimize your e-commerce website's performance for high-traffic sales events. Let's break this down into steps to ensure we cover all crucial aspects.",
      steps: [
        { step: "Analyze current infrastructure", explanation: "Evaluate the existing server setup, database configuration, and content delivery methods." },
        { step: "Identify bottlenecks and vulnerabilities", explanation: "Pinpoint areas of the system that may struggle under high load or pose security risks." },
        { step: "Implement performance enhancements", explanation: "Apply optimizations such as caching, load balancing, and database query improvements." }
      ]
    },
    {
      title: "Social Media Marketing Strategy",
      userMessage: "How can I increase engagement on my company's social media platforms?",
      aiResponse: "To increase engagement on social media, we can implement a targeted strategy. Let's walk through some effective steps to boost your presence.",
      steps: [
        { step: "Create audience personas", explanation: "Understand your target audience's preferences, demographics, and behaviors to tailor your content." },
        { step: "Optimize content for platforms", explanation: "Adapt your content format and messaging for each social media platform to maximize reach and engagement." },
        { step: "Leverage user-generated content", explanation: "Encourage your followers to share content related to your brand, boosting authenticity and engagement." }
      ]
    },
    {
      title: "Personal Finance Management",
      userMessage: "What steps should I take to better manage my personal finances?",
      aiResponse: "Managing personal finances can be simplified with a structured approach. Here's a step-by-step guide to get you on track.",
      steps: [
        { step: "Create a monthly budget", explanation: "Outline your income and expenses, allocating funds for essential needs, savings, and discretionary spending." },
        { step: "Track and reduce unnecessary spending", explanation: "Monitor your daily expenses and identify areas where you can cut back on non-essential purchases." },
        { step: "Establish an emergency fund", explanation: "Set aside a portion of your income to build a fund that covers 3-6 months of living expenses for unexpected situations." }
      ]
    },
    {
      title: "Classroom Management for Teachers",
      userMessage: "How can I improve classroom management and engage my students more effectively?",
      aiResponse: "Improving classroom management requires a mix of organization, engagement, and behavior management strategies. Here's how you can enhance your approach.",
      steps: [
        { step: "Establish clear rules and routines", explanation: "Set expectations for behavior and classroom activities, making sure students understand and follow them." },
        { step: "Incorporate interactive learning", explanation: "Use games, group work, and technology to make lessons more engaging and participatory." },
        { step: "Positive reinforcement and feedback", explanation: "Recognize good behavior and academic achievements, offering praise and rewards to motivate students." }
      ]
    },
    {
      title: "Creative Writing Process",
      userMessage: "I want to improve my creative writing skills. What should I focus on?",
      aiResponse: "Creative writing is all about honing your imagination and narrative skills. Here are some key areas to focus on for improvement.",
      steps: [
        { step: "Develop a writing routine", explanation: "Set aside dedicated time each day to practice writing and experiment with different genres and styles." },
        { step: "Study storytelling techniques", explanation: "Learn about plot structure, character development, and pacing to enhance your narrative skills." },
        { step: "Seek feedback and revise", explanation: "Share your writing with others for constructive criticism, and don't be afraid to rewrite and improve your work." }
      ]
    }
  ];
  

  const [activeIndex, setActiveIndex] = useState(0);
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center', containScroll: 'trimSnaps' })

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => {
        setActiveIndex(emblaApi.selectedScrollSnap());
        setAnimationTrigger(prev => prev + 1);
      });
    }
  }, [emblaApi]);

  return (
    <ChatCardWrapper>
      <Carousel
        ref={emblaRef}
        opts={{
          align: "center",
          loop: true,
          containScroll: 'trimSnaps'
        }}
        className="w-full relative"
      >
        <CarouselContent className="w-full">
          {scenarios.map((scenario, index) => (
            <CarouselItem key={index} className="flex justify-center items-center">
              <Card
                style={{ width: CARD_WIDTH }}  // Ensure the card has a fixed width
                className="bg-background text-foreground overflow-hidden"
              >
                <CarouselChatContent 
                  scenario={scenario} 
                  isActive={index === activeIndex}
                  animationTrigger={animationTrigger}
                />
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <StyledCarouselPrevious />
        <StyledCarouselNext />
      </Carousel>
    </ChatCardWrapper>
  );
};

const CarouselChatContent: React.FC<{
  scenario: Scenario;
  isActive: boolean;
  animationTrigger: number;
}> = ({ scenario, isActive, animationTrigger }) => {
  const [showContent, setShowContent] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [expandedExplanations, setExpandedExplanations] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    setShowContent(false);
    setShowSteps(false);
    setActiveStep(-1);
    setExpandedExplanations({});

    const contentTimer = setTimeout(() => setShowContent(true), 100);
    const stepsTimer = setTimeout(() => setShowSteps(true), 1000);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(stepsTimer);
    };
  }, [animationTrigger]);

  useEffect(() => {
    if (showSteps) {
      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < scenario.steps.length) {
          setActiveStep(stepIndex);
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showSteps, scenario.steps.length]);

  const toggleExplanation = (stepIndex: number) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center p-4 border-b">
        <Avatar className="w-10 h-10">
          <AvatarImage src="/placeholder.svg?height=40&width=40" alt="AI Avatar" />
          <AvatarFallback>iΛ.</AvatarFallback>
        </Avatar>
        <div className="ml-3 flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">
            {scenario.title}
          </h2>
        </div>
      </div>

      {/* Chat messages */}
      {showContent && (
        <>
          <ChatMessage delay={0} className="flex justify-end">
            <Card className="max-w-[70%] p-3 bg-secondary text-secondary-foreground">
              <p className="text-base">{scenario.userMessage}</p>
            </Card>
          </ChatMessage>
          <ChatMessage delay={500} className="flex justify-start">
            <Card className="max-w-[70%] p-3 bg-secondary text-secondary-foreground">
              <p className="text-base">{scenario.aiResponse}</p>
              {showSteps && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">Showing steps</p>
                  <StepTimeline>
                    {scenario.steps.map((step: { step: string; explanation: string }, index: number) => {
                      const isActive = activeStep >= index;
                      const delay = index * 1000;
                      return (
                        <Step key={`${animationTrigger}-${index}`} isActive={isActive} delay={delay}>
                          <Bullet isActive={isActive} delay={delay} />
                          {index < scenario.steps.length - 1 && <Line isActive={isActive} delay={delay} />}
                          <StepContent>
                            <StepHeader onClick={() => toggleExplanation(index)}>
                              <StepText isActive={isActive} delay={delay}>{step.step}</StepText>
                              {expandedExplanations[index] ? (
                                <ChevronUp size={16} className="ml-2" />
                              ) : (
                                <ChevronDown size={16} className="ml-2" />
                              )}
                            </StepHeader>
                            {expandedExplanations[index] && (
                              <StepExplanation>
                                {step.explanation}
                              </StepExplanation>
                            )}
                          </StepContent>
                        </Step>
                      );
                    })}
                  </StepTimeline>
                </>
              )}
            </Card>
          </ChatMessage>
        </>
      )}
    </div>
  );
};

export default function LandingPage() {
  const { setTheme } = useTheme()
  const featuresRef = useRef<HTMLElement>(null)
  const benefitsRef = useRef<HTMLElement>(null)
  const testimonialsRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setTheme('light')

    return () => {
      setTheme('system')
    }
  }, [setTheme])

  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6 flex justify-between items-center">
        <Link href="#" className="text-2xl font-bold" prefetch={false}>
          Promethe<span className="text-accent-foreground">iΛ</span>.
        </Link>
        <nav className="hidden md:flex gap-6">
          <ul className="flex space-x-4">
            <li><button onClick={() => scrollToSection(featuresRef)} className="hover:underline">Features</button></li>
            <li><button onClick={() => scrollToSection(benefitsRef)} className="hover:underline">Benefits</button></li>
            <li><button onClick={() => scrollToSection(testimonialsRef)} className="hover:underline">Testimonials</button></li>
            <li><button onClick={() => scrollToSection(ctaRef)} className="hover:underline">Request Demo</button></li>
          </ul>
        </nav>
        <Link href="/login" passHref>
          <Button variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">Get Started</Button>
        </Link>
      </header>

      <main>
        <section className="py-24 px-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12 min-h-[600px]">
              <div className="w-full lg:w-1/2 space-y-4 flex flex-col justify-center">
                <h1 className="text-4xl font-bold">Promethe<span className="text-accent-foreground">iΛ</span>: Where Intelligence Meets Action</h1>
                <p className="text-xl text-muted-foreground">
                  Automate tasks, streamline workflows, and achieve extraordinary results with our advanced AI agent.
                </p>
                <Link href="/login" passHref className="inline-block">
                  <Button>Get Started</Button>
                </Link>
              </div>
              <div className="w-full lg:w-1/2 flex items-center overflow-hidden">
                <ChatCardCarousel />
              </div>
            </div>
          </div>
        </section>

        {/* Remaining sections */}
      </main>
    </div>
  )
}

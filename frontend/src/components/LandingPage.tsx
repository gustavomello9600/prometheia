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

const ChatCardWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: visible;
  padding: 0 ${ARROW_SIZE};
`;

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
      title: "SaaS Growth Strategy",
      userMessage: "Can you help me develop a 5-year growth strategy for my SaaS startup?",
      aiResponse: "Absolutely! I'd be glad to assist you in creating a 5-year growth strategy for your SaaS startup. Let's approach this systematically to ensure we cover all key areas.",
      steps: [
        { step: "Assess market trends and competition", explanation: "Analyze industry dynamics, identify key competitors, and forecast market evolution." },
        { step: "Define growth objectives and KPIs", explanation: "Establish clear, measurable goals for user acquisition, revenue, and market share." },
        { step: "Formulate actionable strategies", explanation: "Develop specific tactics for product development, marketing, and scaling operations." }
      ]
    },
    {
      title: "Database Query Optimization",
      userMessage: "I need help optimizing a complex database query that's slowing down my application. Can you assist?",
      aiResponse: "Of course! I'd be happy to help you optimize your complex database query to improve your application's performance. Let's tackle this step by step.",
      steps: [
        { step: "Analyze query structure and execution plan", explanation: "Examine the current query and its execution plan to understand performance bottlenecks." },
        { step: "Identify optimization opportunities", explanation: "Determine areas for improvement, such as indexing, join optimizations, or query restructuring." },
        { step: "Rewrite and test optimized query", explanation: "Implement the optimizations and conduct performance testing to verify improvements." }
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
              <Card style={{ width: CARD_WIDTH }} className={`bg-background text-foreground overflow-hidden`}>
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
  const [initialDelayPassed, setInitialDelayPassed] = useState(true)

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

        <section ref={featuresRef} id="features" className="bg-muted py-24 px-6">
          <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <Clipboard className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold">Plan & Execute</h3>
              <p className="text-muted-foreground">
                Leverage our AI-powered planning and execution capabilities to streamline your workflows and achieve
                your goals.
              </p>
            </div>
            <div className="space-y-4">
              <Lightbulb className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold">Learn & Adapt</h3>
              <p className="text-muted-foreground">
                Our AI agent continuously learns and adapts to your needs, ensuring you stay ahead of the curve.
              </p>
            </div>
            <div className="space-y-4">
              <Users className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold">Collaborate & Integrate</h3>
              <p className="text-muted-foreground">
                Seamlessly integrate Promethe<span className="font-bold text-accent-foreground">iΛ</span>. into your existing workflows and collaborate with your team for maximum
                impact.
              </p>
            </div>
          </div>
        </section>

        <section ref={benefitsRef} id="benefits" className="py-24 px-6">
          <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-primary text-primary-foreground p-8 rounded-lg">
              <Rocket className="h-12 w-12" />
              <h3 className="text-2xl font-bold">Boost Productivity</h3>
              <p>
                Promethe<span className="font-bold text-accent-foreground">iΛ</span>. automates repetitive tasks, freeing up your time to focus on high-impact work and drive your
                business forward.
              </p>
            </div>
            <div className="bg-background p-8 rounded-lg">
              <Brush className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold">Unleash Creativity</h3>
              <p>
                Our AI agent provides intelligent insights and recommendations, empowering you to explore new ideas and
                unlock your creative potential.
              </p>
            </div>
            <div className="bg-background p-8 rounded-lg">
              <Bolt className="h-12 w-12 text-primary" />
              <h3 className="text-2xl font-bold">Accelerate Innovation</h3>
              <p>
                Leverage Promethe<span className="font-bold text-accent-foreground">iΛ</span>.,s advanced capabilities to rapidly prototype, test, and iterate on new ideas,
                driving innovation at unprecedented speeds.
              </p>
            </div>
            <div className="bg-primary text-primary-foreground p-8 rounded-lg">
              <Briefcase className="h-12 w-12" />
              <h3 className="text-2xl font-bold">Optimize Operations</h3>
              <p>
                Our AI agent analyzes your workflows and provides data-driven recommendations to streamline your
                operations and improve efficiency.
              </p>
            </div>
          </div>
        </section>

        <section ref={testimonialsRef} id="testimonials" className="bg-muted py-24 px-6">
          <div className="container mx-auto">
            <Carousel className="max-w-3xl mx-auto">
              <CarouselContent>
                <CarouselItem>
                  <div className="space-y-4 text-center">
                    <blockquote className="text-xl italic">
                      &quot;Promethe<span className="text-accent-foreground">iΛ</span>. has revolutionized the way we work. It&apos;s like having a supercharged assistant on our team.&quot;
                    </blockquote>
                    <div className="text-muted-foreground">- John Doe, CEO at Acme Corp</div>
                  </div>
                </CarouselItem>
                <CarouselItem>
                  <div className="space-y-4 text-center">
                    <blockquote className="text-xl italic">
                      &quot;With Promethe<span className="font-bold text-accent-foreground">iΛ</span>., we&apos;ve seen a significant boost in productivity and a dramatic reduction in manual tasks.&quot;
                    </blockquote>
                    <div className="text-muted-foreground">- Jane Smith, Head of Operations at Globex Inc</div>
                  </div>
                </CarouselItem>
                <CarouselItem>
                  <div className="space-y-4 text-center">
                    <blockquote className="text-xl italic">
                      &quot;Promethe<span className="font-bold text-accent-foreground">iΛ</span>. has been a game-changer for our team. It&apos;s like having a highly intelligent and tireless co-worker.&quot;
                    </blockquote>
                    <div className="text-muted-foreground">- Michael Johnson, CTO at Technosoft Solutions</div>
                  </div>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </section>

        <section ref={ctaRef} id="cta" className="py-24 px-6">
          <div className="container mx-auto max-w-3xl text-center space-y-4">
            <h2 className="text-3xl font-bold">Experience the Future of Work</h2>
            <p className="text-muted-foreground">
              Discover how Promethe<span className="font-bold text-accent-foreground">iΛ</span>. can transform your business and unlock new levels of productivity, creativity, and
              innovation.
            </p>
            <Button>Request a Demo</Button>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground py-6 px-6">
        <div className="container mx-auto flex justify-between items-center">
          <p className="text-sm">&copy; 2024 Promethe<span className="text-accent-foreground">iΛ</span>. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:underline" prefetch={false}>
              Privacy Policy
            </Link>
            <Link href="#" className="hover:underline" prefetch={false}>
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

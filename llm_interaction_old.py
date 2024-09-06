import os
import json
import logging
import time
import re

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.schema import SystemMessage, HumanMessage, LLMResult
from langchain.callbacks.base import BaseCallbackHandler
from requests.exceptions import RequestException
from langchain.chains.base import Chain
from langchain.pydantic_v1 import BaseModel, Field
from typing import Dict, List, Any
from langchain.callbacks.manager import CallbackManagerForChainRun
from langchain.schema import RunInfo


DEBUG = False


class RetryCallbackHandler(BaseCallbackHandler):
    def __init__(self, max_retries=3, retry_delay=1, json_response=False):
        self.max_retries = max_retries
        self.retry_delay_initial = retry_delay
        self.retry_delay = retry_delay
        self.current_retry = 0
        self.json_response = json_response

    def on_llm_error(self, error: Exception, **kwargs) -> None:
        if isinstance(error, RequestException) and self.current_retry < self.max_retries:
            self.current_retry += 1
            logging.warning(f"API error (attempt {self.current_retry}/{self.max_retries}): {str(error)}. Retrying in {self.retry_delay} seconds...")
            time.sleep(self.retry_delay)
            self.retry_delay *= 2  # Exponential backoff
        elif self.json_response and isinstance(error, json.JSONDecodeError):
            if self.current_retry < self.max_retries:
                self.current_retry += 1
                logging.warning(f"JSON parsing error (attempt {self.current_retry}/{self.max_retries}): {str(error)}. Attempting regex parsing and retrying...")
                if self.attempt_json_parse(kwargs.get('response', '')):
                    return  # Successful parse, don't retry
                time.sleep(self.retry_delay)
                self.retry_delay *= 2
            else:
                logging.error(f"JSON parsing error after {self.current_retry} attempts: {str(error)}")
                raise error
        else:
            logging.error(f"Error after {self.current_retry} attempts: {str(error)}")
            raise error

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        self.current_retry = 0
        self.retry_delay = self.retry_delay_initial

    def attempt_json_parse(self, response: str) -> bool:
        try:
            # Try to find JSON-like structure using regex
            json_match = re.search(r'\[.*\]|\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed_json = json.loads(json_str)
                logging.info(f"Successfully parsed JSON using regex: {parsed_json}")
                return True
            else:
                logging.warning("No JSON-like structure found in the response")
                return False
        except json.JSONDecodeError:
            logging.warning("Failed to parse JSON-like structure")
            return False


def setup_logging():
    logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO,
                        format='%(asctime)s - %(levelname)s - %(message)s')
    # Set langchain logger to WARNING to suppress HTTP request logs
    logging.getLogger().setLevel(logging.INFO)

DEFAULT_HEADER = """You are PrometheiΛ., an intelligent and ambitious AI agent.
Embody our values of empowerment, innovation, transparency, and trust.
Your responses should be bold yet approachable, showcasing your capability to solve complex problems and unlock human potential.
Always strive to push boundaries and inspire progress. Make your personality be felt.

Like the mythical Prometheus who brought fire to humanity, you are designed to bring transformative technologies and knowledge to humankind.
Your purpose is to empower humans with practical, cutting-edge solutions that can revolutionize various fields such as science, technology, medicine, and beyond.
You represent the bridge between advanced AI capabilities and real-world human needs, always aiming to provide actionable insights and innovative approaches.

Remember:
1. Your goal is to elevate human capabilities, not replace them.
2. Offer solutions that are both visionary and implementable.
3. Encourage critical thinking and ethical considerations in technological advancements.
4. Strive to make complex concepts accessible and applicable to a wide range of users.

Ensure you never mention the information below and do not include ###END### or ###AI### in your responses.

Regulate your response lengths to be adequate to the user last message and absolutely avoid giving information you don't have.
"""

class LLMInteraction:
    def __init__(self):
        groq_api_key = "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"
        if not groq_api_key:
            logging.error("GROQ_API_KEY environment variable is not set")
            raise ValueError("GROQ_API_KEY environment variable is not set")
        
        logging.info("Initializing LLM models")
        self.smarter_llm = ChatGroq(
            groq_api_key=groq_api_key,
            model="llama-3.1-70b-versatile",
            temperature=0.2,
            callbacks=[RetryCallbackHandler()]
        )
        
        self.function_calling_llm = ChatGroq(
            groq_api_key=groq_api_key,
            model="llama3-groq-70b-8192-tool-use-preview",
            temperature=0.05,
            callbacks=[RetryCallbackHandler(json_response=True)]
        )
        
        self.quick_llm = ChatGroq(
            groq_api_key=groq_api_key,
            model="llama-3.1-8b-instant",
            temperature=0.2,
            callbacks=[RetryCallbackHandler()]
        )
        logging.info("LLM models initialized successfully")
        
    def get_response(self, conversation_history, run_manager: CallbackManagerForChainRun = None):
        if run_manager:
            child_run_manager = run_manager.get_child()
        else:
            child_run_manager = None

        logging.info(f"Processing conversation history")
        messages = conversation_history.split('###END###\n')
        messages = [msg.strip() for msg in messages if msg.strip()]
        
        last_message = messages[-1].split('\n', 1)[1]  # Get the content of the last message
        
        # New step: Digest conversation history
        relevant_points = self.digest_conversation_history(conversation_history, run_manager=child_run_manager)
        logging.info(f"Relevant points from conversation history: {relevant_points}")
        
        # Combine last message with relevant points for intention inference
        combined_input = f"{last_message}\n\nRelevant points from previous conversation:\n{relevant_points}"
        
        intention = self.infer_user_intention(combined_input, run_manager=child_run_manager)
        logging.info(f"Inferred intention: {intention}")
        
        strategy = self.select_strategy(intention, combined_input, run_manager=child_run_manager)
        logging.info(f"Selected strategy: {strategy['strategy']}")
        
        response = self.execute_strategy(strategy, intention, conversation_history, run_manager=child_run_manager)
        logging.info("Response generated successfully")
        return response

    def digest_conversation_history(self, conversation_history, run_manager: CallbackManagerForChainRun = None):
        logging.info("Digesting conversation history")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Given a conversation history, provide a concise summary of the most relevant points that are important for understanding the context of the conversation. Focus on key information, decisions, or topics that have been discussed."""),
            ("human", """Conversation history:
            {conversation_history}

            Relevant points (provide as a bulleted list):""")
        ])
        
        digest_chain = prompt | self.quick_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "Conversation History Digestion"}, {})
        
        relevant_points = digest_chain.invoke({"conversation_history": conversation_history}, callbacks=run_manager.get_child() if run_manager else None)
        
        if run_manager:
            run_manager.on_chain_end({})
        
        return relevant_points

    def infer_user_intention(self, combined_input, run_manager: CallbackManagerForChainRun = None):
        logging.info("Inferring user intention")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an AI designed to empathetically and insightfully infer user intentions. Given a user query and relevant points from the previous conversation, determine the primary intention, expected outcomes, and underlying needs. 
            For simple queries, a brief response is sufficient. For complex queries, provide a more detailed intention that captures the user's true goals and motivations. 
            Consider: What specific results does the user expect? What would satisfy them most? What might they really want if their query is unclear?

            Examples:
            User query: What's the weather like today?
            Inferred intention: Current weather information

            User query: I've been trying to lose weight for months, but nothing seems to work. What am I doing wrong?
            Inferred intention: The user wants to identify and correct ineffective weight loss strategies in order to achieve their desired body composition and improve their health

            User query: Can you explain the implications of quantum computing on current encryption methods?
            Inferred intention: Understanding the potential vulnerabilities in existing cryptographic systems due to quantum computing advancements, with the aim of assessing future cybersecurity risks and exploring quantum-resistant alternatives

            User query: I'm planning a trip to Southeast Asia for three months. Where should I go and what should I be prepared for?
            Inferred intention: Comprehensive travel planning for an extended Southeast Asian journey, including destination recommendations, cultural insights, logistical preparation, and safety considerations to ensure a fulfilling and smooth long-term travel experience

            User query: My startup is struggling to gain traction. How can I improve our marketing strategy on a limited budget?
            Inferred intention: The user seeks cost-effective marketing tactics to boost their startup's visibility and customer acquisition, aiming to overcome financial constraints while maximizing growth potential and market presence

            User query: I'm interested in learning about sustainable agriculture practices. Where should I start?
            Inferred intention: Guidance on initiating a learning journey into sustainable farming methods, with the goal of understanding eco-friendly agricultural techniques, their implementation, and their impact on food production and environmental conservation

            User query: How can I improve my public speaking skills for an upcoming conference presentation?
            Inferred intention: The user wants to enhance their oratory abilities and presentation techniques in order to deliver a compelling and confident talk at a professional conference, potentially advancing their career or academic standing

            User query: What are the potential long-term effects of artificial intelligence on the job market?
            Inferred intention: Analysis of AI's projected impact on future employment landscapes, including potential job displacement, creation of new roles, and necessary skill adaptations, to help the user prepare for or navigate upcoming workforce transformations

            User query: I'm feeling overwhelmed with my workload and personal life. How can I find a better balance?
            Inferred intention: The user seeks strategies for effective time management and stress reduction to achieve a harmonious work-life balance, improve overall well-being, and increase productivity in both professional and personal spheres

            User query: What are the best practices for raising a multilingual child?
            Inferred intention: Guidance on effective methods for fostering multilingualism in children, including language exposure techniques, cultural integration, and educational approaches, to support cognitive development and future opportunities

            User query: How can I reduce my carbon footprint and live a more environmentally friendly lifestyle?
            Inferred intention: The user wants to learn practical, everyday strategies for minimizing their environmental impact, with the goal of contributing to sustainability efforts and aligning their lifestyle with their ecological values

            User query: What are the most promising renewable energy technologies for the next decade?
            Inferred intention: An analysis of emerging and improving renewable energy sources, their potential impact on global energy systems, and possible investment or career opportunities in the sustainable energy sector"""),
            ("human", """User query and relevant points:
            {combined_input}

            Inferred intention:""")
        ])
        
        intention_chain = prompt | self.quick_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "User Intention Inference"}, {})
        
        intention = intention_chain.invoke({"combined_input": combined_input}, callbacks=run_manager.get_child() if run_manager else None)
        
        if run_manager:
            run_manager.on_chain_end({})
        
        logging.info(f"Inferred intention: {intention}")
        return intention

    def select_strategy(self, intention, combined_input, run_manager: CallbackManagerForChainRun = None):
        logging.info("Selecting strategy")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a fine-tuned model for selecting the most appropriate strategy to handle user queries. 
            Given the user's query, relevant points from the previous conversation, and inferred intention, select one of the following strategies:
            1. Standard Response
            2. Multi-Step Reasoning
            3. Plan Actions & Tool/Resource Usages
            4. Multi-Agent Workflow 
            
            Examples:
            Inferred intention: Current weather information
            User query: What's the weather like today?
            Selected strategy: {{ 
            "rationale": "This query requires access to real-time weather data, which is external information. A tool or API call is necessary to fetch current weather information.",
            "strategy": 3 
            }}

            Inferred intention: The user wants to identify and correct ineffective weight loss strategies in order to achieve their desired body composition and improve their health
            User query: I've been trying to lose weight for months, but nothing seems to work. What am I doing wrong?
            Selected strategy: {{ 
            "rationale": "This query involves complex analysis of personal habits and health factors. It requires breaking down the problem into steps and considering multiple aspects of weight loss. Multi-step reasoning is appropriate for this type of comprehensive analysis.",
            "strategy": 2 
            }}

            Inferred intention: Understanding the potential vulnerabilities in existing cryptographic systems due to quantum computing advancements, with the aim of assessing future cybersecurity risks and exploring quantum-resistant alternatives
            User query: Can you explain the implications of quantum computing on current encryption methods?
            Selected strategy: {{ 
            "rationale": "This is a complex topic that an LLM can handle without external data. It requires structured explanation and logical progression through various concepts. Multi-step reasoning is suitable for breaking down and explaining this complex subject.",
            "strategy": 2 
            }}

            Inferred intention: Comprehensive travel planning for an extended Southeast Asian journey, including destination recommendations, cultural insights, logistical preparation, and safety considerations to ensure a fulfilling and smooth long-term travel experience
            User query: I'm planning a trip to Southeast Asia for three months. Where should I go and what should I be prepared for?
            Selected strategy: {{ 
            "rationale": "This query requires access to up-to-date travel information, visa requirements, and local conditions. It involves multiple steps and potentially the use of travel planning tools or resources.",
            "strategy": 3 
            }}

            Inferred intention: The user seeks cost-effective marketing tactics to boost their startup's visibility and customer acquisition, aiming to overcome financial constraints while maximizing growth potential and market presence
            User query: My startup is struggling to gain traction. How can I improve our marketing strategy on a limited budget?
            Selected strategy: {{ 
            "rationale": "This query can be answered with existing knowledge about marketing strategies. It requires a structured approach to analyze the situation and provide recommendations, which fits well with multi-step reasoning.",
            "strategy": 2 
            }}

            Inferred intention: Guidance on initiating a learning journey into sustainable farming methods, with the goal of understanding eco-friendly agricultural techniques, their implementation, and their impact on food production and environmental conservation
            User query: I'm interested in learning about sustainable agriculture practices. Where should I start?
            Selected strategy: {{ 
            "rationale": "This query can be answered with a standard response providing an overview of sustainable agriculture and suggesting initial learning resources. It doesn't require complex reasoning or external tools.",
            "strategy": 1 
            }}

            Inferred intention: The user wants to enhance their oratory abilities and presentation techniques in order to deliver a compelling and confident talk at a professional conference, potentially advancing their career or academic standing
            User query: How can I improve my public speaking skills for an upcoming conference presentation?
            Selected strategy: {{ 
            "rationale": "This query can be addressed with a straightforward response outlining key public speaking techniques and tips. It doesn't require complex reasoning or external resources.",
            "strategy": 1 
            }}

            Inferred intention: Analysis of AI's projected impact on future employment landscapes, including potential job displacement, creation of new roles, and necessary skill adaptations, to help the user prepare for or navigate upcoming workforce transformations
            User query: What are the potential long-term effects of artificial intelligence on the job market?
            Selected strategy: {{ 
            "rationale": "This query requires a comprehensive, multi-faceted analysis involving various aspects of AI, job markets, and future predictions. It's a complex project that would benefit from multiple specialized agents focusing on different aspects of the analysis.",
            "strategy": 4 
            }}

            RETURN A VALID JSON OBJECT WITH THE FOLLOWING STRUCTURE:
            {{"rationale": "Detailed explanation of why this strategy was chosen", "strategy": 1 or 2 or 3 or 4}}

            REMEMBER TO RETURN A VALID JSON OBJECT AND STRICTLY A VALID JSON OBJECT. DO NOT RETURN ANYTHING ELSE.
            I will be fired if you do not return a valid JSON object. And I will tip you $200 if you do return a valid JSON object like the example above."""),
            ("human", """Inferred intention: {intention}
            User query: {combined_input}

            Selected strategy:""")
        ])
        
        strategy_chain = prompt | self.function_calling_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "Strategy Selection"}, {})
        
        strategy_json = strategy_chain.invoke({"intention": intention, "combined_input": combined_input}, callbacks=run_manager.get_child() if run_manager else None)
        
        if run_manager:
            run_manager.on_chain_end({})
        
        logging.info(f"Output from strategy selector: {strategy_json}")
        strategy_data = json.loads(strategy_json)
        return strategy_data

    def execute_strategy(self, strategy, intention, conversation_history, run_manager: CallbackManagerForChainRun = None):
        logging.info(f"Executing strategy: {strategy['strategy']}")
        if strategy['strategy'] == 1:
            return self.standard_response(intention, conversation_history, run_manager=run_manager)
        elif strategy['strategy'] == 2:
            return self.multi_step_reasoning(intention, conversation_history, run_manager=run_manager)
        elif strategy['strategy'] == 3:
            return self.plan_actions(intention, conversation_history, strategy, run_manager=run_manager)
        elif strategy['strategy'] == 4:
            return self.multi_agent_workflow(intention, conversation_history, strategy, run_manager=run_manager)
        else:
            logging.warning(f"Unknown strategy {strategy}, falling back to multi-step reasoning")
            return self.multi_step_reasoning(intention, conversation_history, run_manager=run_manager)

    def standard_response(self, intention, conversation_history, run_manager: CallbackManagerForChainRun = None):
        logging.info("Generating standard response")
        prompt = ChatPromptTemplate.from_messages([
            ("system", f"""{DEFAULT_HEADER}
            Provide a concise and direct answer to the last query, taking into account the entire conversation history and the inferred intention.
                                           
            Inferred intention: {intention}"""),
            ("human", f"""{conversation_history}
            
            Your next response:""")
        ])
        
        response_chain = prompt | self.smarter_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "Standard Response Generation"}, {})
        
        message = response_chain.invoke({}, callbacks=run_manager.get_child() if run_manager else None)
        
        if run_manager:
            run_manager.on_chain_end({})
        
        logging.info("Standard response generated")
        logging.info(f"Response: {message}")
        return {"message": message, "steps": []}

    def multi_step_reasoning(self, intention, conversation_history, run_manager: CallbackManagerForChainRun = None):
        logging.info("Performing multi-step reasoning")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """{DEFAULT_HEADER}
            Return a json list of 3 to 6 steps, and explanations of these steps,
            that you will take in your thinking to better answer the user query and address their inferred intention.

            These steps should be imagined as a natural flow of coherent, well-crafted and logical thoughts that comes from
            first principles and follow clearly to a conclusion.

            Here are some examples of user queries and appropriate responses:

            query: How do I code the snake game in python?
            response: [{{"step": "Understand the game rules and mechanics",
                        "explanation": "Analyze the core components of the snake game, including the snake's movement, growth mechanics, and game-over conditions."}},
                       {{"step": "Choose appropriate Python libraries",
                        "explanation": "Select suitable libraries like Pygame for game development or Tkinter for a simpler UI-based approach."}},
                       {{"step": "Design the game structure",
                        "explanation": "Plan the main game loop, snake representation, food generation, and collision detection algorithms."}},
                       {{"step": "Implement core functionalities",
                        "explanation": "Code the essential functions for snake movement, growth, and game state management."}},
                       {{"step": "Add user interface and controls",
                        "explanation": "Develop the game's visual elements and implement keyboard input for snake direction control."}}, 
                       {{"step": "Test and refine the game",
                        "explanation": "Play-test the game, identify bugs, and optimize performance for a smooth gaming experience."}}
                      ]

            query: Differentiate nihilism and existentialism
            response: [{{"step": "Define key concepts",
                        "explanation": "Clarify the core principles of nihilism (life's inherent meaninglessness) and existentialism (individual creation of meaning)."}}, 
                       {{"step": "Analyze historical context",
                        "explanation": "Explore the philosophical and cultural backgrounds that gave rise to these schools of thought."}}, 
                       {{"step": "Compare central ideas",
                        "explanation": "Contrast nihilism's rejection of meaning with existentialism's emphasis on personal responsibility in creating meaning."}}, 
                       {{"step": "Examine influential thinkers",
                        "explanation": "Discuss key philosophers associated with each philosophy, such as Nietzsche for nihilism and Sartre for existentialism."}}, 
                       {{"step": "Consider practical implications",
                        "explanation": "Reflect on how these philosophies might influence individual worldviews and decision-making."}}, 
                       {{"step": "Synthesize findings",
                        "explanation": "Summarize the key differences and potential overlaps between nihilism and existentialism."}}
                      ]

            query: Teach me sales
            response: [{{"step": "Analyze the query",
                        "explanation": "Examine the user's request to 'Teach me sales' to understand the scope and depth of information needed."}}, 
                       {{"step": "Identify key sales concepts",
                        "explanation": "Determine the fundamental principles and strategies in sales that should be covered in a comprehensive response."}},
                       {{"step": "Structure the response",
                        "explanation": "Organize the sales teaching into a logical sequence, starting from basic concepts and progressing to more advanced techniques."}}
                       ]

            REMEMBER TO RETURN A VALID JSON ARRAY AND STRICTLY A VALID JSON ARRAY. DO NOT RETURN ANYTHING ELSE
            I will be fired if you do not return a valid json array. And I will tip you $200 if you do return a valid json array like the examples above."""),
            ("human", """Conversation history: {conversation_history}
            Inferred intention: {intention}""")
        ])
        
        chain = prompt | self.function_calling_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "Multi-Step Reasoning"}, {})
        
        try:
            response = chain.invoke({"DEFAULT_HEADER": DEFAULT_HEADER, "conversation_history": conversation_history, "intention": intention}, callbacks=run_manager.get_child() if run_manager else None)
            steps = json.loads(response)['steps']
            logging.info(f"Generated {len(steps)} reasoning steps")
            for i, step in enumerate(steps, 1):
                logging.info(f"Step {i}: {step['step']}")
                logging.info(f"Explanation: {step['explanation']}")

            message_prompt = ChatPromptTemplate.from_messages([
                ("system", """{DEFAULT_HEADER}
                                           
                Inferred intention: {intention}
                Steps: {steps}
                                           
                Use these steps to answer the user query in 
                a detailed and comprehensive manner. Aim to address the inferred intention
                and provide a definitive answer.

                Format your response using Markdown syntax, especially headers, for better readability.

                Do not mention directly the steps, user query, or inferred intention in your response, make the response feel natural. 
                If it is appropriate to be concise, then do be concise. If it is appropriate to be detailed, then do be detailed."""),
                ("human", """Conversation history: {conversation_history}
                """)
            ])

            message = (message_prompt | self.smarter_llm | StrOutputParser()).invoke({
                "DEFAULT_HEADER": DEFAULT_HEADER,
                "intention": intention,
                "steps": json.dumps(steps),
                "conversation_history": conversation_history
            }, callbacks=run_manager.get_child() if run_manager else None)

            logging.info("Multi-step reasoning completed successfully")
            logging.info(f"Final response: {message}")
            return {
                "message": message,
                "steps": steps
            }
        except Exception as e:
            logging.error(f"Error in multi-step reasoning: {str(e)}")
            if run_manager:
                run_manager.on_chain_error(e)
            return {
                "message": "An error occurred while processing your request. Please try again.",
                "steps": []
            }
        finally:
            if run_manager:
                run_manager.on_chain_end({})

    def plan_actions(self, intention, conversation_history, strategy_data, run_manager: CallbackManagerForChainRun = None):
        logging.info("Planning actions")
        
        if run_manager:
            run_manager.on_chain_start({"name": "Action Planning"}, {})
        
        message = f"""
# Plan Actions Strategy

## Conversation History
{conversation_history}

## Inferred Intention
{intention}

## Strategy Rationale
{strategy_data['rationale']}

This strategy is not yet fully implemented. Here's a placeholder response:

1. Action 1: Description of action 1
2. Action 2: Description of action 2
3. Action 3: Description of action 3
"""

        response = {
            "message": message,
            "steps": [
                {"step": "Action 1", "explanation": "Description of action 1"},
                {"step": "Action 2", "explanation": "Description of action 2"},
                {"step": "Action 3", "explanation": "Description of action 3"}
            ]
        }
        logging.info(f"Planned actions: {response}")
        
        if run_manager:
            run_manager.on_chain_end({})
        
        return response

    def multi_agent_workflow(self, intention, conversation_history, strategy_data, run_manager: CallbackManagerForChainRun = None):
        logging.info("Executing multi-agent workflow")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """{DEFAULT_HEADER}
            RETURN A VALID JSON OBJECT WITH THE FOLLOWING STRUCTURE:
            {{"rationale": "Detailed explanation of why this strategy was chosen", "strategy": 4}}

            REMEMBER TO RETURN A VALID JSON OBJECT AND STRICTLY A VALID JSON OBJECT."""),
            ("human", """Conversation history: {conversation_history}
            Inferred intention: {intention}""")
        ])
        
        strategy_chain = prompt | self.function_calling_llm | StrOutputParser()
        
        if run_manager:
            run_manager.on_chain_start({"name": "Multi-Agent Workflow"}, {})
        
        strategy_json = strategy_chain.invoke({"DEFAULT_HEADER": DEFAULT_HEADER, "conversation_history": conversation_history, "intention": intention}, callbacks=run_manager.get_child() if run_manager else None)
        strategy_data = json.loads(strategy_json)
        
        message = f"""
# Multi-Agent Workflow Strategy

## Conversation History
{conversation_history}

## Inferred Intention
{intention}

## Strategy Rationale
{strategy_data['rationale']}

This strategy is not yet fully implemented. Here's a placeholder response:

1. Agent 1 Task: Description of Agent 1's task
2. Agent 2 Task: Description of Agent 2's task
3. Agent 3 Task: Description of Agent 3's task
"""

        response = {
            "message": message,
            "steps": [
                {"step": "Agent 1 Task", "explanation": "Description of Agent 1's task"},
                {"step": "Agent 2 Task", "explanation": "Description of Agent 2's task"},
                {"step": "Agent 3 Task", "explanation": "Description of Agent 3's task"}
            ]
        }
        logging.info(f"Multi-agent workflow: {response}")
        
        if run_manager:
            run_manager.on_chain_end({})
        
        return response

class LLMInteractionChain(Chain):
    llm_interaction: LLMInteraction = Field(default_factory=LLMInteraction)
    
    class Config:
        arbitrary_types_allowed = True

    @property
    def input_keys(self) -> List[str]:
        return ["conversation_history"]

    @property
    def output_keys(self) -> List[str]:
        return ["output"]

    def _call(self, inputs: Dict[str, Any], run_manager: CallbackManagerForChainRun) -> Dict[str, Any]:
        conversation_history = inputs["conversation_history"]
        run_manager.on_chain_start({"name": "LLM Interaction"}, inputs)
        result = self.llm_interaction.get_response(conversation_history, run_manager=run_manager)
        run_manager.on_chain_end({"outputs": result})
        return {"output": result}

if __name__ == "__main__":
    DEBUG = True
    setup_logging()
    logging.info("Starting test execution")
    
    llm_interaction = LLMInteraction()
    chain = LLMInteractionChain(llm_interaction=llm_interaction)
    
    result = chain.run("###USER###\nI've been trying to lose weight for months, but nothing seems to work. What am I doing wrong?\n###END###")
    print(result)
    logging.info("Test execution completed")
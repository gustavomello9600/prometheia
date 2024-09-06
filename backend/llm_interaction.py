import os
import logging
import json
from typing import Dict, List, Any
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import RetryOutputParser
from langchain_core.output_parsers import JsonOutputParser 
from langchain_core.output_parsers import StrOutputParser
from langsmith import traceable, trace

from prompts import PROMPTS
from llm_models import QuickLLM, SmarterLLM, FunctionCallingLLM

DEBUG = False


def setup_logging():
    logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO,
                        format='%(asctime)s - %(levelname)s - %(message)s')
    logging.getLogger().setLevel(logging.INFO)


class StrategySelection(BaseModel):
    rationale: str = Field(description="Detailed explanation of why this strategy was chosen")
    strategy: int = Field(description="Selected strategy number (1, 2, 3, or 4)")


class ReasoningStep(BaseModel):
    step: str = Field(description="A step in the reasoning process")
    explanation: str = Field(description="Explanation of the reasoning step")


class MultiStepReasoning(BaseModel):
    steps: List[ReasoningStep] = Field(description="List of reasoning steps")


class LLMInteraction:
    def __init__(self):
        logging.info("Initializing LLM models")
        self.quick_llm = QuickLLM()
        self.smarter_llm = SmarterLLM()
        self.function_calling_llm = FunctionCallingLLM()
        logging.info("LLM models initialized successfully")

        self.strategy_parser = PydanticOutputParser(pydantic_object=StrategySelection)
        self.reasoning_parser = PydanticOutputParser(pydantic_object=MultiStepReasoning)

    def get_response(self, conversation_history):
        logging.info("Processing conversation history")
        messages = conversation_history.split('###END###\n')
        messages = [msg.strip() for msg in messages if msg.strip()]

        last_message = messages[-1].split('\n', 1)[1]  # Get the content of the last message

        relevant_points = self.digest_conversation_history(conversation_history)
        logging.info(f"Relevant points from conversation history: {relevant_points}")

        combined_input = f"{last_message}\n\nRelevant points from previous conversation:\n{relevant_points}"

        intention = self.infer_user_intention(combined_input)
        logging.info(f"Inferred intention: {intention}")

        strategy = self.select_strategy(intention, combined_input)
        logging.info(f"Selected strategy: {strategy.strategy}")

        response = self.execute_strategy(strategy, intention, conversation_history)
        logging.info("Response generated successfully")
        return response

    @traceable(run_type="chain")
    def digest_conversation_history(self, conversation_history):
        logging.info("Digesting conversation history")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['digest_conversation'])
        digest_chain = prompt | self.quick_llm | StrOutputParser()

        relevant_points = digest_chain.invoke({"conversation_history": conversation_history})
        return relevant_points

    @traceable(run_type="chain")
    def infer_user_intention(self, combined_input):
        logging.info("Inferring user intention")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['infer_intention'])
        intention_chain = prompt | self.quick_llm | StrOutputParser()

        intention = intention_chain.invoke({"combined_input": combined_input})

        logging.info(f"Inferred intention: {intention}")
        return intention

    @traceable(run_type="chain")
    def select_strategy(self, intention, combined_input):
        logging.info("Selecting strategy")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['select_strategy'])
        
        retry_parser = RetryOutputParser.from_llm(
            parser=self.strategy_parser,
            llm=self.function_calling_llm,
            max_retries=3
        )

        # Create the chain without the retry parser
        strategy_chain = prompt | self.function_calling_llm

        # Invoke the chain and get the raw output
        raw_output = strategy_chain.invoke({"intention": intention, "combined_input": combined_input})

        # Extract the text content from the raw output
        if isinstance(raw_output, dict) and 'generations' in raw_output:
            text_output = raw_output['generations'][0][0].text
        elif hasattr(raw_output, 'content'):
            text_output = raw_output.content
        else:
            text_output = str(raw_output)

        # Use parse_with_prompt to handle the retry logic
        strategy_data = retry_parser.parse_with_prompt(text_output, prompt)

        logging.info(f"Output from strategy selector: {strategy_data}")
        return strategy_data

    def execute_strategy(self, strategy, intention, conversation_history):
        logging.info(f"Executing strategy: {strategy.strategy}")
        if strategy.strategy == 1:
            return self.standard_response(intention, conversation_history)
        elif strategy.strategy == 2:
            return self.multi_step_reasoning(intention, conversation_history)
        elif strategy.strategy == 3:
            return self.plan_actions(intention, conversation_history, strategy)
        elif strategy.strategy == 4:
            return self.multi_agent_workflow(intention, conversation_history, strategy)
        else:
            logging.warning(f"Unknown strategy {strategy.strategy}, falling back to multi-step reasoning")
            return self.multi_step_reasoning(intention, conversation_history)

    @traceable(run_type="chain")
    def standard_response(self, intention, conversation_history):
        logging.info("Generating standard response")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['standard_response'])
        response_chain = prompt | self.smarter_llm | StrOutputParser()

        message = response_chain.invoke({"DEFAULT_HEADER": PROMPTS['default_header'], "intention": intention, "conversation_history": conversation_history})

        logging.info("Standard response generated")
        logging.info(f"Response: {message}")
        return {"message": message, "steps": []}

    @traceable(run_type="chain")
    def multi_step_reasoning(self, intention, conversation_history):
        logging.info("Performing multi-step reasoning")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['multi_step_reasoning'])
        
        retry_parser = RetryOutputParser.from_llm(
            parser=self.reasoning_parser,
            llm=self.function_calling_llm,
            max_retries=3
        )

        # Create the chain without the retry parser
        reasoning_chain = prompt | self.function_calling_llm
        
        # Extract the last message from conversation history
        messages = conversation_history.split('###END###\n')
        last_message = messages[-1].split('\n', 1)[1] if messages else ""

        combined_input = f"{last_message}\n\nRelevant points from previous conversation:\n{self.digest_conversation_history(conversation_history)}"
        
        # Invoke the chain and get the raw output
        raw_output = reasoning_chain.invoke({
            "conversation_history": conversation_history,
            "combined_input": combined_input
        })
        
        if isinstance(raw_output, dict) and 'generations' in raw_output:
            text_output = raw_output['generations'][0][0].text
        elif hasattr(raw_output, 'content'):
            text_output = raw_output.content
        else:
            text_output = str(raw_output)

        response = retry_parser.parse_with_prompt(text_output, prompt)
        
        steps = response.steps

        logging.info(f"Generated {len(steps)} reasoning steps")
        for i, step in enumerate(steps, 1):
            logging.info(f"Step {i}: {step.step}")
            logging.info(f"Explanation: {step.explanation}")

        message_prompt = ChatPromptTemplate.from_messages(PROMPTS['multi_step_reasoning_response'])

        message = (message_prompt | self.smarter_llm | StrOutputParser()).invoke(
            {
                "DEFAULT_HEADER": PROMPTS['default_header'],
                "intention": intention,
                "steps": json.dumps([step.dict() for step in steps]),
                "conversation_history": conversation_history
            }
        )

        logging.info("Multi-step reasoning completed successfully")
        logging.info(f"Final response: {message}")
        return {
            "message": message,
            "steps": [step.dict() for step in steps]
        }

    @traceable(run_type="chain")
    def plan_actions(self, intention, conversation_history, strategy_data):
        logging.info("Planning actions")

        message = f"""
        # Plan Actions Strategy

        ## Conversation History
        {conversation_history}

        ## Inferred Intention
        {intention}

        ## Strategy Rationale
        {strategy_data.rationale}

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
        return response

    @traceable(run_type="chain")
    def multi_agent_workflow(self, intention, conversation_history, strategy_data):
        logging.info("Executing multi-agent workflow")

        message = f"""
        # Multi-Agent Workflow Strategy

        ## Conversation History
        {conversation_history}

        ## Inferred Intention
        {intention}

        ## Strategy Rationale
        {strategy_data.rationale}

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
        return response


if __name__ == "__main__":
    from dotenv import load_dotenv
    import os

    # Load environment variables from .env file
    load_dotenv()

    # Access environment variables
    LANGCHAIN_TRACING_V2 = os.getenv('LANGCHAIN_TRACING_V2')
    LANGCHAIN_API_KEY = os.getenv('LANGCHAIN_API_KEY')
    LANGCHAIN_PROJECT = os.getenv('LANGCHAIN_PROJECT')

    # Set environment variables
    os.environ['LANGCHAIN_TRACING_V2'] = LANGCHAIN_TRACING_V2
    os.environ['LANGCHAIN_API_KEY'] = LANGCHAIN_API_KEY
    os.environ['LANGCHAIN_PROJECT'] = LANGCHAIN_PROJECT

    DEBUG = True
    setup_logging()
    logging.info("Starting test execution")

    llm_interaction = LLMInteraction()

    # Add trace for get_response call
    with trace("get_response_test", run_type="chain") as run:
        result = llm_interaction.get_response("###USER###\nI've been trying to lose weight for months, but nothing seems to work. What am I doing wrong?\n###END###")
        run.end(outputs={"result": result})

    print(result)
    logging.info("Test execution completed")
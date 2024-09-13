import os
import logging
import json
from typing import Dict, List, Any, Generator
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from groq import InternalServerError as GroqInternalServerError
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import RetryOutputParser
from langchain_core.output_parsers import JsonOutputParser 
from langchain_core.output_parsers import StrOutputParser
from langsmith import traceable, trace
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type, RetryError

from prompts import PROMPTS
from llm_models import QuickLLM, SmarterLLM, FunctionCallingLLM


STRATEGY_IDENTIFIER = {
    1: "Direct Response",
    2: "Multi-Step Reasoning",
    3: "Action Plan",
    4: "Multi-Agent Workflow"
}


groq_retry = retry(
    retry=retry_if_exception_type(GroqInternalServerError),
    wait=wait_exponential(multiplier=2, min=4, max=10),
    stop=stop_after_attempt(3)
)
json_retry = retry(
    retry=retry_if_exception_type(json.JSONDecodeError),
    wait=wait_exponential(multiplier=2, min=4, max=10),
    stop=stop_after_attempt(3)
)


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

    @traceable(run_type="chain")
    def get_response_stream(self, conversation_history: str) -> Generator[Dict[str, Any], None, None]:
        logging.info("Processing conversation history for streaming")
        messages = conversation_history.split('###END###\n')
        messages = [msg.strip() for msg in messages if msg.strip()]

        last_message = messages[-1].split('\n', 1)[1]  # Get the content of the last message

        try:
            yield {'type': 'steps', 'data': {'step': 'Understanding context', 'explanation': 'Interpreting conversation history'}}
            relevant_points = self.digest_conversation_history(conversation_history)
            logging.info(f"Relevant points from conversation history: {relevant_points}")
            yield {'type': 'steps', 'data': {'step': 'Understanding context', 'explanation': f'{relevant_points}'}}

            combined_input = f"{last_message}\n\nRelevant points from previous conversation:\n{relevant_points}"

            yield {'type': 'steps', 'data': {'step': 'Understanding intent', 'explanation': 'Inferring user\'s intent'}}
            intention = self.infer_user_intention(combined_input)
            logging.info(f"Inferred intention: {intention}")
            yield {'type': 'steps', 'data': {'step': 'Understanding intent', 'explanation': f'{intention}'}}

            yield {'type': 'steps', 'data': {'step': 'Selecting strategy', 'explanation': 'Reasoning on the best response method'}}
            strategy = self.select_strategy(intention, combined_input)
            logging.info(f"Selected strategy: {strategy.strategy}")
            yield {'type': 'strategy', 'data': STRATEGY_IDENTIFIER[strategy.strategy]}
            yield {'type': 'steps', 'data': {'step': 'Selecting strategy', 'explanation': f'{strategy.rationale}\n\nStrategy selected: {STRATEGY_IDENTIFIER[strategy.strategy]}'}}

            yield from self.execute_strategy_stream(strategy, intention, conversation_history, combined_input)
        
        except RetryError as e:
            yield {'type': 'error', 'data': str(e)}

    def execute_strategy_stream(self, strategy, intention, conversation_history, combined_input):
        logging.info(f"Executing strategy: {strategy.strategy}")
        if strategy.strategy == 1:
            yield from self.standard_response_stream(intention, conversation_history)
        elif strategy.strategy == 2:
            yield from self.multi_step_reasoning_stream(intention, conversation_history, combined_input)
        elif strategy.strategy == 3:
            yield from self.plan_actions_stream(intention, conversation_history, strategy)
        elif strategy.strategy == 4:
            yield from self.multi_agent_workflow_stream(intention, conversation_history, strategy)
        else:
            logging.warning(f"Unknown strategy {strategy.strategy}, falling back to multi-step reasoning")
            yield from self.multi_step_reasoning_stream(intention, conversation_history, combined_input)

    @traceable(run_type="chain")
    @groq_retry
    def standard_response_stream(self, intention, conversation_history):
        yield {'type': 'steps', 'data': {'step': 'Generating response', 'explanation': 'Generating a standard response'}}
        logging.info("Generating standard response stream")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['standard_response'])
        response_chain = prompt | self.smarter_llm

        for chunk in response_chain.stream({"DEFAULT_HEADER": PROMPTS['default_header'], "intention": intention, "conversation_history": conversation_history}):
            if chunk.content:
                yield {"type": "content", "data": chunk.content}

    @traceable(run_type="chain")
    @groq_retry
    @json_retry
    def multi_step_reasoning_stream(self, intention, conversation_history, combined_input):
        logging.info("Performing multi-step reasoning stream")

        prompt = ChatPromptTemplate.from_messages(PROMPTS['multi_step_reasoning'])
        reasoning_chain = prompt | self.function_calling_llm | self.reasoning_parser
        steps_data = reasoning_chain.invoke({"conversation_history": conversation_history, "combined_input": combined_input})
            
        for step in steps_data.steps:
            yield {"type": "steps", "data": step.dict()}

        message_prompt = ChatPromptTemplate.from_messages(PROMPTS['multi_step_reasoning_response'])
        for chunk in (message_prompt | self.smarter_llm).stream({
            "DEFAULT_HEADER": PROMPTS['default_header'],
            "intention": intention,
            "steps": json.dumps([step.dict() for step in steps_data.steps]),
            "conversation_history": conversation_history
        }):
            if chunk.content:
                yield {"type": "content", "data": chunk.content}

    @traceable(run_type="chain")
    @groq_retry
    def plan_actions_stream(self, intention, conversation_history, strategy_data):
        logging.info("Planning actions stream")
        # Implement streaming for plan_actions
        yield {"type": "warning", "data": "Plan Actions Strategy feature not fully implemented yet. Falling back to direct response."}
        yield from self.standard_response_stream(intention, conversation_history)

    @traceable(run_type="chain")
    @groq_retry
    def multi_agent_workflow_stream(self, intention, conversation_history, strategy_data):
        logging.info("Executing multi-agent workflow stream")
        # Implement streaming for multi_agent_workflow
        yield {"type": "warning", "data": "Multi-Agent Workflow Strategy feature not fully implemented yet. Falling back to direct response."}
        yield from self.standard_response_stream(intention, conversation_history)

    @traceable(run_type="chain")
    @groq_retry
    def digest_conversation_history(self, conversation_history):
        logging.info("Digesting conversation history")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['digest_conversation'])
        digest_chain = prompt | self.quick_llm | StrOutputParser()

        relevant_points = digest_chain.invoke({"conversation_history": conversation_history})
        return relevant_points

    @traceable(run_type="chain")
    @groq_retry
    def infer_user_intention(self, combined_input):
        logging.info("Inferring user intention")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['infer_intention'])
        intention_chain = prompt | self.quick_llm | StrOutputParser()

        intention = intention_chain.invoke({"combined_input": combined_input})

        logging.info(f"Inferred intention: {intention}")
        return intention

    @traceable(run_type="chain")
    @groq_retry
    @json_retry
    def select_strategy(self, intention, combined_input):
        logging.info("Selecting strategy")

        prompt = ChatPromptTemplate.from_messages(PROMPTS['select_strategy'])
        strategy_chain = prompt | self.function_calling_llm | self.strategy_parser
        strategy_data = strategy_chain.invoke({"intention": intention, "combined_input": combined_input})

        logging.info(f"Output from strategy selector: {strategy_data}")
        return strategy_data


if __name__ == "__main__":
    from dotenv import load_dotenv
    import os
    import asyncio

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

    # Test conversation history
    test_conversation = """###USER###
I've been trying to lose weight for months, but nothing seems to work. What am I doing wrong?
###END###"""

    # Function to process the stream
    async def process_stream():
        print("Starting stream processing...")
        async for chunk in llm_interaction.get_response_stream(test_conversation):
            if chunk['type'] == 'steps':
                print("\nSteps:")
                for step in chunk['data']:
                    print(f"- {step['step']}")
                    print(f"  Explanation: {step['explanation']}")
            elif chunk['type'] == 'content':
                print(chunk['data'], end='', flush=True)
        print("\nStream processing completed.")

    # Run the async function
    asyncio.run(process_stream())

    logging.info("Test execution completed")
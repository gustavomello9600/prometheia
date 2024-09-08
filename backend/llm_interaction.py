import os
import logging
import json
from typing import Dict, List, Any, Generator
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

    @traceable(run_type="chain")
    def get_response_stream(self, conversation_history: str) -> Generator[Dict[str, Any], None, None]:
        logging.info("Processing conversation history for streaming")
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

        yield from self.execute_strategy_stream(strategy, intention, conversation_history, combined_input)

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
    def standard_response_stream(self, intention, conversation_history):
        logging.info("Generating standard response stream")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['standard_response'])
        response_chain = prompt | self.smarter_llm

        for chunk in response_chain.stream({"DEFAULT_HEADER": PROMPTS['default_header'], "intention": intention, "conversation_history": conversation_history}):
            if chunk.content:
                yield {"type": "content", "data": chunk.content}

    @traceable(run_type="chain")
    def multi_step_reasoning_stream(self, intention, conversation_history, combined_input):
        logging.info("Performing multi-step reasoning stream")
        prompt = ChatPromptTemplate.from_messages(PROMPTS['multi_step_reasoning'])
        
        retry_parser = RetryOutputParser.from_llm(
            parser=self.reasoning_parser,
            llm=self.function_calling_llm,
            max_retries=3
        )

        reasoning_chain = prompt | self.function_calling_llm
        
        # Generate steps non-streaming
        raw_output = reasoning_chain.invoke({
            "conversation_history": conversation_history,
            "combined_input": combined_input
        })

        # Extract the text content from the raw output
        if isinstance(raw_output, dict) and 'generations' in raw_output:
            text_output = raw_output['generations'][0][0].text
        elif hasattr(raw_output, 'content'):
            text_output = raw_output.content
        else:
            text_output = str(raw_output)

        # Use parse_with_prompt to handle the retry logic
        steps_data = retry_parser.parse_with_prompt(text_output, prompt)

        # Yield steps as a single chunk
        yield {"type": "steps", "data": [step.dict() for step in steps_data.steps]}

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
    def plan_actions_stream(self, intention, conversation_history, strategy_data):
        logging.info("Planning actions stream")
        # Implement streaming for plan_actions
        yield {"type": "content", "data": "Plan Actions Strategy not fully implemented for streaming."}

    @traceable(run_type="chain")
    def multi_agent_workflow_stream(self, intention, conversation_history, strategy_data):
        logging.info("Executing multi-agent workflow stream")
        # Implement streaming for multi_agent_workflow
        yield {"type": "content", "data": "Multi-Agent Workflow Strategy not fully implemented for streaming."}

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
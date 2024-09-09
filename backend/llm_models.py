import json
import logging
import os
import re
import time
from typing import Optional

from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import LLMResult
from requests.exceptions import RequestException
from langchain_groq.chat_models import ChatGroq
from groq import InternalServerError as GroqInternalServerError
from dotenv import load_dotenv
from pathlib import Path


env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


class QuickLLM(ChatGroq):
    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama-3.1-8b-instant",
            temperature=0.2
        )

class SmarterLLM(ChatGroq):
    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama-3.1-70b-versatile",
            temperature=0.2
        )

class FunctionCallingLLM(ChatGroq):

    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama3-groq-70b-8192-tool-use-preview",
            temperature=0.2
        )

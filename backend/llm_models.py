import json
import logging
import os
import re
import time
from typing import Optional

from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import LLMResult
from requests.exceptions import RequestException
from werkzeug.exceptions import InternalServerError
from langchain_groq.chat_models import ChatGroq


GROQ_API_KEY = "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"


class RetryCallbackHandler(BaseCallbackHandler):
    def __init__(self, max_retries=5, retry_delay=1):
        self.max_retries = max_retries
        self.retry_delay_initial = retry_delay
        self.retry_delay = retry_delay
        self.current_retry = 0

    def on_llm_error(self, error: Exception, **kwargs) -> None:
        if isinstance(error, (RequestException, InternalServerError)) and self.current_retry < self.max_retries:
            self.current_retry += 1
            logging.warning(f"API error (attempt {self.current_retry}/{self.max_retries}): {str(error)}. Retrying in {self.retry_delay} seconds...")
            time.sleep(self.retry_delay)
            self.retry_delay *= 2  # Exponential backoff
        else:
            logging.error(f"Error after {self.current_retry} attempts: {str(error)}")
            raise error

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        self.current_retry = 0
        self.retry_delay = self.retry_delay_initial


class QuickLLM(ChatGroq):
    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama-3.1-8b-instant",
            temperature=0.2,
            callbacks=[RetryCallbackHandler()]
        )

class SmarterLLM(ChatGroq):
    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama-3.1-70b-versatile",
            temperature=0.2,
            callbacks=[RetryCallbackHandler()]
        )

class FunctionCallingLLM(ChatGroq):

    def __init__(self):
        super().__init__(
            groq_api_key=GROQ_API_KEY,
            model="llama3-groq-70b-8192-tool-use-preview",
            temperature=0.2,
            callbacks=[RetryCallbackHandler()]
        )

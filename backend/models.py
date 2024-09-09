from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    id: Optional[int] = None
    email: str
    password_hash: str
    name: Optional[str] = None

class Agent(BaseModel):
    id: Optional[int] = None
    name: str
    type: str
    description: Optional[str] = None

class Tool(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    api_endpoint: Optional[str] = None

class Task(BaseModel):
    id: Optional[int] = None
    user_id: int
    request: str
    status: str = 'Pending'
    result: Optional[str] = None
    plan: Optional[dict] = None
    mode: Optional[str] = None

class Conversation(BaseModel):
    id: Optional[int] = None
    user_id: int
    title: str
    date: datetime

class Message(BaseModel):
    id: Optional[int] = None
    conversation_id: int
    type: str
    content: str
    timestamp: datetime
    steps: Optional[List[dict]] = None
import os
from datetime import timedelta

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///ai_agent.db' 
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = 'Wxh7ucB6n1ZpL2uSInvk/5Hl5WzgFFuPBhVfy0x6G0U='
    JWT_ALGORITHM = 'HS256'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=4)  # Set the expiration to 1 hour
import os
from datetime import timedelta

class Config:
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
    JWT_SECRET_KEY = 'Wxh7ucB6n1ZpL2uSInvk/5Hl5WzgFFuPBhVfy0x6G0U='
    JWT_ALGORITHM = 'HS256'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=4)
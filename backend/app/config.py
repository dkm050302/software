from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "AI Tutor API"
    SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    
    # Database Config
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    
    # External Services
    DASHSCOPE_API_KEY: Optional[str] = None
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    # DeepSeek Config
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"

    class Config:
        import os
        # Get the directory of the current file (app/config.py)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up one level to backend/
        backend_dir = os.path.dirname(current_dir)
        env_file = os.path.join(backend_dir, ".env")

settings = Settings()

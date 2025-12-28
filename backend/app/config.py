from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "AI Tutor API"
    SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database Config
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    
    # External Services
    OPENAI_API_KEY: Optional[str] = None
    
    # DeepSeek Config
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"

    # DASHSCOPE Config
    DASHSCOPE_API_KEY: Optional[str] = None

    NOTE_DIR: Path = Path("data/notes")
    NOTE_DIR.mkdir(parents=True, exist_ok=True)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

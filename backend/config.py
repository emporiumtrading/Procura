"""
Procura Backend Configuration
Loads all environment variables and provides type-safe access
"""
import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # ===========================================
    # Supabase Configuration
    # ===========================================
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None  # Optional for dev (use anon key)
    SUPABASE_ANON_KEY: Optional[str] = None
    
    # ===========================================
    # Redis / Celery Configuration
    # ===========================================
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: Optional[str] = None  # Falls back to REDIS_URL
    CELERY_RESULT_BACKEND: Optional[str] = None  # Falls back to REDIS_URL
    
    # ===========================================
    # API Keys - Discovery Sources
    # ===========================================
    GOVCON_API_KEY: Optional[str] = None
    SAM_GOV_API_KEY: Optional[str] = None
    GRANTS_GOV_API_KEY: Optional[str] = None
    USASPENDING_API_KEY: Optional[str] = None
    USASPENDING_API_BASE: Optional[str] = "https://api.usaspending.gov/api/v2"
    NEWS_API_KEY: Optional[str] = None
    NEWS_API_BASE: Optional[str] = "https://newsapi.org/v2"
    
    # ===========================================
    # LLM Provider Configuration
    # ===========================================
    PROCURA_LLM_PROVIDER: str = "anthropic"  # anthropic, openai, google
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    
    # LLM Settings
    LLM_MODEL: str = "claude-3-5-sonnet-20241022"
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.3
    
    # ===========================================
    # Security Configuration
    # ===========================================
    VAULT_ENCRYPTION_KEY: Optional[str] = None  # 32-byte base64 encoded key for Fernet
    AUDIT_SIGNING_KEY: Optional[str] = None  # HMAC secret for audit log signatures
    JWT_SECRET_KEY: Optional[str] = None  # For local JWT validation
    
    # ===========================================
    # OpenManus Configuration
    # ===========================================
    OPENMANUS_API_URL: str = "http://localhost:8080"
    OPENMANUS_API_KEY: Optional[str] = None
    OPENMANUS_TIMEOUT_SECONDS: int = 300  # 5 minutes for form submission
    
    # ===========================================
    # Application Settings
    # ===========================================
    ENVIRONMENT: str = "development"  # development, staging, production
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # CORS
    PROCURA_ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Discovery Settings
    DISCOVERY_DEFAULT_INTERVAL_MINUTES: int = 15
    DISCOVERY_MAX_RETRIES: int = 3
    
    # ===========================================
    # Computed Properties
    # ===========================================
    
    @property
    def celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL
    
    @property
    def celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL
    
    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.PROCURA_ALLOWED_ORIGINS.split(",")]
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def supabase_key(self) -> str:
        """Return service role key if available, otherwise anon key"""
        return self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_ANON_KEY or ""
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Convenience alias
settings = get_settings()


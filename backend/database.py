from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration - supports both SQLite and Oracle
def get_database_url():
    # Check if Oracle configuration is provided
    oracle_user = os.getenv("ORACLE_USER")
    oracle_password = os.getenv("ORACLE_PASSWORD")
    oracle_connect_string = os.getenv("ORACLE_CONNECT_STRING")
    
    if oracle_user and oracle_password and oracle_connect_string:
        # Oracle configuration
        return f"oracle+cx_oracle://{oracle_user}:{oracle_password}@{oracle_connect_string}"
    else:
        # Fallback to SQLite
        return os.getenv("DATABASE_URL", "sqlite:///./test.db")

DATABASE_URL = get_database_url()

# Configure engine based on database type
if DATABASE_URL.startswith("oracle"):
    # Oracle specific configuration
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        pool_pre_ping=True,
        pool_recycle=300
    )
else:
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
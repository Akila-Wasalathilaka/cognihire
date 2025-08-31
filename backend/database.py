from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import cx_Oracle
import os

# Oracle database connection
DATABASE_URL = os.getenv("DATABASE_URL", "oracle+cx_oracle://username:password@hostname:port/service_name")

engine = create_engine(DATABASE_URL, echo=False)  # Set echo=False for production

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
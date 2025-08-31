from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, users, assessments, games
import os

# Try to create database tables
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")
except Exception as e:
    print(f"Warning: Could not create database tables: {e}")
    print("Make sure Oracle database is properly configured")

app = FastAPI(
    title="CogniHire API",
    version="1.0.0",
    description="Cognitive Assessment Platform API"
)

# CORS middleware - configurable for different environments
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth, prefix="/auth", tags=["Authentication"])
app.include_router(users, prefix="/users", tags=["Users"])
app.include_router(assessments, prefix="/assessments", tags=["Assessments"])
app.include_router(games, prefix="/games", tags=["Games"])

@app.get("/")
async def root():
    return {"message": "CogniHire API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
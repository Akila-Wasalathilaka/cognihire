from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from database import get_db
from models import User, Tenant, CandidateProfile, JobRole
from routers.auth import get_current_admin_user, get_password_hash, log_audit_action
import secrets
import string
import re

router = APIRouter()

class CreateCandidateRequest(BaseModel):
    email: str
    full_name: str
    job_role_id: str = None
    username: str = None

def generate_username_from_name(full_name: str) -> str:
    """Generate username from full name by taking first name + first letter of last name"""
    # Remove special characters and split by spaces
    clean_name = re.sub(r'[^a-zA-Z\s]', '', full_name.strip())
    name_parts = clean_name.lower().split()
    
    if len(name_parts) == 1:
        # Only first name
        return name_parts[0]
    elif len(name_parts) >= 2:
        # First name + first letter of last name
        return f"{name_parts[0]}{name_parts[-1][0]}"
    else:
        # Fallback
        return clean_name.lower().replace(' ', '')

def generate_password(length: int = 8) -> str:
    """Generate a secure random password"""
    # Mix of uppercase, lowercase, digits and special characters
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%"
    
    # Ensure at least one character from each category
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]
    
    # Fill the rest randomly
    all_chars = uppercase + lowercase + digits + special
    for _ in range(length - 4):
        password.append(secrets.choice(all_chars))
    
    # Shuffle the password
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)

@router.post("/")
async def create_candidate(
    candidate_data: CreateCandidateRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Check if email already exists
    if db.query(User).filter(User.email == candidate_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate job role if provided
    job_role = None
    if candidate_data.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == candidate_data.job_role_id).first()
        if not job_role:
            raise HTTPException(status_code=400, detail="Job role not found")
    
    # Generate username from full name
    base_username = generate_username_from_name(candidate_data.full_name)
    username = base_username
    
    # Check if username already exists and add suffix if needed
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    # Generate secure password
    password = generate_password(8)
    
    # Get tenant
    tenant = db.query(Tenant).first()
    if not tenant:
        raise HTTPException(status_code=500, detail="No tenant found")
    
    # Create user
    user = User(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        username=username,
        email=candidate_data.email,
        password_hash=get_password_hash(password),
        role="CANDIDATE",
        is_active=True
    )
    db.add(user)
    
    # Create candidate profile
    profile = CandidateProfile(
        user_id=user.id,
        full_name=candidate_data.full_name,
        job_role_id=candidate_data.job_role_id
    )
    db.add(profile)
    
    db.commit()
    
    # Log audit action
    log_audit_action(
        db, 
        current_user.id, 
        "CREATE_CANDIDATE", 
        "USER", 
        user.id, 
        {
            "email": candidate_data.email, 
            "full_name": candidate_data.full_name,
            "job_role_id": candidate_data.job_role_id,
            "username": username
        }
    )
    
    return {
        "message": "Candidate created successfully",
        "candidate": {
            "id": user.id,
            "username": username,
            "email": candidate_data.email,
            "full_name": candidate_data.full_name,
            "job_role_id": candidate_data.job_role_id,
            "job_role_title": job_role.title if job_role else None,
            "password": password,  # Return password for admin to share with candidate
            "login_instructions": f"Username: {username}, Password: {password}"
        }
    }

@router.get("/")
async def get_candidates(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role == "CANDIDATE")
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    candidates = query.offset(skip).limit(limit).all()
    
    result = []
    for candidate in candidates:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first()
        result.append({
            "id": candidate.id,
            "username": candidate.username,
            "email": candidate.email,
            "full_name": profile.full_name if profile else None,
            "is_active": candidate.is_active,
            "created_at": candidate.created_at,
            "last_login_at": candidate.last_login_at
        })
    
    return result
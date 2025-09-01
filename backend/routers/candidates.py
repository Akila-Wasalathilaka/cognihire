from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from database import get_db
from models import User, Tenant, CandidateProfile
from routers.auth import get_current_admin_user, get_password_hash, log_audit_action
import secrets
import string

router = APIRouter()

class CreateCandidateRequest(BaseModel):
    email: str
    full_name: str
    username: str = None

@router.post("/")
async def create_candidate(
    candidate_data: CreateCandidateRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Check if email already exists
    if db.query(User).filter(User.email == candidate_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate username if not provided
    username = candidate_data.username
    if not username:
        username = candidate_data.email.split('@')[0]
    
    # Check if username already exists
    if db.query(User).filter(User.username == username).first():
        # Add random suffix if username exists
        username = f"{username}_{secrets.randbelow(9999):04d}"
    
    # Generate random password
    password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    
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
        full_name=candidate_data.full_name
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
        {"email": candidate_data.email, "full_name": candidate_data.full_name}
    )
    
    return {
        "message": "Candidate created successfully",
        "candidate": {
            "id": user.id,
            "username": username,
            "email": candidate_data.email,
            "full_name": candidate_data.full_name,
            "password": password  # Return password for admin to share with candidate
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
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid
from database import get_db
from models import User, CandidateProfile, JobRole, Assessment, Tenant
from routers.auth import get_current_admin_user, log_audit_action
import random
import string

router = APIRouter()

# Pydantic models
class CandidateCreate(BaseModel):
    email: str
    full_name: str
    job_role_id: Optional[str] = None

class CandidateUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    job_role_id: Optional[str] = None
    is_active: Optional[bool] = None

class CandidateResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    job_role_id: Optional[str]
    job_role_title: Optional[str]
    is_active: bool
    created_at: str
    last_login_at: Optional[str]
    assessment_count: int
    completed_assessments: int

def generate_random_password(length: int = 12) -> str:
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(random.choice(characters) for i in range(length))

def generate_username(email: str) -> str:
    """Generate a username from email"""
    base_username = email.split('@')[0].lower()
    # Remove special characters and limit length
    username = ''.join(c for c in base_username if c.isalnum() or c in '._-')[:20]

    # Ensure uniqueness by appending numbers if needed
    return username

@router.post("/", response_model=CandidateResponse)
async def create_candidate(
    candidate_data: CandidateCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == candidate_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Get tenant
    tenant = db.query(Tenant).first()
    if not tenant:
        tenant = Tenant(
            id=str(uuid.uuid4()),
            name="Default Tenant",
            subdomain="default"
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

    # Generate username and password
    username = generate_username(candidate_data.email)
    # Ensure username uniqueness
    counter = 1
    original_username = username
    while db.query(User).filter(User.username == username).first():
        username = f"{original_username}{counter}"
        counter += 1

    password = generate_random_password()

    # Create user
    from routers.auth import get_password_hash
    db_user = User(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        username=username,
        email=candidate_data.email,
        password_hash=get_password_hash(password),
        role="CANDIDATE",
        is_active=True
    )
    db.add(db_user)

    # Create candidate profile
    db_profile = CandidateProfile(
        user_id=db_user.id,
        full_name=candidate_data.full_name,
        job_role_id=candidate_data.job_role_id
    )
    db.add(db_profile)

    db.commit()
    db.refresh(db_user)

    # Get job role title if provided
    job_role_title = None
    if candidate_data.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == candidate_data.job_role_id).first()
        job_role_title = job_role.title if job_role else None

    # Log creation
    log_audit_action(
        db,
        current_user.id,
        "CREATE_CANDIDATE",
        "USER",
        db_user.id,
        {
            "email": candidate_data.email,
            "full_name": candidate_data.full_name,
            "job_role_id": candidate_data.job_role_id
        }
    )

    return {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "full_name": candidate_data.full_name,
        "job_role_id": candidate_data.job_role_id,
        "job_role_title": job_role_title,
        "is_active": db_user.is_active,
        "created_at": db_user.created_at.isoformat(),
        "last_login_at": db_user.last_login_at.isoformat() if db_user.last_login_at else None,
        "assessment_count": 0,
        "completed_assessments": 0,
        "generated_password": password  # Only returned on creation
    }

@router.get("/", response_model=List[CandidateResponse])
async def get_candidates(
    skip: int = 0,
    limit: int = 100,
    job_role_id: Optional[str] = None,
    status: Optional[str] = None,  # active, inactive
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Build query
    query = db.query(User).filter(User.role == "CANDIDATE")

    if status == "active":
        query = query.filter(User.is_active == True)
    elif status == "inactive":
        query = query.filter(User.is_active == False)

    candidates = query.offset(skip).limit(limit).all()

    result = []
    for candidate in candidates:
        # Get candidate profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first()

        # Get job role info
        job_role_title = None
        if profile and profile.job_role_id:
            job_role = db.query(JobRole).filter(JobRole.id == profile.job_role_id).first()
            job_role_title = job_role.title if job_role else None

        # Get assessment stats
        assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).count()
        completed_count = db.query(Assessment).filter(
            Assessment.candidate_id == candidate.id,
            Assessment.status == "COMPLETED"
        ).count()

        # Filter by job role if specified
        if job_role_id and (not profile or profile.job_role_id != job_role_id):
            continue

        result.append({
            "id": candidate.id,
            "username": candidate.username,
            "email": candidate.email,
            "full_name": profile.full_name if profile else None,
            "job_role_id": profile.job_role_id if profile else None,
            "job_role_title": job_role_title,
            "is_active": candidate.is_active,
            "created_at": candidate.created_at.isoformat(),
            "last_login_at": candidate.last_login_at.isoformat() if candidate.last_login_at else None,
            "assessment_count": assessment_count,
            "completed_assessments": completed_count
        })

    return result

@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get candidate profile
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first()

    # Get job role info
    job_role_title = None
    if profile and profile.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == profile.job_role_id).first()
        job_role_title = job_role.title if job_role else None

    # Get assessment stats
    assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).count()
    completed_count = db.query(Assessment).filter(
        Assessment.candidate_id == candidate.id,
        Assessment.status == "COMPLETED"
    ).count()

    return {
        "id": candidate.id,
        "username": candidate.username,
        "email": candidate.email,
        "full_name": profile.full_name if profile else None,
        "job_role_id": profile.job_role_id if profile else None,
        "job_role_title": job_role_title,
        "is_active": candidate.is_active,
        "created_at": candidate.created_at.isoformat(),
        "last_login_at": candidate.last_login_at.isoformat() if candidate.last_login_at else None,
        "assessment_count": assessment_count,
        "completed_assessments": completed_count
    }

@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: str,
    candidate_data: CandidateUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Update user fields
    if candidate_data.email:
        # Check email uniqueness
        existing = db.query(User).filter(User.email == candidate_data.email, User.id != candidate_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        candidate.email = candidate_data.email

    if candidate_data.is_active is not None:
        candidate.is_active = candidate_data.is_active

    # Update profile
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first()
    if profile:
        if candidate_data.full_name:
            profile.full_name = candidate_data.full_name
        if candidate_data.job_role_id:
            profile.job_role_id = candidate_data.job_role_id
    else:
        # Create profile if it doesn't exist
        profile = CandidateProfile(
            user_id=candidate.id,
            full_name=candidate_data.full_name,
            job_role_id=candidate_data.job_role_id
        )
        db.add(profile)

    db.commit()
    db.refresh(candidate)

    # Get updated data
    job_role_title = None
    if profile and profile.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == profile.job_role_id).first()
        job_role_title = job_role.title if job_role else None

    assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).count()
    completed_count = db.query(Assessment).filter(
        Assessment.candidate_id == candidate.id,
        Assessment.status == "COMPLETED"
    ).count()

    # Log update
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_CANDIDATE",
        "USER",
        candidate_id,
        {
            "email": candidate_data.email,
            "full_name": candidate_data.full_name,
            "job_role_id": candidate_data.job_role_id,
            "is_active": candidate_data.is_active
        }
    )

    return {
        "id": candidate.id,
        "username": candidate.username,
        "email": candidate.email,
        "full_name": profile.full_name if profile else None,
        "job_role_id": profile.job_role_id if profile else None,
        "job_role_title": job_role_title,
        "is_active": candidate.is_active,
        "created_at": candidate.created_at.isoformat(),
        "last_login_at": candidate.last_login_at.isoformat() if candidate.last_login_at else None,
        "assessment_count": assessment_count,
        "completed_assessments": completed_count
    }

@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check if candidate has assessments
    assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate_id).count()
    if assessment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete candidate: {assessment_count} assessments exist"
        )

    # Delete profile first
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    if profile:
        db.delete(profile)

    # Log deletion
    log_audit_action(
        db,
        current_user.id,
        "DELETE_CANDIDATE",
        "USER",
        candidate_id,
        {"email": candidate.email}
    )

    db.delete(candidate)
    db.commit()

    return {"message": "Candidate deleted successfully"}

@router.post("/{candidate_id}/reset-password")
async def reset_candidate_password(
    candidate_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Generate new password
    new_password = generate_random_password()

    # Update password
    from routers.auth import get_password_hash
    candidate.password_hash = get_password_hash(new_password)
    db.commit()

    # Log password reset
    log_audit_action(
        db,
        current_user.id,
        "RESET_CANDIDATE_PASSWORD",
        "USER",
        candidate_id,
        {"email": candidate.email}
    )

    return {
        "message": "Password reset successfully",
        "new_password": new_password,
        "username": candidate.username,
        "email": candidate.email
    }

@router.post("/{candidate_id}/send-invitation")
async def send_candidate_invitation(
    candidate_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # In a real implementation, this would send an email
    # For now, just log the action
    log_audit_action(
        db,
        current_user.id,
        "SEND_CANDIDATE_INVITATION",
        "USER",
        candidate_id,
        {"email": candidate.email}
    )

    return {
        "message": "Invitation sent successfully",
        "email": candidate.email,
        "note": "Email functionality would be implemented here"
    }
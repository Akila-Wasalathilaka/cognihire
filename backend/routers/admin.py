from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Assessment, JobRole, CandidateProfile
from routers.auth import get_current_admin_user
from typing import Dict, Any
from pydantic import BaseModel
import uuid
from passlib.context import CryptContext

router = APIRouter()

# Pydantic models for request/response
class CreateCandidateRequest(BaseModel):
    username: str
    email: str
    full_name: str
    job_role_id: str = None

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/analytics/overview")
async def get_admin_analytics_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """Get overview analytics for admin dashboard"""
    
    # Get total candidates (users who are candidates - case insensitive)
    total_candidates = db.query(User).filter(
        func.lower(User.role) == 'candidate'
    ).count()
    
    # Get active candidates
    active_candidates = db.query(User).filter(
        func.lower(User.role) == 'candidate',
        User.is_active == True
    ).count()
    
    # Get total assessments
    total_assessments = db.query(Assessment).count()
    
    # Get completed assessments
    completed_assessments = db.query(Assessment).filter(
        Assessment.status == 'COMPLETED'
    ).count()
    
    # Get total job roles
    total_job_roles = db.query(JobRole).count()
    
    # Debug: Get all user roles to see what we have
    all_roles = db.query(User.role).distinct().all()
    print(f"Debug - All roles in database: {[role[0] for role in all_roles]}")
    
    return {
        "total_candidates": total_candidates,
        "active_candidates": active_candidates,
        "total_assessments": total_assessments,
        "completed_assessments": completed_assessments,
        "total_job_roles": total_job_roles
    }
    
    return {
        "total_candidates": total_candidates,
        "active_candidates": active_candidates,
        "total_assessments": total_assessments,
        "completed_assessments": completed_assessments,
        "total_job_roles": total_job_roles
    }

@router.get("/candidates")
async def get_admin_candidates(
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all candidates for admin"""
    
    # Query for users who are candidates - case insensitive
    query = db.query(User).filter(
        func.lower(User.role) == 'candidate'
    )
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    candidates = query.all()
    
    result = []
    for candidate in candidates:
        # Get job role info
        job_role = None
        if candidate.job_role_id:
            job_role = db.query(JobRole).filter(JobRole.id == candidate.job_role_id).first()
        
        # Get assessment stats
        assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).count()
        completed_assessments = db.query(Assessment).filter(
            Assessment.candidate_id == candidate.id,
            Assessment.status == 'COMPLETED'
        ).count()
        
        result.append({
            "id": candidate.id,
            "username": candidate.username,
            "email": candidate.email,
            "full_name": candidate.full_name,
            "job_role_id": candidate.job_role_id,
            "job_role_title": job_role.title if job_role else None,
            "is_active": candidate.is_active,
            "created_at": candidate.created_at.isoformat(),
            "last_login_at": candidate.last_login_at.isoformat() if candidate.last_login_at else None,
            "assessment_count": assessment_count,
            "completed_assessments": completed_assessments
        })
    
    return result

@router.post("/candidates")
async def create_admin_candidate(
    candidate_data: CreateCandidateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new candidate"""
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == candidate_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == candidate_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Validate job role if provided
    if candidate_data.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == candidate_data.job_role_id).first()
        if not job_role:
            raise HTTPException(status_code=400, detail="Invalid job role ID")
    
    # Generate a temporary password (user will need to reset it)
    temp_password = f"temp{uuid.uuid4().hex[:8]}"
    hashed_password = pwd_context.hash(temp_password)
    
    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        username=candidate_data.username,
        email=candidate_data.email,
        full_name=candidate_data.full_name,
        password_hash=hashed_password,
        role='candidate',
        job_role_id=candidate_data.job_role_id,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Get job role info for response
    job_role = None
    if new_user.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == new_user.job_role_id).first()
    
    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "job_role_id": new_user.job_role_id,
        "job_role_title": job_role.title if job_role else None,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat(),
        "last_login_at": None,
        "assessment_count": 0,
        "completed_assessments": 0,
        "temporary_password": temp_password  # Only returned on creation
    }

@router.get("/candidates/{candidate_id}")
async def get_admin_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get a specific candidate for admin"""
    
    candidate = db.query(User).filter(
        User.id == candidate_id,
        User.role != 'admin'
    ).first()
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get job role info
    job_role = None
    if candidate.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == candidate.job_role_id).first()
    
    # Get assessment stats
    assessment_count = db.query(Assessment).filter(Assessment.candidate_id == candidate.id).count()
    completed_assessments = db.query(Assessment).filter(
        Assessment.candidate_id == candidate.id,
        Assessment.status == 'COMPLETED'
    ).count()
    
    return {
        "id": candidate.id,
        "username": candidate.username,
        "email": candidate.email,
        "full_name": candidate.full_name,
        "job_role_id": candidate.job_role_id,
        "job_role_title": job_role.title if job_role else None,
        "is_active": candidate.is_active,
        "created_at": candidate.created_at.isoformat(),
        "last_login_at": candidate.last_login_at.isoformat() if candidate.last_login_at else None,
        "assessment_count": assessment_count,
        "completed_assessments": completed_assessments
    }

@router.patch("/candidates/{candidate_id}")
async def update_admin_candidate(
    candidate_id: str,
    update_data: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update a candidate (admin only)"""
    
    candidate = db.query(User).filter(
        User.id == candidate_id,
        User.role != 'admin'
    ).first()
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Update allowed fields
    for field, value in update_data.items():
        if hasattr(candidate, field) and field in ['is_active', 'full_name', 'email']:
            setattr(candidate, field, value)
    
    db.commit()
    db.refresh(candidate)
    
    return {"message": "Candidate updated successfully"}

@router.delete("/candidates/{candidate_id}")
async def delete_admin_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a candidate (admin only)"""
    
    candidate = db.query(User).filter(
        User.id == candidate_id,
        User.role != 'admin'
    ).first()
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Delete related assessments first
    db.query(Assessment).filter(Assessment.candidate_id == candidate_id).delete()
    
    # Delete the candidate
    db.delete(candidate)
    db.commit()
    
    return {"message": "Candidate deleted successfully"}

@router.get("/assessments")
async def get_admin_assessments(
    status: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all assessments for admin"""
    
    query = db.query(Assessment)
    
    if status:
        query = query.filter(Assessment.status == status)
    
    assessments = query.all()
    
    result = []
    for assessment in assessments:
        # Get candidate info
        candidate = db.query(User).filter(User.id == assessment.candidate_id).first()
        
        # Get job role info
        job_role = None
        if assessment.job_role_id:
            job_role = db.query(JobRole).filter(JobRole.id == assessment.job_role_id).first()
        
        # Calculate progress percentage
        progress_percentage = 0
        if assessment.total_score is not None:
            progress_percentage = 100
        elif assessment.status == 'IN_PROGRESS':
            progress_percentage = 50
        
        result.append({
            "id": assessment.id,
            "candidate_id": assessment.candidate_id,
            "job_role_id": assessment.job_role_id,
            "status": assessment.status,
            "started_at": assessment.started_at.isoformat() if assessment.started_at else None,
            "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
            "total_score": assessment.total_score,
            "candidate_name": candidate.full_name if candidate else None,
            "job_role_title": job_role.title if job_role else None,
            "progress_percentage": progress_percentage
        })
    
    return result

@router.get("/assessments/{assessment_id}")
async def get_admin_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get a specific assessment for admin"""
    
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get candidate info
    candidate = db.query(User).filter(User.id == assessment.candidate_id).first()
    
    # Get job role info
    job_role = None
    if assessment.job_role_id:
        job_role = db.query(JobRole).filter(JobRole.id == assessment.job_role_id).first()
    
    # Calculate progress percentage
    progress_percentage = 0
    if assessment.total_score is not None:
        progress_percentage = 100
    elif assessment.status == 'IN_PROGRESS':
        progress_percentage = 50
    
    return {
        "id": assessment.id,
        "candidate_id": assessment.candidate_id,
        "job_role_id": assessment.job_role_id,
        "status": assessment.status,
        "started_at": assessment.started_at.isoformat() if assessment.started_at else None,
        "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
        "total_score": assessment.total_score,
        "candidate_name": candidate.full_name if candidate else None,
        "job_role_title": job_role.title if job_role else None,
        "progress_percentage": progress_percentage
    }

@router.delete("/assessments/{assessment_id}")
async def delete_admin_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete an assessment (admin only)"""
    
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    db.delete(assessment)
    db.commit()
    
    return {"message": "Assessment deleted successfully"}

@router.get("/job-roles/{job_role_id}")
async def get_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get a specific job role for admin"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    return job_role

@router.patch("/job-roles/{job_role_id}")
async def update_admin_job_role(
    job_role_id: str,
    update_data: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update a job role (admin only)"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    # Update allowed fields
    for field, value in update_data.items():
        if hasattr(job_role, field) and field in ['title', 'description', 'traits_json', 'config_json']:
            setattr(job_role, field, value)
    
    db.commit()
    db.refresh(job_role)
    
    return {"message": "Job role updated successfully"}

@router.delete("/job-roles/{job_role_id}")
async def delete_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a job role (admin only)"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    # Check if any candidates are assigned to this job role
    candidates_with_role = db.query(CandidateProfile).filter(CandidateProfile.job_role_id == job_role_id).count()
    if candidates_with_role > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete job role. {candidates_with_role} candidates are assigned to this role."
        )
    
    # Check if any assessments use this job role
    assessments_with_role = db.query(Assessment).filter(Assessment.job_role_id == job_role_id).count()
    if assessments_with_role > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete job role. {assessments_with_role} assessments use this role."
        )
    
    db.delete(job_role)
    db.commit()
    
    return {"message": "Job role deleted successfully"}

@router.post("/job-roles/{job_role_id}/analyze")
async def analyze_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Analyze a job role and update traits (admin only)"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    # Simple analysis - in a real app this would use AI/ML
    traits = {
        "cognitive_flexibility": {"required": True, "weight": 0.8},
        "working_memory": {"required": True, "weight": 0.7},
        "processing_speed": {"required": False, "weight": 0.6},
        "attention_control": {"required": True, "weight": 0.9}
    }
    
    # Update the job role with analyzed traits
    job_role.traits_json = traits
    db.commit()
    db.refresh(job_role)
    
    return {
        "message": "Job role analysis completed",
        "traits": traits
    }

# Job Roles endpoints for admin
@router.get("/job-roles")
async def get_admin_job_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all job roles for admin"""
    job_roles = db.query(JobRole).offset(skip).limit(limit).all()

    return [
        {
            "id": jr.id,
            "title": jr.title,
            "description": jr.description,
            "traits_json": jr.traits_json,
            "config_json": jr.config_json,
            "created_at": jr.created_at.isoformat()
        } for jr in job_roles
    ]

@router.post("/job-roles")
async def create_admin_job_role(
    job_role_data: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new job role"""
    
    # Create new job role
    new_job_role = JobRole(
        id=str(uuid.uuid4()),
        title=job_role_data.get("title"),
        description=job_role_data.get("description"),
        traits_json=job_role_data.get("traits_json"),
        config_json=job_role_data.get("config_json")
    )
    
    db.add(new_job_role)
    db.commit()
    db.refresh(new_job_role)
    
    return {
        "id": new_job_role.id,
        "title": new_job_role.title,
        "description": new_job_role.description,
        "traits_json": new_job_role.traits_json,
        "config_json": new_job_role.config_json,
        "created_at": new_job_role.created_at.isoformat()
    }

@router.get("/job-roles/{job_role_id}")
async def get_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get a specific job role for admin"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    return {
        "id": job_role.id,
        "title": job_role.title,
        "description": job_role.description,
        "traits_json": job_role.traits_json,
        "config_json": job_role.config_json,
        "created_at": job_role.created_at.isoformat()
    }

@router.patch("/job-roles/{job_role_id}")
async def update_admin_job_role(
    job_role_id: str,
    job_role_data: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update a job role"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    # Update fields if provided
    if "title" in job_role_data:
        job_role.title = job_role_data["title"]
    if "description" in job_role_data:
        job_role.description = job_role_data["description"]
    if "traits_json" in job_role_data:
        job_role.traits_json = job_role_data["traits_json"]
    if "config_json" in job_role_data:
        job_role.config_json = job_role_data["config_json"]
    
    db.commit()
    db.refresh(job_role)
    
    return {
        "id": job_role.id,
        "title": job_role.title,
        "description": job_role.description,
        "traits_json": job_role.traits_json,
        "config_json": job_role.config_json,
        "created_at": job_role.created_at.isoformat()
    }

@router.delete("/job-roles/{job_role_id}")
async def delete_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a job role"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    db.delete(job_role)
    db.commit()
    
    return {"message": "Job role deleted successfully"}

@router.post("/job-roles/{job_role_id}/analyze")
async def analyze_admin_job_role(
    job_role_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Analyze a job role and generate traits"""
    
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    # Mock analysis - in real implementation, this would use AI
    traits = {
        "analytical_thinking": {"required": True, "weight": 0.8},
        "working_memory": {"required": True, "weight": 0.7},
        "processing_speed": {"required": False, "weight": 0.6},
        "attention_control": {"required": True, "weight": 0.9}
    }
    
    # Update the job role with analyzed traits
    job_role.traits_json = traits
    db.commit()
    db.refresh(job_role)
    
    return {
        "message": "Job role analysis completed",
        "traits": traits
    }
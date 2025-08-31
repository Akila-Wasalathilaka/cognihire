from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid
from database import get_db
from models import JobRole, User, Tenant, Game, Assessment
from routers.auth import get_current_admin_user, log_audit_action

router = APIRouter()

# Pydantic models
class JobRoleCreate(BaseModel):
    title: str
    description: str
    traits_json: Optional[dict] = None
    config_json: Optional[dict] = None

class JobRoleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    traits_json: Optional[dict] = None
    config_json: Optional[dict] = None

class JobRoleResponse(BaseModel):
    id: str
    title: str
    description: str
    traits_json: Optional[dict]
    config_json: Optional[dict]
    created_at: str

# AI-powered cognitive trait mapping
COGNITIVE_TRAITS = {
    "memory": {
        "description": "Working memory and recall capabilities",
        "games": ["nback", "memory_sequence"],
        "weight": 0.25
    },
    "attention": {
        "description": "Sustained attention and focus",
        "games": ["continuous_performance", "stroop"],
        "weight": 0.20
    },
    "processing_speed": {
        "description": "Speed of information processing",
        "games": ["reaction_time", "symbol_digit"],
        "weight": 0.15
    },
    "problem_solving": {
        "description": "Analytical and logical reasoning",
        "games": ["logical_reasoning", "pattern_recognition"],
        "weight": 0.20
    },
    "cognitive_flexibility": {
        "description": "Ability to switch between tasks",
        "games": ["task_switching", "stroop"],
        "weight": 0.10
    },
    "spatial_reasoning": {
        "description": "Visual-spatial processing",
        "games": ["mental_rotation", "block_design"],
        "weight": 0.10
    }
}

def analyze_job_description_ai(description: str) -> dict:
    """
    AI-powered analysis of job description to map cognitive traits
    This is a simplified version - in production, this would use NLP models
    """
    traits = {}
    description_lower = description.lower()

    # Simple keyword-based analysis (replace with actual AI model)
    if any(word in description_lower for word in ["analyze", "research", "investigate", "problem"]):
        traits["problem_solving"] = {"required": True, "weight": 0.25}

    if any(word in description_lower for word in ["fast", "quick", "rapid", "speed"]):
        traits["processing_speed"] = {"required": True, "weight": 0.20}

    if any(word in description_lower for word in ["focus", "attention", "concentrate", "detail"]):
        traits["attention"] = {"required": True, "weight": 0.20}

    if any(word in description_lower for word in ["remember", "recall", "memory", "learn"]):
        traits["memory"] = {"required": True, "weight": 0.20}

    if any(word in description_lower for word in ["adapt", "flexible", "switch", "multitask"]):
        traits["cognitive_flexibility"] = {"required": True, "weight": 0.15}

    if any(word in description_lower for word in ["visual", "spatial", "design", "pattern"]):
        traits["spatial_reasoning"] = {"required": True, "weight": 0.15}

    return traits

@router.post("/", response_model=JobRoleResponse)
async def create_job_role(
    job_role_data: JobRoleCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
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

    # AI-powered trait analysis if not provided
    traits_json = job_role_data.traits_json
    if not traits_json:
        traits_json = analyze_job_description_ai(job_role_data.description)

    # Create job role
    db_job_role = JobRole(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        title=job_role_data.title,
        description=job_role_data.description,
        traits_json=traits_json,
        config_json=job_role_data.config_json or {}
    )

    db.add(db_job_role)
    db.commit()
    db.refresh(db_job_role)

    # Log creation
    log_audit_action(
        db,
        current_user.id,
        "CREATE_JOB_ROLE",
        "JOB_ROLE",
        db_job_role.id,
        {"title": job_role_data.title}
    )

    return {
        "id": db_job_role.id,
        "title": db_job_role.title,
        "description": db_job_role.description,
        "traits_json": db_job_role.traits_json,
        "config_json": db_job_role.config_json,
        "created_at": db_job_role.created_at.isoformat()
    }

@router.get("/", response_model=List[JobRoleResponse])
async def get_job_roles(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
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

@router.get("/{job_role_id}", response_model=JobRoleResponse)
async def get_job_role(
    job_role_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
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

@router.put("/{job_role_id}", response_model=JobRoleResponse)
async def update_job_role(
    job_role_id: str,
    job_role_data: JobRoleUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    # Update fields
    if job_role_data.title:
        job_role.title = job_role_data.title
    if job_role_data.description:
        job_role.description = job_role_data.description
        # Re-analyze traits if description changed
        if not job_role_data.traits_json:
            job_role.traits_json = analyze_job_description_ai(job_role_data.description)
    if job_role_data.traits_json:
        job_role.traits_json = job_role_data.traits_json
    if job_role_data.config_json:
        job_role.config_json = job_role_data.config_json

    db.commit()
    db.refresh(job_role)

    # Log update
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_JOB_ROLE",
        "JOB_ROLE",
        job_role_id,
        {"title": job_role.title}
    )

    return {
        "id": job_role.id,
        "title": job_role.title,
        "description": job_role.description,
        "traits_json": job_role.traits_json,
        "config_json": job_role.config_json,
        "created_at": job_role.created_at.isoformat()
    }

@router.delete("/{job_role_id}")
async def delete_job_role(
    job_role_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    # Check if job role is being used in assessments
    assessment_count = db.query(Assessment).filter(Assessment.job_role_id == job_role_id).count()
    if assessment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete job role: {assessment_count} assessments are using it"
        )

    # Log deletion
    log_audit_action(
        db,
        current_user.id,
        "DELETE_JOB_ROLE",
        "JOB_ROLE",
        job_role_id,
        {"title": job_role.title}
    )

    db.delete(job_role)
    db.commit()

    return {"message": "Job role deleted successfully"}

@router.post("/{job_role_id}/analyze")
async def analyze_job_role(
    job_role_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    job_role = db.query(JobRole).filter(JobRole.id == job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    # Re-analyze with AI
    traits_json = analyze_job_description_ai(job_role.description)
    job_role.traits_json = traits_json

    db.commit()

    # Log analysis
    log_audit_action(
        db,
        current_user.id,
        "ANALYZE_JOB_ROLE",
        "JOB_ROLE",
        job_role_id,
        {"traits_count": len(traits_json)}
    )

    return {
        "message": "Job role analyzed successfully",
        "traits": traits_json
    }

@router.get("/traits/available")
async def get_available_traits():
    """Get all available cognitive traits"""
    return {
        "traits": COGNITIVE_TRAITS,
        "description": "Available cognitive traits for job role analysis"
    }
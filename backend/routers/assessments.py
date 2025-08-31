from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from database import get_db
from models import Assessment, AssessmentItem, User, JobRole, Game, Tenant
from routers.auth import get_current_admin_user, get_current_user, log_audit_action

router = APIRouter()

# Pydantic models
class AssessmentCreate(BaseModel):
    candidate_id: str
    job_role_id: str
    expires_in_days: Optional[int] = 30

class AssessmentUpdate(BaseModel):
    status: Optional[str] = None
    total_score: Optional[float] = None

class AssessmentResponse(BaseModel):
    id: str
    tenant_id: str
    candidate_id: str
    job_role_id: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    total_score: Optional[float]
    integrity_flags: Optional[dict]
    created_at: str
    candidate_name: Optional[str]
    job_role_title: Optional[str]
    progress_percentage: float

class AssessmentItemResponse(BaseModel):
    id: str
    assessment_id: str
    game_id: str
    order_index: int
    timer_seconds: Optional[int]
    server_started_at: Optional[str]
    server_deadline_at: Optional[str]
    status: str
    score: Optional[float]
    metrics_json: Optional[dict]
    config_snapshot: Optional[dict]
    game_title: Optional[str]
    game_code: Optional[str]

class StartAssessmentRequest(BaseModel):
    assessment_id: str

class SubmitItemRequest(BaseModel):
    score: float
    metrics_json: dict
    response_time_ms: Optional[int] = None

@router.post("/", response_model=AssessmentResponse)
async def create_assessment(
    assessment_data: AssessmentCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Validate candidate exists
    candidate = db.query(User).filter(User.id == assessment_data.candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate job role exists
    job_role = db.query(JobRole).filter(JobRole.id == assessment_data.job_role_id).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

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

    # Create assessment
    db_assessment = Assessment(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        candidate_id=assessment_data.candidate_id,
        job_role_id=assessment_data.job_role_id,
        status="NOT_STARTED",
        integrity_flags={}
    )

    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)

    # Log creation
    log_audit_action(
        db,
        current_user.id,
        "CREATE_ASSESSMENT",
        "ASSESSMENT",
        db_assessment.id,
        {
            "candidate_id": assessment_data.candidate_id,
            "job_role_id": assessment_data.job_role_id
        }
    )

    return await _format_assessment_response(db_assessment, db)

@router.get("/", response_model=List[AssessmentResponse])
async def get_assessments(
    skip: int = 0,
    limit: int = 100,
    candidate_id: Optional[str] = None,
    job_role_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Build query
    query = db.query(Assessment)

    # Apply filters
    if candidate_id:
        query = query.filter(Assessment.candidate_id == candidate_id)

    if job_role_id:
        query = query.filter(Assessment.job_role_id == job_role_id)

    if status:
        if status not in ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "CANCELLED"]:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Assessment.status == status)

    # For candidates, only show their own assessments
    if current_user.role == "CANDIDATE":
        query = query.filter(Assessment.candidate_id == current_user.id)

    assessments = query.offset(skip).limit(limit).all()

    result = []
    for assessment in assessments:
        result.append(await _format_assessment_response(assessment, db))

    return result

@router.get("/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return await _format_assessment_response(assessment, db)

@router.put("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: str,
    assessment_data: AssessmentUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Validate status if provided
    if assessment_data.status:
        if assessment_data.status not in ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "CANCELLED"]:
            raise HTTPException(status_code=400, detail="Invalid status")

    # Update fields
    if assessment_data.status:
        assessment.status = assessment_data.status
        if assessment_data.status == "COMPLETED" and not assessment.completed_at:
            assessment.completed_at = datetime.utcnow()

    if assessment_data.total_score is not None:
        assessment.total_score = assessment_data.total_score

    db.commit()
    db.refresh(assessment)

    # Log update
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_ASSESSMENT",
        "ASSESSMENT",
        assessment_id,
        {
            "status": assessment_data.status,
            "total_score": assessment_data.total_score
        }
    )

    return await _format_assessment_response(assessment, db)

@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check if assessment has been started
    if assessment.status != "NOT_STARTED":
        raise HTTPException(status_code=400, detail="Cannot delete assessment that has been started")

    # Log deletion
    log_audit_action(
        db,
        current_user.id,
        "DELETE_ASSESSMENT",
        "ASSESSMENT",
        assessment_id,
        {"candidate_id": assessment.candidate_id}
    )

    db.delete(assessment)
    db.commit()

    return {"message": "Assessment deleted successfully"}

@router.post("/{assessment_id}/start")
async def start_assessment(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if already started
    if assessment.status != "NOT_STARTED":
        raise HTTPException(status_code=400, detail="Assessment has already been started")

    # Update assessment status
    assessment.status = "IN_PROGRESS"
    assessment.started_at = datetime.utcnow()

    # Create assessment items based on job role traits
    await _create_assessment_items(assessment, db)

    db.commit()

    # Log start
    log_audit_action(
        db,
        current_user.id,
        "START_ASSESSMENT",
        "ASSESSMENT",
        assessment_id,
        {"candidate_id": assessment.candidate_id}
    )

    return {"message": "Assessment started successfully"}

@router.get("/{assessment_id}/items", response_model=List[AssessmentItemResponse])
async def get_assessment_items(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment_id).order_by(AssessmentItem.order_index).all()

    result = []
    for item in items:
        game = db.query(Game).filter(Game.id == item.game_id).first()
        result.append({
            "id": item.id,
            "assessment_id": item.assessment_id,
            "game_id": item.game_id,
            "order_index": item.order_index,
            "timer_seconds": item.timer_seconds,
            "server_started_at": item.server_started_at.isoformat() if item.server_started_at else None,
            "server_deadline_at": item.server_deadline_at.isoformat() if item.server_deadline_at else None,
            "status": item.status,
            "score": item.score,
            "metrics_json": item.metrics_json,
            "config_snapshot": item.config_snapshot,
            "game_title": game.title if game else None,
            "game_code": game.code if game else None
        })

    return result

@router.post("/items/{item_id}/start")
async def start_assessment_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(AssessmentItem).filter(AssessmentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Assessment item not found")

    # Check permissions via assessment
    assessment = db.query(Assessment).filter(Assessment.id == item.assessment_id).first()
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if item can be started
    if item.status != "PENDING":
        raise HTTPException(status_code=400, detail="Item is not in pending status")

    # Update item status
    item.status = "ACTIVE"
    item.server_started_at = datetime.utcnow()

    if item.timer_seconds:
        item.server_deadline_at = item.server_started_at + timedelta(seconds=item.timer_seconds)

    db.commit()

    return {
        "message": "Assessment item started successfully",
        "deadline": item.server_deadline_at.isoformat() if item.server_deadline_at else None
    }

@router.post("/items/{item_id}/submit")
async def submit_assessment_item(
    item_id: str,
    submission: SubmitItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(AssessmentItem).filter(AssessmentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Assessment item not found")

    # Check permissions via assessment
    assessment = db.query(Assessment).filter(Assessment.id == item.assessment_id).first()
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if item can be submitted
    if item.status not in ["ACTIVE", "PENDING"]:
        raise HTTPException(status_code=400, detail="Item cannot be submitted")

    # Update item
    item.status = "SUBMITTED"
    item.score = submission.score
    item.metrics_json = submission.metrics_json

    db.commit()

    # Check if assessment is complete
    await _check_assessment_completion(assessment, db)

    return {"message": "Assessment item submitted successfully"}

@router.get("/current")
async def get_current_assessment(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current assessment for the logged-in candidate"""
    if current_user.role != "CANDIDATE":
        raise HTTPException(status_code=403, detail="Only candidates can access current assessment")

    # Find the most recent assessment for this candidate
    assessment = db.query(Assessment).filter(
        Assessment.candidate_id == current_user.id,
        Assessment.status.in_(["NOT_STARTED", "IN_PROGRESS"])
    ).order_by(Assessment.created_at.desc()).first()

    if not assessment:
        return {"assessment": None, "message": "No active assessment found"}

    return {"assessment": await _format_assessment_response(assessment, db)}

async def _create_assessment_items(assessment: Assessment, db: Session):
    """Create assessment items based on job role traits"""
    # Get job role traits
    job_role = db.query(JobRole).filter(JobRole.id == assessment.job_role_id).first()
    if not job_role or not job_role.traits_json:
        # Default games if no traits specified
        default_games = ["NBACK", "STROOP", "REACTION_TIME"]
        for i, game_code in enumerate(default_games):
            game = db.query(Game).filter(Game.code == game_code).first()
            if game:
                item = AssessmentItem(
                    id=str(uuid.uuid4()),
                    assessment_id=assessment.id,
                    game_id=game.id,
                    order_index=i,
                    timer_seconds=300,  # 5 minutes
                    status="PENDING",
                    config_snapshot={}
                )
                db.add(item)
        return

    # Create items based on traits
    order_index = 0
    traits = job_role.traits_json

    # Memory trait -> N-Back game
    if traits.get("memory", {}).get("required", False):
        game = db.query(Game).filter(Game.code == "NBACK").first()
        if game:
            item = AssessmentItem(
                id=str(uuid.uuid4()),
                assessment_id=assessment.id,
                game_id=game.id,
                order_index=order_index,
                timer_seconds=300,
                status="PENDING",
                config_snapshot={"n": 2, "trials": 20, "difficulty": "medium"}
            )
            db.add(item)
            order_index += 1

    # Attention trait -> Continuous Performance Task
    if traits.get("attention", {}).get("required", False):
        game = db.query(Game).filter(Game.code == "STROOP").first()
        if game:
            item = AssessmentItem(
                id=str(uuid.uuid4()),
                assessment_id=assessment.id,
                game_id=game.id,
                order_index=order_index,
                timer_seconds=240,
                status="PENDING",
                config_snapshot={"trials": 30, "difficulty": "medium"}
            )
            db.add(item)
            order_index += 1

    # Processing speed trait -> Reaction Time game
    if traits.get("processing_speed", {}).get("required", False):
        game = db.query(Game).filter(Game.code == "REACTION_TIME").first()
        if game:
            item = AssessmentItem(
                id=str(uuid.uuid4()),
                assessment_id=assessment.id,
                game_id=game.id,
                order_index=order_index,
                timer_seconds=180,
                status="PENDING",
                config_snapshot={"trials": 25, "difficulty": "medium"}
            )
            db.add(item)
            order_index += 1

async def _check_assessment_completion(assessment: Assessment, db: Session):
    """Check if assessment is complete and calculate final score"""
    items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).all()

    if not items:
        return

    # Check if all items are submitted
    submitted_count = sum(1 for item in items if item.status == "SUBMITTED")
    total_count = len(items)

    if submitted_count == total_count:
        # Calculate total score
        total_score = 0
        valid_scores = 0

        for item in items:
            if item.score is not None:
                total_score += item.score
                valid_scores += 1

        if valid_scores > 0:
            assessment.total_score = total_score / valid_scores
        else:
            assessment.total_score = 0

        assessment.status = "COMPLETED"
        assessment.completed_at = datetime.utcnow()

        db.commit()

async def _format_assessment_response(assessment: Assessment, db: Session) -> dict:
    """Format assessment response with additional data"""
    # Get candidate name
    candidate = db.query(User).filter(User.id == assessment.candidate_id).first()
    candidate_name = None
    if candidate:
        # Try to get from candidate profile
        from models import CandidateProfile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first()
        candidate_name = profile.full_name if profile else candidate.username

    # Get job role title
    job_role = db.query(JobRole).filter(JobRole.id == assessment.job_role_id).first()
    job_role_title = job_role.title if job_role else None

    # Calculate progress
    items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).all()
    if items:
        completed_items = sum(1 for item in items if item.status == "SUBMITTED")
        progress_percentage = (completed_items / len(items)) * 100
    else:
        progress_percentage = 0

    return {
        "id": assessment.id,
        "tenant_id": assessment.tenant_id,
        "candidate_id": assessment.candidate_id,
        "job_role_id": assessment.job_role_id,
        "status": assessment.status,
        "started_at": assessment.started_at.isoformat() if assessment.started_at else None,
        "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
        "total_score": assessment.total_score,
        "integrity_flags": assessment.integrity_flags,
        "created_at": assessment.created_at.isoformat(),
        "candidate_name": candidate_name,
        "job_role_title": job_role_title,
        "progress_percentage": progress_percentage
    }
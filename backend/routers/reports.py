from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from database import get_db
from models import User, Assessment, AssessmentItem, Report, JobRole, CandidateProfile
from routers.auth import get_current_admin_user, get_current_user, log_audit_action

router = APIRouter()

# Pydantic models
class ReportGenerateRequest(BaseModel):
    assessment_id: str
    report_type: str = "comprehensive"  # comprehensive, summary, detailed
    include_raw_data: bool = False

class ReportResponse(BaseModel):
    id: str
    assessment_id: str
    storage_key: str
    created_at: str
    download_url: str

class AssessmentAnalytics(BaseModel):
    total_assessments: int
    completed_assessments: int
    average_score: float
    average_completion_time: float
    trait_averages: Dict[str, float]
    game_performance: Dict[str, Any]

@router.post("/generate", response_model=ReportResponse)
async def generate_assessment_report(
    request: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a comprehensive assessment report"""

    # Validate assessment
    assessment = db.query(Assessment).filter(Assessment.id == request.assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if assessment is completed
    if assessment.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Assessment must be completed to generate report")

    # Generate report data
    report_data = await _generate_report_data(assessment, request.report_type, request.include_raw_data, db)

    # Create storage key (in production, this would be a file path or S3 key)
    storage_key = f"reports/{assessment.id}/{uuid.uuid4()}.pdf"

    # Create report record
    db_report = Report(
        id=str(uuid.uuid4()),
        assessment_id=assessment.id,
        storage_key=storage_key,
        created_at=datetime.utcnow()
    )

    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # Log report generation
    log_audit_action(
        db,
        current_user.id,
        "GENERATE_REPORT",
        "ASSESSMENT",
        assessment.id,
        {
            "report_type": request.report_type,
            "include_raw_data": request.include_raw_data
        }
    )

    return {
        "id": db_report.id,
        "assessment_id": db_report.assessment_id,
        "storage_key": db_report.storage_key,
        "created_at": db_report.created_at.isoformat(),
        "download_url": f"/api/reports/{db_report.id}/download"
    }

@router.get("/{assessment_id}")
async def get_assessment_reports(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all reports for an assessment"""

    # Validate assessment access
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    reports = db.query(Report).filter(Report.assessment_id == assessment_id).order_by(Report.created_at.desc()).all()

    return {
        "assessment_id": assessment_id,
        "reports": [
            {
                "id": report.id,
                "storage_key": report.storage_key,
                "created_at": report.created_at.isoformat(),
                "download_url": f"/api/reports/{report.id}/download"
            } for report in reports
        ]
    }

@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a report file"""

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Validate assessment access
    assessment = db.query(Assessment).filter(Assessment.id == report.assessment_id).first()
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # In production, this would stream the file from storage
    # For now, return the report data as JSON
    report_data = await _generate_report_data(assessment, "comprehensive", False, db)

    return {
        "report_id": report_id,
        "assessment_id": assessment.id,
        "generated_at": report.created_at.isoformat(),
        "data": report_data
    }

@router.get("/analytics/overview")
async def get_analytics_overview(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get analytics overview for all assessments"""

    # Build date filter
    query = db.query(Assessment)
    if start_date:
        query = query.filter(Assessment.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Assessment.created_at <= datetime.fromisoformat(end_date))

    assessments = query.all()

    if not assessments:
        return AssessmentAnalytics(
            total_assessments=0,
            completed_assessments=0,
            average_score=0,
            average_completion_time=0,
            trait_averages={},
            game_performance={}
        )

    # Calculate metrics
    completed_assessments = [a for a in assessments if a.status == "COMPLETED"]
    total_assessments = len(assessments)
    completed_count = len(completed_assessments)

    # Average score
    scores = [a.total_score for a in completed_assessments if a.total_score is not None]
    average_score = sum(scores) / len(scores) if scores else 0

    # Average completion time
    completion_times = []
    for assessment in completed_assessments:
        if assessment.started_at and assessment.completed_at:
            time_diff = (assessment.completed_at - assessment.started_at).total_seconds()
            completion_times.append(time_diff)

    average_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0

    # Trait averages
    trait_scores = {}
    trait_counts = {}

    for assessment in completed_assessments:
        items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).all()
        for item in items:
            if item.metrics_json and "server_scoring" in item.metrics_json:
                server_scoring = item.metrics_json["server_scoring"]
                if "trait_scores" in server_scoring:
                    for trait, score in server_scoring["trait_scores"].items():
                        if trait not in trait_scores:
                            trait_scores[trait] = 0
                            trait_counts[trait] = 0
                        trait_scores[trait] += score
                        trait_counts[trait] += 1

    trait_averages = {}
    for trait in trait_scores:
        trait_averages[trait] = trait_scores[trait] / trait_counts[trait]

    # Game performance
    game_performance = {}
    for assessment in completed_assessments:
        items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).all()
        for item in items:
            game_code = "Unknown"
            if item.game:
                game_code = item.game.code

            if game_code not in game_performance:
                game_performance[game_code] = {
                    "total_attempts": 0,
                    "average_score": 0,
                    "total_score": 0
                }

            game_performance[game_code]["total_attempts"] += 1
            if item.score:
                game_performance[game_code]["total_score"] += item.score

    for game_code in game_performance:
        if game_performance[game_code]["total_attempts"] > 0:
            game_performance[game_code]["average_score"] = (
                game_performance[game_code]["total_score"] / game_performance[game_code]["total_attempts"]
            )

    return AssessmentAnalytics(
        total_assessments=total_assessments,
        completed_assessments=completed_count,
        average_score=average_score,
        average_completion_time=average_completion_time,
        trait_averages=trait_averages,
        game_performance=game_performance
    )

@router.get("/analytics/candidate/{candidate_id}")
async def get_candidate_analytics(
    candidate_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a specific candidate"""

    # Validate candidate exists
    candidate = db.query(User).filter(User.id == candidate_id, User.role == "CANDIDATE").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get all assessments for this candidate
    assessments = db.query(Assessment).filter(Assessment.candidate_id == candidate_id).all()

    completed_assessments = [a for a in assessments if a.status == "COMPLETED"]

    if not completed_assessments:
        return {
            "candidate_id": candidate_id,
            "total_assessments": len(assessments),
            "completed_assessments": 0,
            "average_score": 0,
            "best_score": 0,
            "latest_score": 0,
            "performance_trend": [],
            "trait_improvement": {}
        }

    # Calculate metrics
    scores = [a.total_score for a in completed_assessments if a.total_score is not None]
    average_score = sum(scores) / len(scores) if scores else 0
    best_score = max(scores) if scores else 0
    latest_score = completed_assessments[-1].total_score if completed_assessments[-1].total_score else 0

    # Performance trend
    performance_trend = [
        {
            "assessment_id": a.id,
            "date": a.completed_at.isoformat() if a.completed_at else a.created_at.isoformat(),
            "score": a.total_score
        } for a in sorted(completed_assessments, key=lambda x: x.completed_at or x.created_at)
    ]

    # Trait improvement analysis
    trait_improvement = {}
    for assessment in sorted(completed_assessments, key=lambda x: x.completed_at or x.created_at):
        items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).all()
        for item in items:
            if item.metrics_json and "server_scoring" in item.metrics_json:
                server_scoring = item.metrics_json["server_scoring"]
                if "trait_scores" in server_scoring:
                    for trait, score in server_scoring["trait_scores"].items():
                        if trait not in trait_improvement:
                            trait_improvement[trait] = []
                        trait_improvement[trait].append({
                            "date": assessment.completed_at.isoformat() if assessment.completed_at else assessment.created_at.isoformat(),
                            "score": score
                        })

    return {
        "candidate_id": candidate_id,
        "total_assessments": len(assessments),
        "completed_assessments": len(completed_assessments),
        "average_score": average_score,
        "best_score": best_score,
        "latest_score": latest_score,
        "performance_trend": performance_trend,
        "trait_improvement": trait_improvement
    }

async def _generate_report_data(assessment: Assessment, report_type: str, include_raw_data: bool, db: Session):
    """Generate comprehensive report data"""

    # Get candidate info
    candidate = db.query(User).filter(User.id == assessment.candidate_id).first()
    candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate.id).first() if candidate else None

    # Get job role info
    job_role = db.query(JobRole).filter(JobRole.id == assessment.job_role_id).first()

    # Get assessment items
    items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment.id).order_by(AssessmentItem.order_index).all()

    # Build report data
    report_data = {
        "report_metadata": {
            "assessment_id": assessment.id,
            "generated_at": datetime.utcnow().isoformat(),
            "report_type": report_type,
            "candidate_id": assessment.candidate_id
        },
        "candidate_info": {
            "name": candidate_profile.full_name if candidate_profile else candidate.username if candidate else "Unknown",
            "email": candidate.email if candidate else "Unknown",
            "assessment_date": assessment.started_at.isoformat() if assessment.started_at else assessment.created_at.isoformat()
        },
        "job_role": {
            "title": job_role.title if job_role else "Unknown",
            "description": job_role.description if job_role else "",
            "required_traits": job_role.traits_json if job_role else {}
        },
        "assessment_summary": {
            "status": assessment.status,
            "started_at": assessment.started_at.isoformat() if assessment.started_at else None,
            "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
            "total_score": assessment.total_score,
            "integrity_flags": assessment.integrity_flags
        },
        "game_results": []
    }

    # Process each game result
    trait_scores = {}
    trait_counts = {}

    for item in items:
        game_result = {
            "game_id": item.game_id,
            "game_code": item.game.code if item.game else "Unknown",
            "game_title": item.game.title if item.game else "Unknown Game",
            "order_index": item.order_index,
            "status": item.status,
            "score": item.score,
            "timer_seconds": item.timer_seconds,
            "started_at": item.server_started_at.isoformat() if item.server_started_at else None,
            "deadline_at": item.server_deadline_at.isoformat() if item.server_deadline_at else None
        }

        # Add server scoring if available
        if item.metrics_json and "server_scoring" in item.metrics_json:
            server_scoring = item.metrics_json["server_scoring"]
            game_result["server_scoring"] = server_scoring

            # Aggregate trait scores
            if "trait_scores" in server_scoring:
                for trait, score in server_scoring["trait_scores"].items():
                    if trait not in trait_scores:
                        trait_scores[trait] = 0
                        trait_counts[trait] = 0
                    trait_scores[trait] += score
                    trait_counts[trait] += 1

        # Add raw metrics if requested
        if include_raw_data and item.metrics_json:
            game_result["raw_metrics"] = item.metrics_json

        report_data["game_results"].append(game_result)

    # Calculate overall trait scores
    overall_trait_scores = {}
    for trait in trait_scores:
        overall_trait_scores[trait] = trait_scores[trait] / trait_counts[trait]

    report_data["overall_trait_scores"] = overall_trait_scores

    # Add recommendations based on scores
    recommendations = []
    if assessment.total_score:
        if assessment.total_score >= 85:
            recommendations.append("Excellent performance across all cognitive domains")
            recommendations.append("Strong candidate for the target role")
        elif assessment.total_score >= 70:
            recommendations.append("Good overall performance with room for improvement")
            recommendations.append("Consider for the role with some training support")
        elif assessment.total_score >= 50:
            recommendations.append("Average performance, may need additional development")
            recommendations.append("Consider for alternative roles or with support")
        else:
            recommendations.append("Performance indicates potential challenges in this role")
            recommendations.append("Consider alternative career paths or additional training")

    report_data["recommendations"] = recommendations

    return report_data
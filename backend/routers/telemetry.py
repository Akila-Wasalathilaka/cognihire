from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from database import get_db
from models import User, Assessment, AssessmentItem, AuditLog
from routers.auth import get_current_user, get_current_admin_user, log_audit_action

router = APIRouter()

# Pydantic models
class TelemetryEvent(BaseModel):
    assessment_id: str
    item_id: Optional[str] = None
    event_type: str  # MOUSE_MOVE, KEY_PRESS, WINDOW_FOCUS, WINDOW_BLUR, etc.
    timestamp: datetime
    data: Dict[str, Any] = {}
    client_info: Optional[Dict[str, Any]] = {}

class IntegrityFlag(BaseModel):
    assessment_id: str
    flag_type: str  # MULTIPLE_TABS, WINDOW_BLUR, COPY_PASTE, etc.
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    timestamp: datetime
    evidence: Dict[str, Any] = {}

class TelemetryResponse(BaseModel):
    event_id: str
    recorded_at: datetime
    status: str

class IntegrityReport(BaseModel):
    assessment_id: str
    flags: List[IntegrityFlag]
    overall_risk: str
    recommendations: List[str]

INTEGRITY_THRESHOLDS = {
    "WINDOW_BLUR": {"threshold": 5, "severity": "MEDIUM"},
    "MULTIPLE_TABS": {"threshold": 1, "severity": "HIGH"},
    "COPY_PASTE": {"threshold": 3, "severity": "MEDIUM"},
    "RIGHT_CLICK": {"threshold": 5, "severity": "LOW"},
    "DEV_TOOLS": {"threshold": 1, "severity": "CRITICAL"},
    "TAB_SWITCH": {"threshold": 3, "severity": "MEDIUM"},
}

@router.post("/events", response_model=TelemetryResponse)
async def record_telemetry_event(
    event: TelemetryEvent,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a telemetry event during assessment"""

    # Validate assessment access
    assessment = db.query(Assessment).filter(Assessment.id == event.assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create audit log entry for telemetry
    log_entry = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=assessment.tenant_id,
        actor_user_id=current_user.id,
        action=f"TELEMETRY_{event.event_type}",
        target_type="ASSESSMENT_ITEM" if event.item_id else "ASSESSMENT",
        target_id=event.item_id or event.assessment_id,
        ip=None,  # Would be populated by middleware
        user_agent=None,  # Would be populated by middleware
        payload_json={
            "event_type": event.event_type,
            "timestamp": event.timestamp.isoformat(),
            "data": event.data,
            "client_info": event.client_info
        },
        created_at=datetime.utcnow()
    )

    db.add(log_entry)

    # Check for integrity violations
    integrity_flag = await _check_integrity_violation(event, assessment, db)

    if integrity_flag:
        # Update assessment integrity flags
        current_flags = assessment.integrity_flags or {}
        flag_list = current_flags.get("flags", [])
        flag_list.append(integrity_flag.dict())
        current_flags["flags"] = flag_list
        current_flags["last_updated"] = datetime.utcnow().isoformat()
        assessment.integrity_flags = current_flags

    db.commit()

    return {
        "event_id": log_entry.id,
        "recorded_at": log_entry.created_at,
        "status": "recorded"
    }

@router.post("/integrity/{assessment_id}/flag")
async def flag_integrity_violation(
    assessment_id: str,
    flag: IntegrityFlag,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Manually flag an integrity violation (admin only)"""

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Update assessment integrity flags
    current_flags = assessment.integrity_flags or {}
    flag_list = current_flags.get("flags", [])
    flag_list.append(flag.dict())
    current_flags["flags"] = flag_list
    current_flags["last_updated"] = datetime.utcnow().isoformat()
    assessment.integrity_flags = current_flags

    db.commit()

    # Log the manual flag
    log_audit_action(
        db,
        current_user.id,
        "MANUAL_INTEGRITY_FLAG",
        "ASSESSMENT",
        assessment_id,
        {
            "flag_type": flag.flag_type,
            "severity": flag.severity,
            "description": flag.description
        }
    )

    return {"message": "Integrity flag recorded successfully"}

@router.get("/integrity/{assessment_id}/report")
async def get_integrity_report(
    assessment_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get integrity report for an assessment"""

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    flags = assessment.integrity_flags or {}
    flag_list = flags.get("flags", [])

    # Calculate overall risk
    severity_weights = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    total_weight = sum(severity_weights.get(flag.get("severity", "LOW"), 1) for flag in flag_list)

    if total_weight >= 10:
        overall_risk = "HIGH"
    elif total_weight >= 5:
        overall_risk = "MEDIUM"
    else:
        overall_risk = "LOW"

    # Generate recommendations
    recommendations = []
    if overall_risk == "HIGH":
        recommendations.append("Consider invalidating this assessment due to high integrity risk")
        recommendations.append("Review candidate's assessment environment and behavior")
    elif overall_risk == "MEDIUM":
        recommendations.append("Monitor this candidate closely in future assessments")
        recommendations.append("Consider additional verification steps")
    else:
        recommendations.append("Assessment integrity appears acceptable")

    return IntegrityReport(
        assessment_id=assessment_id,
        flags=flag_list,
        overall_risk=overall_risk,
        recommendations=recommendations
    )

@router.get("/events/{assessment_id}")
async def get_telemetry_events(
    assessment_id: str,
    event_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get telemetry events for an assessment (admin only)"""

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Build query
    query = db.query(AuditLog).filter(
        AuditLog.target_id == assessment_id,
        AuditLog.action.like("TELEMETRY_%")
    )

    if event_type:
        query = query.filter(AuditLog.action == f"TELEMETRY_{event_type}")

    events = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    return {
        "assessment_id": assessment_id,
        "events": [
            {
                "id": event.id,
                "event_type": event.action.replace("TELEMETRY_", ""),
                "timestamp": event.created_at.isoformat(),
                "actor_user_id": event.actor_user_id,
                "data": event.payload_json
            } for event in events
        ],
        "total": len(events)
    }

@router.post("/heartbeat/{assessment_id}")
async def record_heartbeat(
    assessment_id: str,
    heartbeat_data: Dict[str, Any] = {},
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record assessment heartbeat for monitoring active sessions"""

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check permissions
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create heartbeat log
    log_entry = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=assessment.tenant_id,
        actor_user_id=current_user.id,
        action="ASSESSMENT_HEARTBEAT",
        target_type="ASSESSMENT",
        target_id=assessment_id,
        payload_json={
            "heartbeat_data": heartbeat_data,
            "timestamp": datetime.utcnow().isoformat()
        },
        created_at=datetime.utcnow()
    )

    db.add(log_entry)
    db.commit()

    return {"status": "heartbeat recorded", "timestamp": log_entry.created_at.isoformat()}

async def _check_integrity_violation(event: TelemetryEvent, assessment: Assessment, db: Session) -> Optional[IntegrityFlag]:
    """Check if a telemetry event indicates an integrity violation"""

    event_type = event.event_type
    threshold = INTEGRITY_THRESHOLDS.get(event_type)

    if not threshold:
        return None

    # Count recent events of this type
    recent_events = db.query(AuditLog).filter(
        AuditLog.target_id == event.assessment_id,
        AuditLog.action == f"TELEMETRY_{event_type}",
        AuditLog.created_at >= datetime.utcnow() - timedelta(minutes=30)  # Last 30 minutes
    ).count()

    if recent_events >= threshold["threshold"]:
        return IntegrityFlag(
            assessment_id=event.assessment_id,
            flag_type=event_type,
            severity=threshold["severity"],
            description=f"Excessive {event_type.lower().replace('_', ' ')} events detected ({recent_events} in last 30 minutes)",
            timestamp=datetime.utcnow(),
            evidence={
                "event_count": recent_events,
                "threshold": threshold["threshold"],
                "time_window": "30 minutes",
                "last_event": event.timestamp.isoformat()
            }
        )

    return None

@router.get("/stats/{assessment_id}")
async def get_telemetry_stats(
    assessment_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get telemetry statistics for an assessment"""

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get event counts by type
    events = db.query(AuditLog).filter(
        AuditLog.target_id == assessment_id,
        AuditLog.action.like("TELEMETRY_%")
    ).all()

    event_counts = {}
    for event in events:
        event_type = event.action.replace("TELEMETRY_", "")
        event_counts[event_type] = event_counts.get(event_type, 0) + 1

    # Get heartbeat data
    heartbeats = db.query(AuditLog).filter(
        AuditLog.target_id == assessment_id,
        AuditLog.action == "ASSESSMENT_HEARTBEAT"
    ).count()

    return {
        "assessment_id": assessment_id,
        "total_events": len(events),
        "event_counts": event_counts,
        "heartbeat_count": heartbeats,
        "integrity_flags": assessment.integrity_flags,
        "time_range": {
            "start": assessment.started_at.isoformat() if assessment.started_at else None,
            "end": assessment.completed_at.isoformat() if assessment.completed_at else datetime.utcnow().isoformat()
        }
    }
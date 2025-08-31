from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Assessment, AssessmentItem
from .auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_assessments(db: Session = Depends(get_db)):
    assessments = db.query(Assessment).all()
    return assessments

@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment

@router.get("/{assessment_id}/items")
async def get_assessment_items(assessment_id: str, db: Session = Depends(get_db)):
    items = db.query(AssessmentItem).filter(AssessmentItem.assessment_id == assessment_id).all()
    return items
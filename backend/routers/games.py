from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import json
from database import get_db
from models import Game, AssessmentItem, User
from routers.auth import get_current_admin_user, get_current_user, log_audit_action

router = APIRouter()

# Pydantic models
class GameCreate(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    base_config: Dict[str, Any] = {}

class GameUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    base_config: Optional[Dict[str, Any]] = None

class GameResponse(BaseModel):
    id: str
    code: str
    title: str
    description: Optional[str]
    base_config: Dict[str, Any]

class GameScoreRequest(BaseModel):
    assessment_item_id: str
    raw_metrics: Dict[str, Any]
    response_time_ms: Optional[int] = None

class GameScoreResponse(BaseModel):
    score: float
    normalized_score: float
    trait_scores: Dict[str, float]
    feedback: str
    performance_level: str

# Game scoring algorithms
def score_nback_game(metrics: Dict[str, Any]) -> GameScoreResponse:
    """Score N-Back game performance"""
    correct_responses = metrics.get('correct_responses', 0)
    incorrect_responses = metrics.get('incorrect_responses', 0)
    misses = metrics.get('misses', 0)
    false_positives = metrics.get('false_positives', 0)
    total_trials = metrics.get('total_trials', 1)

    # Calculate accuracy
    total_responses = correct_responses + incorrect_responses + false_positives
    accuracy = correct_responses / total_responses if total_responses > 0 else 0

    # Calculate memory score (weighted accuracy)
    memory_score = accuracy * 0.8 + (1 - (misses / total_trials)) * 0.2

    # Normalize to 0-100 scale
    normalized_score = min(100, max(0, memory_score * 100))

    # Determine performance level
    if normalized_score >= 85:
        level = "Excellent"
    elif normalized_score >= 70:
        level = "Good"
    elif normalized_score >= 50:
        level = "Average"
    else:
        level = "Needs Improvement"

    return GameScoreResponse(
        score=memory_score,
        normalized_score=normalized_score,
        trait_scores={"memory": normalized_score},
        feedback=f"Accuracy: {accuracy:.1%}, Memory performance: {level.lower()}",
        performance_level=level
    )

def score_stroop_game(metrics: Dict[str, Any]) -> GameScoreResponse:
    """Score Stroop test performance"""
    correct_responses = metrics.get('correct_responses', 0)
    incorrect_responses = metrics.get('incorrect_responses', 0)
    average_response_time = metrics.get('average_response_time', 1000)
    total_trials = metrics.get('total_trials', 1)

    # Calculate accuracy
    total_responses = correct_responses + incorrect_responses
    accuracy = correct_responses / total_responses if total_responses > 0 else 0

    # Calculate attention score (accuracy weighted with speed)
    base_score = accuracy
    speed_bonus = max(0, 1 - (average_response_time - 800) / 1000)  # Optimal around 800ms
    attention_score = base_score * 0.7 + speed_bonus * 0.3

    # Normalize to 0-100 scale
    normalized_score = min(100, max(0, attention_score * 100))

    # Determine performance level
    if normalized_score >= 85:
        level = "Excellent"
    elif normalized_score >= 70:
        level = "Good"
    elif normalized_score >= 50:
        level = "Average"
    else:
        level = "Needs Improvement"

    return GameScoreResponse(
        score=attention_score,
        normalized_score=normalized_score,
        trait_scores={"attention": normalized_score * 0.8, "cognitive_flexibility": normalized_score * 0.2},
        feedback=f"Accuracy: {accuracy:.1%}, Avg response time: {average_response_time:.0f}ms, Attention performance: {level.lower()}",
        performance_level=level
    )

def score_reaction_time_game(metrics: Dict[str, Any]) -> GameScoreResponse:
    """Score Reaction Time game performance"""
    average_response_time = metrics.get('average_response_time', 500)
    correct_responses = metrics.get('correct_responses', 0)
    incorrect_responses = metrics.get('incorrect_responses', 0)
    total_trials = metrics.get('total_trials', 1)

    # Calculate accuracy
    total_responses = correct_responses + incorrect_responses
    accuracy = correct_responses / total_responses if total_responses > 0 else 0

    # Calculate processing speed score (faster = better, but penalize inaccuracy)
    # Optimal reaction time around 300-400ms
    speed_score = max(0, 1 - (average_response_time - 350) / 500)
    processing_score = speed_score * accuracy

    # Normalize to 0-100 scale
    normalized_score = min(100, max(0, processing_score * 100))

    # Determine performance level
    if normalized_score >= 85:
        level = "Excellent"
    elif normalized_score >= 70:
        level = "Good"
    elif normalized_score >= 50:
        level = "Average"
    else:
        level = "Needs Improvement"

    return GameScoreResponse(
        score=processing_score,
        normalized_score=normalized_score,
        trait_scores={"processing_speed": normalized_score},
        feedback=f"Avg reaction time: {average_response_time:.0f}ms, Accuracy: {accuracy:.1%}, Processing speed: {level.lower()}",
        performance_level=level
    )

GAME_SCORING_FUNCTIONS = {
    "NBACK": score_nback_game,
    "STROOP": score_stroop_game,
    "REACTION_TIME": score_reaction_time_game,
}

@router.post("/", response_model=GameResponse)
async def create_game(
    game_data: GameCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Check if code already exists
    existing_game = db.query(Game).filter(Game.code == game_data.code).first()
    if existing_game:
        raise HTTPException(status_code=400, detail="Game code already exists")

    # Create game
    db_game = Game(
        id=str(uuid.uuid4()),
        code=game_data.code,
        title=game_data.title,
        description=game_data.description,
        base_config=game_data.base_config
    )

    db.add(db_game)
    db.commit()
    db.refresh(db_game)

    # Log creation
    log_audit_action(
        db,
        current_user.id,
        "CREATE_GAME",
        "GAME",
        db_game.id,
        {"code": game_data.code, "title": game_data.title}
    )

    return {
        "id": db_game.id,
        "code": db_game.code,
        "title": db_game.title,
        "description": db_game.description,
        "base_config": db_game.base_config
    }

@router.get("/", response_model=List[GameResponse])
async def get_games(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Build query
    query = db.query(Game)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Game.code.ilike(search_term)) |
            (Game.title.ilike(search_term)) |
            (Game.description.ilike(search_term))
        )

    games = query.offset(skip).limit(limit).all()

    return [
        {
            "id": game.id,
            "code": game.code,
            "title": game.title,
            "description": game.description,
            "base_config": game.base_config
        } for game in games
    ]

@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return {
        "id": game.id,
        "code": game.code,
        "title": game.title,
        "description": game.description,
        "base_config": game.base_config
    }

@router.put("/{game_id}", response_model=GameResponse)
async def update_game(
    game_id: str,
    game_data: GameUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check code uniqueness if changing
    if game_data.code and game_data.code != game.code:
        existing = db.query(Game).filter(Game.code == game_data.code, Game.id != game_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Game code already exists")

    # Update fields
    if game_data.code:
        game.code = game_data.code
    if game_data.title:
        game.title = game_data.title
    if game_data.description is not None:
        game.description = game_data.description
    if game_data.base_config:
        game.base_config = game_data.base_config

    db.commit()
    db.refresh(game)

    # Log update
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_GAME",
        "GAME",
        game_id,
        {"code": game.code, "title": game.title}
    )

    return {
        "id": game.id,
        "code": game.code,
        "title": game.title,
        "description": game.description,
        "base_config": game.base_config
    }

@router.delete("/{game_id}")
async def delete_game(
    game_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if game is being used in assessments
    assessment_count = db.query(AssessmentItem).filter(AssessmentItem.game_id == game_id).count()
    if assessment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete game: {assessment_count} assessment items are using it"
        )

    # Log deletion
    log_audit_action(
        db,
        current_user.id,
        "DELETE_GAME",
        "GAME",
        game_id,
        {"code": game.code, "title": game.title}
    )

    db.delete(game)
    db.commit()

    return {"message": "Game deleted successfully"}

@router.post("/score")
async def score_game_performance(
    score_request: GameScoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Score a game performance based on metrics"""
    # Get assessment item
    item = db.query(AssessmentItem).filter(AssessmentItem.id == score_request.assessment_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Assessment item not found")

    # Get game
    game = db.query(Game).filter(Game.id == item.game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check permissions via assessment
    from models import Assessment
    assessment = db.query(Assessment).filter(Assessment.id == item.assessment_id).first()
    if current_user.role == "CANDIDATE" and assessment.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get scoring function
    scoring_function = GAME_SCORING_FUNCTIONS.get(game.code)
    if not scoring_function:
        raise HTTPException(status_code=400, detail=f"No scoring function available for game {game.code}")

    # Calculate score
    score_response = scoring_function(score_request.raw_metrics)

    # Update assessment item
    item.score = score_response.score
    item.metrics_json = {
        **score_request.raw_metrics,
        "server_scoring": {
            "normalized_score": score_response.normalized_score,
            "trait_scores": score_response.trait_scores,
            "performance_level": score_response.performance_level,
            "feedback": score_response.feedback
        }
    }

    db.commit()

    return score_response.dict()

@router.get("/available")
async def get_available_games(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available games with their configurations"""
    games = db.query(Game).all()

    return {
        "games": [
            {
                "id": game.id,
                "code": game.code,
                "title": game.title,
                "description": game.description,
                "base_config": game.base_config
            } for game in games
        ],
        "total": len(games)
    }

@router.get("/by-code/{game_code}")
async def get_game_by_code(
    game_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get game by code (useful for frontend)"""
    game = db.query(Game).filter(Game.code == game_code).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return {
        "id": game.id,
        "code": game.code,
        "title": game.title,
        "description": game.description,
        "base_config": game.base_config
    }
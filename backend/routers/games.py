from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Game

router = APIRouter()

@router.get("/")
async def get_games(db: Session = Depends(get_db)):
    games = db.query(Game).all()
    return games

@router.get("/{game_id}")
async def get_game(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game
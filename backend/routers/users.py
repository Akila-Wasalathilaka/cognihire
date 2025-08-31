from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid
from database import get_db
from models import User, Tenant
from routers.auth import get_current_admin_user, log_audit_action
from routers.auth import get_password_hash

router = APIRouter()

# Pydantic models
class UserCreate(BaseModel):
    email: str
    username: str
    password: str
    role: str = "CANDIDATE"
    is_active: bool = True

class UserUpdate(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: Optional[str]

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Validate role
    if user_data.role not in ["ADMIN", "CANDIDATE"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be ADMIN or CANDIDATE")

    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

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

    # Create user
    db_user = User(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        email=user_data.email,
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Log creation
    log_audit_action(
        db,
        current_user.id,
        "CREATE_USER",
        "USER",
        db_user.id,
        {"email": user_data.email, "role": user_data.role}
    )

    return {
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "role": db_user.role,
        "is_active": db_user.is_active,
        "created_at": db_user.created_at.isoformat(),
        "last_login_at": db_user.last_login_at.isoformat() if db_user.last_login_at else None
    }

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Build query
    query = db.query(User)

    if role:
        if role not in ["ADMIN", "CANDIDATE"]:
            raise HTTPException(status_code=400, detail="Invalid role filter")
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.username.ilike(search_term))
        )

    users = query.offset(skip).limit(limit).all()

    return [
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
        } for user in users
    ]

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
    }

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate role if provided
    if user_data.role and user_data.role not in ["ADMIN", "CANDIDATE"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be ADMIN or CANDIDATE")

    # Check email uniqueness if changing
    if user_data.email and user_data.email != user.email:
        existing = db.query(User).filter(User.email == user_data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    # Check username uniqueness if changing
    if user_data.username and user_data.username != user.username:
        existing = db.query(User).filter(User.username == user_data.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

    # Update fields
    if user_data.email:
        user.email = user_data.email
    if user_data.username:
        user.username = user_data.username
    if user_data.role:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)

    # Log update
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_USER",
        "USER",
        user_id,
        {
            "email": user_data.email,
            "username": user_data.username,
            "role": user_data.role,
            "is_active": user_data.is_active
        }
    )

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
    }

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Log deletion
    log_audit_action(
        db,
        current_user.id,
        "DELETE_USER",
        "USER",
        user_id,
        {"email": user.email, "role": user.role}
    )

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}

@router.post("/{user_id}/change-password")
async def change_user_password(
    user_id: str,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # For admin changing another user's password, skip current password check
    # For self-password change, would need current password verification
    if user_id == current_user.id:
        # Verify current password (would need password verification function)
        pass

    # Update password
    user.password_hash = get_password_hash(password_data.new_password)
    db.commit()

    # Log password change
    log_audit_action(
        db,
        current_user.id,
        "CHANGE_USER_PASSWORD",
        "USER",
        user_id,
        {"changed_by": current_user.id}
    )

    return {"message": "Password changed successfully"}

@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deactivating self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user.is_active = False
    db.commit()

    # Log deactivation
    log_audit_action(
        db,
        current_user.id,
        "DEACTIVATE_USER",
        "USER",
        user_id,
        {"email": user.email}
    )

    return {"message": "User deactivated successfully"}

@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    db.commit()

    # Log activation
    log_audit_action(
        db,
        current_user.id,
        "ACTIVATE_USER",
        "USER",
        user_id,
        {"email": user.email}
    )

    return {"message": "User activated successfully"}

@router.get("/stats/summary")
async def get_user_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user statistics summary"""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_users = db.query(User).filter(User.role == "ADMIN").count()
    candidate_users = db.query(User).filter(User.role == "CANDIDATE").count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users,
        "admin_users": admin_users,
        "candidate_users": candidate_users
    }
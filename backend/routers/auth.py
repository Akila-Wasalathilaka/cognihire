from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import uuid
from database import get_db
from models import User, Tenant, AuditLog, BlacklistedToken
import os

router = APIRouter()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "CANDIDATE"
    full_name: str = None
    job_role_id: str = None

class TokenData(BaseModel):
    username: str = None
    role: str = None

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    full_name: str = None

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    # Add JWT ID for token tracking
    jti = str(uuid.uuid4())
    to_encode.update({"exp": expire, "jti": jti})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, jti, expire

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        jti: str = payload.get("jti")
        
        if username is None or jti is None:
            raise credentials_exception
            
        # Check if token is blacklisted
        blacklisted = db.query(BlacklistedToken).filter(BlacklistedToken.token_jti == jti).first()
        if blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been invalidated",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

async def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def log_audit_action(db: Session, actor_user_id: str, action: str, target_type: str, target_id: str, payload: dict = None):
    audit_log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload_json=payload
    )
    db.add(audit_log)
    db.commit()

@router.post("/login")
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # Update last login
    user.last_login_at = datetime.utcnow()
    db.commit()

    # Log login action
    log_audit_action(db, user.id, "LOGIN", "USER", user.id, {"ip": "system"})

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token, jti, expires_at = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }
    }

@router.post("/register")
async def register(register_data: RegisterRequest, db: Session = Depends(get_db)):
    # Check if user exists
    if db.query(User).filter(User.username == register_data.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    if db.query(User).filter(User.email == register_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Get default tenant
    tenant = db.query(Tenant).first()
    if not tenant:
        # Create default tenant if it doesn't exist
        tenant = Tenant(
            id=str(uuid.uuid4()),
            name="Default Tenant",
            subdomain="default"
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

    # Create user
    hashed_password = get_password_hash(register_data.password)
    db_user = User(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        username=register_data.username,
        email=register_data.email,
        full_name=register_data.full_name,
        password_hash=hashed_password,
        role=register_data.role,
        job_role_id=register_data.job_role_id
    )
    db.add(db_user)

    # Create candidate profile if role is CANDIDATE
    if register_data.role == "CANDIDATE":
        from models import CandidateProfile
        candidate_profile = CandidateProfile(
            user_id=db_user.id,
            full_name=register_data.full_name
        )
        db.add(candidate_profile)

    db.commit()
    db.refresh(db_user)

    # Log registration action
    log_audit_action(db, db_user.id, "REGISTER", "USER", db_user.id, {"role": register_data.role})

    # Create access token for automatic login
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token, jti, expire_time = create_access_token(
        data={"sub": db_user.username, "role": db_user.role}, 
        expires_delta=access_token_expires
    )

    return {
        "message": "User created successfully", 
        "user_id": db_user.id,
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email,
            "role": db_user.role,
            "full_name": db_user.full_name,
            "is_active": db_user.is_active
        }
    }

@router.get("/profile")
async def read_users_me(current_user: User = Depends(get_current_user)):
    from models import CandidateProfile

    profile_data = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
        "created_at": current_user.created_at
    }

    # Add candidate profile data if user is a candidate
    if current_user.role == "CANDIDATE":
        candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
        if candidate_profile:
            profile_data["full_name"] = candidate_profile.full_name
            profile_data["job_role_id"] = candidate_profile.job_role_id

    return profile_data

@router.put("/profile")
async def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Update user basic info
    if "email" in profile_data:
        current_user.email = profile_data["email"]

    # Update candidate profile if user is candidate
    if current_user.role == "CANDIDATE":
        from models import CandidateProfile
        candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
        if candidate_profile:
            if "full_name" in profile_data:
                candidate_profile.full_name = profile_data["full_name"]
        else:
            # Create candidate profile if it doesn't exist
            candidate_profile = CandidateProfile(
                user_id=current_user.id,
                full_name=profile_data.get("full_name")
            )
            db.add(candidate_profile)

    db.commit()

    # Log profile update
    log_audit_action(db, current_user.id, "UPDATE_PROFILE", "USER", current_user.id, profile_data)

    return {"message": "Profile updated successfully"}

@router.post("/change-password")
async def change_password(
    password_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    old_password = password_data.get("old_password")
    new_password = password_data.get("new_password")

    if not verify_password(old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    current_user.password_hash = get_password_hash(new_password)
    db.commit()

    # Log password change
    log_audit_action(db, current_user.id, "CHANGE_PASSWORD", "USER", current_user.id)

    return {"message": "Password changed successfully"}

@router.get("/users")
async def get_users(
    skip: int = 0,
    limit: int = 100,
    role: str = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)

    users = query.offset(skip).limit(limit).all()
    return {
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at
            } for user in users
        ],
        "total": query.count()
    }

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = status_data.get("is_active", user.is_active)
    db.commit()

    # Log status change
    log_audit_action(
        db,
        current_user.id,
        "UPDATE_USER_STATUS",
        "USER",
        user_id,
        {"is_active": user.is_active}
    )

    return {"message": "User status updated successfully"}

@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        # Decode token to get JTI
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        
        if jti and exp:
            # Convert exp timestamp to datetime
            expires_at = datetime.utcfromtimestamp(exp)
            
            # Add token to blacklist
            blacklisted_token = BlacklistedToken(
                token_jti=jti,
                user_id=current_user.id,
                expires_at=expires_at
            )
            db.add(blacklisted_token)
            db.commit()
            
        # Log logout action
        log_audit_action(db, current_user.id, "LOGOUT", "USER", current_user.id)
        
        return {"message": "Logged out successfully"}
    except Exception as e:
        # Log logout anyway even if blacklisting fails
        log_audit_action(db, current_user.id, "LOGOUT", "USER", current_user.id)
        return {"message": "Logged out successfully"}

@router.post("/cleanup-expired-tokens")
async def cleanup_expired_tokens(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Clean up expired blacklisted tokens (admin only)"""
    now = datetime.utcnow()
    expired_tokens = db.query(BlacklistedToken).filter(BlacklistedToken.expires_at < now).all()
    
    count = len(expired_tokens)
    for token in expired_tokens:
        db.delete(token)
    
    db.commit()
    
    return {"message": f"Cleaned up {count} expired tokens"}
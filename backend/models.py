from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True)
    name = Column(String(200), nullable=False)
    subdomain = Column(String(200), unique=True)
    created_at = Column(DateTime, default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"))
    email = Column(String(320), unique=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False)  # ADMIN, CANDIDATE
    is_active = Column(Boolean, default=True)
    mfa_enabled = Column(Boolean, default=False)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True)
    code = Column(String(64), unique=True, nullable=False)
    title = Column(String(200))
    description = Column(Text)
    base_config = Column(JSON)

class JobRole(Base):
    __tablename__ = "job_roles"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    traits_json = Column(JSON)
    config_json = Column(JSON)
    created_at = Column(DateTime, default=func.now())

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"))
    candidate_id = Column(String, ForeignKey("users.id"))
    job_role_id = Column(String, ForeignKey("job_roles.id"))
    status = Column(String(16), default="NOT_STARTED")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    total_score = Column(Integer)
    integrity_flags = Column(JSON)

class AssessmentItem(Base):
    __tablename__ = "assessment_items"

    id = Column(String, primary_key=True)
    assessment_id = Column(String, ForeignKey("assessments.id"))
    game_id = Column(String, ForeignKey("games.id"))
    order_index = Column(Integer)
    timer_seconds = Column(Integer)
    status = Column(String(16))
    score = Column(Integer)
    metrics_json = Column(JSON)
    config_snapshot = Column(JSON)
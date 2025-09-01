from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON, DECIMAL, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    subdomain = Column(String(200), unique=True)
    created_at = Column(DateTime, default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"))
    email = Column(String(320), unique=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False)  # ADMIN, CANDIDATE
    is_active = Column(Boolean, default=True)
    mfa_enabled = Column(Boolean, default=False)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    tenant = relationship("Tenant")
    assessments = relationship("Assessment", back_populates="candidate")

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(64), unique=True, nullable=False)
    title = Column(String(200))
    description = Column(Text)
    base_config = Column(JSON)

    # Relationships
    assessment_items = relationship("AssessmentItem", back_populates="game")

class JobRole(Base):
    __tablename__ = "job_roles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    traits_json = Column(JSON)  # Cognitive traits required for this role
    config_json = Column(JSON)  # Additional configuration
    created_at = Column(DateTime, default=func.now())

    # Relationships
    tenant = relationship("Tenant")
    assessments = relationship("Assessment", back_populates="job_role")

class RoleGamePackage(Base):
    __tablename__ = "role_game_package"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_role_id = Column(String, ForeignKey("job_roles.id"))
    game_id = Column(String, ForeignKey("games.id"))
    order_index = Column(Integer, nullable=False)
    timer_seconds = Column(Integer)
    config_override = Column(JSON)

    # Relationships
    job_role = relationship("JobRole")
    game = relationship("Game")

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    full_name = Column(String(200))
    job_role_id = Column(String, ForeignKey("job_roles.id"))
    metadata_json = Column(JSON)

    # Relationships
    user = relationship("User")
    job_role = relationship("JobRole")

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"))
    candidate_id = Column(String, ForeignKey("users.id"))
    job_role_id = Column(String, ForeignKey("job_roles.id"))
    status = Column(String(16), default="NOT_STARTED")  # NOT_STARTED, IN_PROGRESS, COMPLETED, EXPIRED, CANCELLED
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    total_score = Column(DECIMAL(9,3))
    integrity_flags = Column(JSON)

    # Relationships
    tenant = relationship("Tenant")
    candidate = relationship("User", back_populates="assessments")
    job_role = relationship("JobRole", back_populates="assessments")
    items = relationship("AssessmentItem", back_populates="assessment")

class AssessmentItem(Base):
    __tablename__ = "assessment_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String, ForeignKey("assessments.id"))
    game_id = Column(String, ForeignKey("games.id"))
    order_index = Column(Integer)
    timer_seconds = Column(Integer)
    server_started_at = Column(DateTime)
    server_deadline_at = Column(DateTime)
    status = Column(String(16))  # PENDING, ACTIVE, EXPIRED, SUBMITTED
    score = Column(DECIMAL(9,3))
    metrics_json = Column(JSON)
    config_snapshot = Column(JSON)

    # Relationships
    assessment = relationship("Assessment", back_populates="items")
    game = relationship("Game", back_populates="assessment_items")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String, ForeignKey("assessments.id"))
    storage_key = Column(String(512))
    created_at = Column(DateTime, default=func.now())

    # Relationships
    assessment = relationship("Assessment")

class BlacklistedToken(Base):
    __tablename__ = "blacklisted_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    token_jti = Column(String(255), unique=True, nullable=False)  # JWT ID
    user_id = Column(String, ForeignKey("users.id"))
    blacklisted_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=False)

    # Relationships
    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String)
    actor_user_id = Column(String)
    action = Column(String(128))
    target_type = Column(String(64))
    target_id = Column(String)
    ip = Column(String(64))
    user_agent = Column(String(256))
    payload_json = Column(JSON)
    created_at = Column(DateTime, default=func.now())
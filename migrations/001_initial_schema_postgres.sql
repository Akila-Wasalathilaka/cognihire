-- CogniHire Initial Schema Migration
-- PostgreSQL 13+ compatible

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  subdomain       VARCHAR(200) UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  email           VARCHAR(320) UNIQUE,
  username        VARCHAR(64) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(16) CHECK (role IN ('ADMIN','CANDIDATE')) NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  mfa_enabled     BOOLEAN DEFAULT false,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(64) UNIQUE NOT NULL,
  title           VARCHAR(200),
  description     TEXT,
  base_config     JSONB
);

-- Job Roles table
CREATE TABLE job_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  traits_json     JSONB,
  config_json     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate Profiles table
CREATE TABLE candidate_profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  full_name       VARCHAR(200),
  job_role_id     UUID REFERENCES job_roles(id),
  metadata_json   JSONB
);

-- Game Trait Map table
CREATE TABLE game_trait_map (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID REFERENCES games(id),
  trait           VARCHAR(64),
  weight          DECIMAL(5,4)
);

-- Role Game Package table
CREATE TABLE role_game_package (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_role_id     UUID REFERENCES job_roles(id),
  game_id         UUID REFERENCES games(id),
  order_index     INTEGER NOT NULL,
  timer_seconds   INTEGER,
  config_override JSONB
);

-- Assessments table
CREATE TABLE assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  candidate_id    UUID REFERENCES users(id),
  job_role_id     UUID REFERENCES job_roles(id),
  status          VARCHAR(16) CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','EXPIRED','CANCELLED')) DEFAULT 'NOT_STARTED',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  total_score     DECIMAL(9,3),
  integrity_flags JSONB
);

-- Assessment Items table
CREATE TABLE assessment_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID REFERENCES assessments(id),
  game_id         UUID REFERENCES games(id),
  order_index     INTEGER,
  timer_seconds   INTEGER,
  server_started_at TIMESTAMPTZ,
  server_deadline_at TIMESTAMPTZ,
  status          VARCHAR(16) CHECK (status IN ('PENDING','ACTIVE','EXPIRED','SUBMITTED')),
  score           DECIMAL(9,3),
  metrics_json    JSONB,
  config_snapshot JSONB
);

-- Reports table
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID REFERENCES assessments(id),
  storage_key     VARCHAR(512),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs table
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID,
  actor_user_id   UUID,
  action          VARCHAR(128),
  target_type     VARCHAR(64),
  target_id       UUID,
  ip              VARCHAR(64),
  user_agent      VARCHAR(256),
  payload_json    JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id),
  name            VARCHAR(128),
  hash            VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_tenant_role_active ON users(tenant_id, role, is_active);
CREATE INDEX idx_assessments_candidate_status ON assessments(candidate_id, status);
CREATE INDEX idx_assessments_job_role ON assessments(job_role_id);
CREATE INDEX idx_assessment_items_assessment_status ON assessment_items(assessment_id, status);
CREATE INDEX idx_role_game_package_job_role_order ON role_game_package(job_role_id, order_index);

-- Create a default tenant for development
INSERT INTO tenants (id, name, subdomain) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Default Tenant', 'default');

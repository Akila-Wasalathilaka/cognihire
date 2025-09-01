-- CogniHire Initial Schema Migration
-- Oracle Database 19c+ compatible

-- Enable extended data types for JSON support
ALTER SESSION SET NLS_LENGTH_SEMANTICS = CHAR;

-- Create sequences for ID generation
CREATE SEQUENCE seq_tenants START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_users START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_candidate_profiles START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_job_roles START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_games START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_game_trait_map START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_role_game_package START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_assessments START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_assessment_items START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_reports START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_audit_logs START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_api_keys START WITH 1 INCREMENT BY 1;

-- Tenants table
CREATE TABLE TENANTS (
  id              VARCHAR2(36) PRIMARY KEY,
  name            VARCHAR2(200) NOT NULL,
  subdomain       VARCHAR2(200) UNIQUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

-- Users table
CREATE TABLE USERS (
  id              VARCHAR2(36) PRIMARY KEY,
  tenant_id       VARCHAR2(36) NOT NULL REFERENCES TENANTS(id),
  email           VARCHAR2(320) UNIQUE,
  username        VARCHAR2(64) UNIQUE NOT NULL,
  password_hash   VARCHAR2(255) NOT NULL,
  role            VARCHAR2(16) CHECK (role IN ('ADMIN','CANDIDATE')) NOT NULL,
  is_active       NUMBER(1) DEFAULT 1,
  mfa_enabled     NUMBER(1) DEFAULT 0,
  last_login_at   TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

-- Candidate Profiles table
CREATE TABLE CANDIDATE_PROFILES (
  user_id         VARCHAR2(36) PRIMARY KEY REFERENCES USERS(id),
  full_name       VARCHAR2(200),
  job_role_id     VARCHAR2(36) REFERENCES JOB_ROLES(id),
  metadata_json   CLOB CHECK (metadata_json IS JSON)
);

-- Job Roles table
CREATE TABLE JOB_ROLES (
  id              VARCHAR2(36) PRIMARY KEY,
  tenant_id       VARCHAR2(36) NOT NULL REFERENCES TENANTS(id),
  title           VARCHAR2(200) NOT NULL,
  description     CLOB,
  traits_json     CLOB CHECK (traits_json IS JSON),
  config_json     CLOB CHECK (config_json IS JSON),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

-- Games table
CREATE TABLE GAMES (
  id              VARCHAR2(36) PRIMARY KEY,
  code            VARCHAR2(64) UNIQUE NOT NULL,
  title           VARCHAR2(200),
  description     CLOB,
  base_config     CLOB CHECK (base_config IS JSON)
);

-- Game Trait Map table
CREATE TABLE GAME_TRAIT_MAP (
  id              VARCHAR2(36) PRIMARY KEY,
  game_id         VARCHAR2(36) REFERENCES GAMES(id),
  trait           VARCHAR2(64),
  weight          NUMBER(5,4)
);

-- Role Game Package table
CREATE TABLE ROLE_GAME_PACKAGE (
  id              VARCHAR2(36) PRIMARY KEY,
  job_role_id     VARCHAR2(36) REFERENCES JOB_ROLES(id),
  game_id         VARCHAR2(36) REFERENCES GAMES(id),
  order_index     NUMBER(4) NOT NULL,
  timer_seconds   NUMBER(6),
  config_override CLOB CHECK (config_override IS JSON)
);

-- Assessments table
CREATE TABLE ASSESSMENTS (
  id              VARCHAR2(36) PRIMARY KEY,
  tenant_id       VARCHAR2(36) REFERENCES TENANTS(id),
  candidate_id    VARCHAR2(36) REFERENCES USERS(id),
  job_role_id     VARCHAR2(36) REFERENCES JOB_ROLES(id),
  status          VARCHAR2(16) CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','EXPIRED','CANCELLED')) DEFAULT 'NOT_STARTED',
  started_at      TIMESTAMP WITH TIME ZONE,
  completed_at    TIMESTAMP WITH TIME ZONE,
  total_score     NUMBER(9,3),
  integrity_flags CLOB CHECK (integrity_flags IS JSON)
);

-- Assessment Items table
CREATE TABLE ASSESSMENT_ITEMS (
  id              VARCHAR2(36) PRIMARY KEY,
  assessment_id   VARCHAR2(36) REFERENCES ASSESSMENTS(id),
  game_id         VARCHAR2(36) REFERENCES GAMES(id),
  order_index     NUMBER(4),
  timer_seconds   NUMBER(6),
  server_started_at TIMESTAMP WITH TIME ZONE,
  server_deadline_at TIMESTAMP WITH TIME ZONE,
  status          VARCHAR2(16) CHECK (status IN ('PENDING','ACTIVE','EXPIRED','SUBMITTED')),
  score           NUMBER(9,3),
  metrics_json    CLOB CHECK (metrics_json IS JSON),
  config_snapshot CLOB CHECK (config_snapshot IS JSON)
);

-- Reports table
CREATE TABLE REPORTS (
  id              VARCHAR2(36) PRIMARY KEY,
  assessment_id   VARCHAR2(36) REFERENCES ASSESSMENTS(id),
  storage_key     VARCHAR2(512),
  created_at      TIMESTAMP WITH TIME ZONE
);

-- Audit Logs table
CREATE TABLE AUDIT_LOGS (
  id              VARCHAR2(36) PRIMARY KEY,
  tenant_id       VARCHAR2(36),
  actor_user_id   VARCHAR2(36),
  action          VARCHAR2(128),
  target_type     VARCHAR2(64),
  target_id       VARCHAR2(36),
  ip              VARCHAR2(64),
  user_agent      VARCHAR2(256),
  payload_json    CLOB CHECK (payload_json IS JSON),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

-- API Keys table
CREATE TABLE API_KEYS (
  id              VARCHAR2(36) PRIMARY KEY,
  tenant_id       VARCHAR2(36) REFERENCES TENANTS(id),
  name            VARCHAR2(128),
  hash            VARCHAR2(255),
  created_at      TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_users_tenant_role_active ON USERS(tenant_id, role, is_active);
CREATE INDEX idx_assessments_candidate_status ON ASSESSMENTS(candidate_id, status);
CREATE INDEX idx_assessments_job_role ON ASSESSMENTS(job_role_id);
CREATE INDEX idx_assessment_items_assessment_status ON ASSESSMENT_ITEMS(assessment_id, status);
CREATE INDEX idx_role_game_package_job_role_order ON ROLE_GAME_PACKAGE(job_role_id, order_index);

-- Insert default tenant
INSERT INTO TENANTS (id, name, subdomain) VALUES ('default-tenant-id', 'Default Tenant', 'default');

-- Insert sample games
INSERT INTO GAMES (id, code, title, description, base_config) VALUES
('game-nback-id', 'NBACK', 'N-Back Task', 'Working memory assessment', '{"timer": 300, "rounds": 3, "difficulty": "medium"}'),
('game-stroop-id', 'STROOP', 'Stroop Test', 'Cognitive interference assessment', '{"timer": 180, "trials": 50, "colors": ["red","blue","green","yellow"]}'),
('game-digit-span-id', 'DIGIT_SPAN', 'Digit Span', 'Short-term memory assessment', '{"timer": 240, "max_length": 9, "trials_per_length": 2}');

-- Insert sample traits
INSERT INTO GAME_TRAIT_MAP (id, game_id, trait, weight) VALUES
('map-nback-memory', 'game-nback-id', 'memory', 0.7),
('map-nback-attention', 'game-nback-id', 'attention', 0.3),
('map-stroop-logic', 'game-stroop-id', 'logic', 0.6),
('map-stroop-attention', 'game-stroop-id', 'attention', 0.4),
('map-digit-memory', 'game-digit-span-id', 'memory', 0.8),
('map-digit-attention', 'game-digit-span-id', 'attention', 0.2);

COMMIT;

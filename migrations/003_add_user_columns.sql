-- Migration script to add full_name and job_role_id columns to users table
-- This script is safe to run multiple times

-- Add full_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE users ADD COLUMN full_name VARCHAR(200);
        RAISE NOTICE 'Added full_name column to users table';
    ELSE
        RAISE NOTICE 'full_name column already exists in users table';
    END IF;
END
$$;

-- Add job_role_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'job_role_id'
    ) THEN
        ALTER TABLE users ADD COLUMN job_role_id VARCHAR(36);
        RAISE NOTICE 'Added job_role_id column to users table';
    ELSE
        RAISE NOTICE 'job_role_id column already exists in users table';
    END IF;
END
$$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_name = 'users_job_role_id_fkey'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_job_role_id_fkey 
        FOREIGN KEY (job_role_id) REFERENCES job_roles(id);
        RAISE NOTICE 'Added foreign key constraint for job_role_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint for job_role_id already exists';
    END IF;
END
$$;

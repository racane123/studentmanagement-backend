-- Create subject table
CREATE TABLE IF NOT EXISTS subject (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    department VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create teacher_subjects junction table
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    schoolYear VARCHAR(9) NOT NULL CHECK (schoolYear ~ '^\d{4}-\d{4}$'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(teacher_id, subject_id, schoolYear)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subject_name ON subject(name);
CREATE INDEX IF NOT EXISTS idx_subject_code ON subject(code);
CREATE INDEX IF NOT EXISTS idx_subject_department ON subject(department);
CREATE INDEX IF NOT EXISTS idx_subject_active ON subject(is_active);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_school_year ON teacher_subjects(schoolYear);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_active ON teacher_subjects(is_active); 
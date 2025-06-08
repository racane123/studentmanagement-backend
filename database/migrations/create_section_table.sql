-- Drop existing tables if they exist
DROP TABLE IF EXISTS section_students CASCADE;
DROP TABLE IF EXISTS section_subjects CASCADE;
DROP TABLE IF EXISTS section_advisers CASCADE;
DROP TABLE IF EXISTS sections CASCADE;

-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    grade_level VARCHAR(10) NOT NULL,
    school_year VARCHAR(9) NOT NULL CHECK (school_year ~ '^\d{4}-\d{4}$'),
    adviser_id INTEGER REFERENCES teacher(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create section_students table (many-to-many)
CREATE TABLE IF NOT EXISTS section_students (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES student(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(section_id, student_id)
);

-- Create section_subjects table (many-to-many)
CREATE TABLE IF NOT EXISTS section_subjects (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subject(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE,
    schedule VARCHAR(50) NOT NULL,
    room VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(section_id, subject_id)
);

-- Create section_advisers table (one-to-many)
CREATE TABLE IF NOT EXISTS section_advisers (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_section_name ON sections(name);
CREATE INDEX IF NOT EXISTS idx_section_grade_level ON sections(grade_level);
CREATE INDEX IF NOT EXISTS idx_section_school_year ON sections(school_year);
CREATE INDEX IF NOT EXISTS idx_section_adviser ON sections(adviser_id);
CREATE INDEX IF NOT EXISTS idx_section_active ON sections(is_active);

CREATE INDEX IF NOT EXISTS idx_section_subjects_section ON section_subjects(section_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_subject ON section_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_teacher ON section_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_active ON section_subjects(is_active);

CREATE INDEX IF NOT EXISTS idx_section_students_section ON section_students(section_id);
CREATE INDEX IF NOT EXISTS idx_section_students_student ON section_students(student_id);
CREATE INDEX IF NOT EXISTS idx_section_students_active ON section_students(is_active); 
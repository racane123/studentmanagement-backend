-- Create section table
CREATE TABLE IF NOT EXISTS section (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    school_year VARCHAR(9) NOT NULL CHECK (school_year ~ '^\d{4}-\d{4}$'),
    adviser_id INTEGER REFERENCES teacher(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(name, grade_level, school_year)
);

-- Create section_subjects table (for subject assignments to sections)
CREATE TABLE IF NOT EXISTS section_subjects (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES section(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
    schedule VARCHAR(100),
    room VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(section_id, subject_id, teacher_id)
);

-- Create section_students table (for student enrollment in sections)
CREATE TABLE IF NOT EXISTS section_students (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES section(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'transferred')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(section_id, student_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_section_name ON section(name);
CREATE INDEX IF NOT EXISTS idx_section_grade_level ON section(grade_level);
CREATE INDEX IF NOT EXISTS idx_section_school_year ON section(school_year);
CREATE INDEX IF NOT EXISTS idx_section_adviser ON section(adviser_id);
CREATE INDEX IF NOT EXISTS idx_section_active ON section(is_active);

CREATE INDEX IF NOT EXISTS idx_section_subjects_section ON section_subjects(section_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_subject ON section_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_teacher ON section_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_active ON section_subjects(is_active);

CREATE INDEX IF NOT EXISTS idx_section_students_section ON section_students(section_id);
CREATE INDEX IF NOT EXISTS idx_section_students_student ON section_students(student_id);
CREATE INDEX IF NOT EXISTS idx_section_students_status ON section_students(status);
CREATE INDEX IF NOT EXISTS idx_section_students_active ON section_students(is_active); 
-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    grade_level INTEGER NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create section_students table (many-to-many)
CREATE TABLE IF NOT EXISTS section_students (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES student(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, student_id)
);

-- Create section_subjects table (many-to-many)
CREATE TABLE IF NOT EXISTS section_subjects (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subject(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
CREATE INDEX IF NOT EXISTS idx_section_academic_year ON sections(academic_year);

CREATE INDEX IF NOT EXISTS idx_section_subjects_section ON section_subjects(section_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_subject ON section_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_teacher ON section_subjects(teacher_id);

CREATE INDEX IF NOT EXISTS idx_section_students_section ON section_students(section_id);
CREATE INDEX IF NOT EXISTS idx_section_students_student ON section_students(student_id); 
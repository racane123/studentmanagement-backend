-- Create student table
CREATE TABLE IF NOT EXISTS student (
    id SERIAL PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    middleName VARCHAR(50),
    lastName VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER NOT NULL CHECK (age >= 4 AND age <= 100),
    section VARCHAR(10),
    schoolYear VARCHAR(9) NOT NULL CHECK (schoolYear ~ '^\d{4}-\d{4}$'),
    schoolName VARCHAR(100),
    subject VARCHAR(50),
    gradingPeriod VARCHAR(20),
    division VARCHAR(50),
    grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 12),
    classSection VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_student_name ON student(lastName, firstName);
CREATE INDEX IF NOT EXISTS idx_student_grade ON student(grade);
CREATE INDEX IF NOT EXISTS idx_student_section ON student(section);
CREATE INDEX IF NOT EXISTS idx_student_school_year ON student(schoolYear);
CREATE INDEX IF NOT EXISTS idx_student_active ON student(is_active); 
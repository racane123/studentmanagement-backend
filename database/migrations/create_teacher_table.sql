-- Create teacher table
CREATE TABLE IF NOT EXISTS teacher (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(50) NOT NULL,
    middlename VARCHAR(50),
    lastname VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER NOT NULL CHECK (age >= 21 AND age <= 100),
    email VARCHAR(100) NOT NULL UNIQUE,
    phonenumber VARCHAR(20),
    department VARCHAR(50),
    qualification VARCHAR(100),
    yearsofexperience INTEGER,
    schoolyear VARCHAR(9) NOT NULL CHECK (schoolyear ~ '^\d{4}-\d{4}$'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teacher_firstname ON teacher(firstname);
CREATE INDEX IF NOT EXISTS idx_teacher_lastname ON teacher(lastname);
CREATE INDEX IF NOT EXISTS idx_teacher_email ON teacher(email);
CREATE INDEX IF NOT EXISTS idx_teacher_department ON teacher(department);
CREATE INDEX IF NOT EXISTS idx_teacher_schoolyear ON teacher(schoolyear);
CREATE INDEX IF NOT EXISTS idx_teacher_active ON teacher(is_active); 
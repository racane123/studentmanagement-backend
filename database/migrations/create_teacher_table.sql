-- Create teacher table
CREATE TABLE IF NOT EXISTS teacher (
    id SERIAL PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    middleName VARCHAR(50),
    lastName VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER NOT NULL CHECK (age >= 21 AND age <= 100),
    email VARCHAR(100) NOT NULL UNIQUE,
    phoneNumber VARCHAR(20),
    department VARCHAR(50),
    qualification VARCHAR(100),
    yearsOfExperience INTEGER,
    schoolYear VARCHAR(9) NOT NULL CHECK (schoolYear ~ '^\d{4}-\d{4}$'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teacher_firstName ON teacher(firstName);
CREATE INDEX IF NOT EXISTS idx_teacher_lastName ON teacher(lastName);
CREATE INDEX IF NOT EXISTS idx_teacher_email ON teacher(email);
CREATE INDEX IF NOT EXISTS idx_teacher_department ON teacher(department);
CREATE INDEX IF NOT EXISTS idx_teacher_schoolYear ON teacher(schoolYear);
CREATE INDEX IF NOT EXISTS idx_teacher_active ON teacher(is_active); 
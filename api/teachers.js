import pool from "../database/db.js"
import express from 'express'

const teacherRouter = express.Router()

// Get all teachers with pagination and search
teacherRouter.get('/teachers', async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search,
        department,
        schoolYear
    } = req.query;

    const offset = (page - 1) * limit;
    const queryParams = [];
    let paramCount = 1;

    let query = `
        SELECT t.*, 
               (SELECT COUNT(*) 
                FROM teacher_subjects ts 
                WHERE ts.teacher_id = t.id AND ts.is_active = true) as subject_count
        FROM teacher t
        WHERE t.is_active = true
    `;

    // Filters
    if (search) {
        query += ` AND (
            LOWER(t.firstname) LIKE LOWER($${paramCount}) OR 
            LOWER(t.lastname) LIKE LOWER($${paramCount}) OR
            LOWER(t.email) LIKE LOWER($${paramCount})
        )`;
        queryParams.push(`%${search}%`);
        paramCount++;
    }

    if (department) {
        query += ` AND t.department = $${paramCount}`;
        queryParams.push(department);
        paramCount++;
    }

    if (schoolYear) {
        query += ` AND t.schoolyear = $${paramCount}`;
        queryParams.push(schoolYear);
        paramCount++;
    }

    // Pagination and Sorting
    query += ` ORDER BY t.lastname, t.firstname LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    try {
        // Fetch paginated teacher data
        const result = await pool.query(query, queryParams);
        const teachers = result.rows;

        // Build count query with reused filters
        let countQuery = `
            SELECT COUNT(DISTINCT t.id)
            FROM teacher t
            WHERE t.is_active = true
        `;
        const countParams = [];
        let countParamCount = 1;

        if (search) {
            countQuery += ` AND (
                LOWER(t.firstname) LIKE LOWER($${countParamCount}) OR 
                LOWER(t.lastname) LIKE LOWER($${countParamCount}) OR
                LOWER(t.email) LIKE LOWER($${countParamCount})
            )`;
            countParams.push(`%${search}%`);
            countParamCount++;
        }

        if (department) {
            countQuery += ` AND t.department = $${countParamCount}`;
            countParams.push(department);
            countParamCount++;
        }

        if (schoolYear) {
            countQuery += ` AND t.schoolyear = $${countParamCount}`;
            countParams.push(schoolYear);
            countParamCount++;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        // Success response
        res.status(200).json({
            message: "Successfully retrieved teachers",
            teachers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching teachers:", error.message);
        res.status(500).json({
            message: "Error fetching teachers",
            error: error.message
        });
    }
});

// Input validation middleware
const validateTeacherInput = (req, res, next) => {
    const { firstname, lastname, gender, age, email, schoolyear } = req.body
    
    const errors = []
    
    if (!firstname || firstname.trim().length === 0) {
        errors.push('First name is required')
    }
    if (!lastname || lastname.trim().length === 0) {
        errors.push('Last name is required')
    }
    if (!gender || !['male', 'female', 'other'].includes(gender.toLowerCase())) {
        errors.push('Gender must be male, female, or other')
    }
    if (!age || isNaN(age) || age < 21 || age > 100) {
        errors.push('Age must be a number between 21 and 100')
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Valid email is required')
    }
    if (!schoolyear || !/^\d{4}-\d{4}$/.test(schoolyear)) {
        errors.push('School year must be in format YYYY-YYYY')
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        })
    }
    
    next()
}

// Create teacher
teacherRouter.post("/teachers", validateTeacherInput, async (req, res) => {
    const {
        firstname, middlename, lastname, gender, age, email,
        phonenumber, department, qualification,
        yearsofexperience, schoolyear
    } = req.body

    const query = `
        INSERT INTO teacher(
            firstname, middlename, lastname, gender, age, email,
            phonenumber, department, qualification,
            yearsofexperience, schoolyear, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) 
        RETURNING *
    `
    const insertQuery = [
        firstname, middlename, lastname, gender, age, email,
        phonenumber, department, qualification,
        yearsofexperience, schoolyear
    ]

    try {
        const result = await pool.query(query, insertQuery)
        const teacher = result.rows[0]

        if (!teacher) {
            res.status(400).json({
                message: "Error creating the teacher"
            })
        } else {
            res.status(200).json({
                message: "Successfully added the teacher",
                teacher
            })
        }
    } catch (error) {
        console.error({
            message: `Error creating the teacher: ${error.message}`
        })
        res.status(500).json({
            message: "Error creating teacher",
            error: error.message
        })
    }
})

// Get single teacher by ID with details
teacherRouter.get('/teachers/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        SELECT t.*, 
               (
                   SELECT json_agg(json_build_object(
                       'id', s.id,
                       'name', s.name,
                       'code', s.code,
                       'schedule', ts.schedule,
                       'room', ts.room
                   ))
                   FROM teacher_subjects ts
                   JOIN subject s ON ts.subject_id = s.id
                   WHERE ts.teacher_id = t.id AND ts.is_active = true
               ) as subjects
        FROM teacher t
        WHERE t.id = $1 AND t.is_active = true
    `

    try {
        const result = await pool.query(query, [id])
        const teacher = result.rows[0]

        if (!teacher) {
            res.status(404).json({
                message: "Teacher not found"
            })
        } else {
            // Filter out null values from arrays
            teacher.subjects = teacher.subjects?.filter(s => s !== null) || []
            
            res.status(200).json({
                message: "Successfully retrieved teacher",
                teacher
            })
        }
    } catch (error) {
        console.error({
            message: `Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching teacher",
            error: error.message
        })
    }
})

// Update teacher
teacherRouter.put('/teachers/:id', validateTeacherInput, async (req, res) => {
    const { id } = req.params
    const {
        firstname, middlename, lastname, gender, age, email,
        phonenumber, department, qualification,
        yearsofexperience, schoolyear
    } = req.body
    
    const query = `
        UPDATE teacher 
        SET firstname = $1, 
            middlename = $2, 
            lastname = $3, 
            gender = $4, 
            age = $5, 
            email = $6,
            phonenumber = $7,
            department = $8,
            qualification = $9,
            yearsofexperience = $10,
            schoolyear = $11,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $12 AND is_active = true
        RETURNING *
    `
    const updateQuery = [
        firstname, middlename, lastname, gender, age, email,
        phonenumber, department, qualification,
        yearsofexperience, schoolyear, id
    ]

    try {
        const result = await pool.query(query, updateQuery)
        const updatedTeacher = result.rows[0]

        if (!updatedTeacher) {
            res.status(404).json({
                message: "Teacher not found"
            })
        } else {
            res.status(200).json({
                message: "Teacher updated successfully",
                teacher: updatedTeacher
            })
        }
    } catch (error) {
        console.error({
            message: `Error updating teacher: ${error.message}`
        })
        res.status(500).json({
            message: "Error updating teacher",
            error: error.message
        })
    }
})

// Soft delete teacher
teacherRouter.delete('/teachers/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        UPDATE teacher 
        SET is_active = false,
            deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING *
    `

    try {
        const result = await pool.query(query, [id])
        const deletedTeacher = result.rows[0]

        if (!deletedTeacher) {
            res.status(404).json({
                message: "Teacher not found"
            })
        } else {
            res.status(200).json({
                message: "Teacher deleted successfully",
                teacher: deletedTeacher
            })
        }
    } catch (error) {
        console.error({
            message: `Error deleting teacher: ${error.message}`
        })
        res.status(500).json({
            message: "Error deleting teacher",
            error: error.message
        })
    }
})

// Assign subjects to teacher
teacherRouter.post('/teachers/:teacherId/subjects', async (req, res) => {
    const { teacherId } = req.params
    const { subjectIds, schoolyear } = req.body

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({
            message: 'Subject IDs array is required'
        })
    }

    if (!schoolyear || !/^\d{4}-\d{4}$/.test(schoolyear)) {
        return res.status(400).json({
            message: 'Valid school year (YYYY-YYYY) is required'
        })
    }

    const client = await pool.connect()

    try {
        // First verify that the teacher exists
        const teacherCheck = await client.query(
            'SELECT id FROM teacher WHERE id = $1 AND is_active = true',
            [teacherId]
        )

        if (teacherCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Teacher not found'
            })
        }

        // Then verify that all subjects exist
        const subjectCheck = await client.query(
            'SELECT id FROM subject WHERE id = ANY($1) AND is_active = true',
            [subjectIds]
        )

        if (subjectCheck.rows.length !== subjectIds.length) {
            return res.status(404).json({
                message: 'One or more subjects not found'
            })
        }

        await client.query('BEGIN')

        // First, deactivate all existing subject assignments for this teacher and school year
        await client.query(
            `UPDATE teacher_subjects 
             SET is_active = false, 
                 deleted_at = CURRENT_TIMESTAMP
             WHERE teacher_id = $1 AND schoolyear = $2`,
            [teacherId, schoolyear]
        )

        // Then, insert new assignments
        for (const subjectId of subjectIds) {
            await client.query(
                `INSERT INTO teacher_subjects (teacher_id, subject_id, schoolyear)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (teacher_id, subject_id, schoolyear) 
                 DO UPDATE SET is_active = true, 
                              deleted_at = NULL,
                              updated_at = CURRENT_TIMESTAMP`,
                [teacherId, subjectId, schoolyear]
            )
        }

        await client.query('COMMIT')

        // Get updated teacher with subjects
        const result = await client.query(
            `SELECT t.*, 
                    json_agg(json_build_object(
                        'id', s.id,
                        'name', s.name,
                        'code', s.code
                    )) as subjects
             FROM teacher t
             LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id AND ts.is_active = true
             LEFT JOIN subject s ON ts.subject_id = s.id AND s.is_active = true
             WHERE t.id = $1 AND t.is_active = true
             GROUP BY t.id`,
            [teacherId]
        )

        const teacher = result.rows[0]
        teacher.subjects = teacher.subjects.filter(s => s.id !== null)

        res.status(200).json({
            message: "Subjects assigned successfully",
            teacher
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error assigning subjects: ${error.message}`
        })
        res.status(500).json({
            message: "Error assigning subjects",
            error: error.message
        })
    } finally {
        client.release()
    }
})

// Get teacher's subjects
teacherRouter.get('/teachers/:teacherId/subjects', async (req, res) => {
    const { teacherId } = req.params
    const { schoolyear } = req.query

    let query = `
        SELECT s.*
        FROM subject s
        JOIN teacher_subjects ts ON s.id = ts.subject_id
        WHERE ts.teacher_id = $1 
        AND ts.is_active = true
        AND s.is_active = true
    `
    const queryParams = [teacherId]

    if (schoolyear) {
        query += ` AND ts.schoolyear = $2`
        queryParams.push(schoolyear)
    }

    try {
        const result = await pool.query(query, queryParams)
        res.status(200).json({
            message: "Successfully retrieved teacher's subjects",
            subjects: result.rows
        })
    } catch (error) {
        console.error({
            message: `Error fetching teacher's subjects: ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching teacher's subjects",
            error: error.message
        })
    }
})

// Get teachers for display (dropdowns/lists)
teacherRouter.get('/teachers/display', async (req, res) => {
    const { schoolyear } = req.query

    const query = `
        SELECT 
            t.id,
            t.firstname,
            t.lastname,
            t.department,
            t.schoolyear,
            (SELECT COUNT(*) FROM teacher_subjects ts WHERE ts.teacher_id = t.id AND ts.is_active = true) as subject_count
        FROM teacher t
        WHERE t.is_active = true
        ${schoolyear ? `AND t.schoolyear = $1` : ''}
        ORDER BY t.lastname, t.firstname
    `

    try {
        const result = await pool.query(query, schoolyear ? [schoolyear] : [])
        const teachers = result.rows

        res.status(200).json({
            message: "Successfully retrieved teachers for display",
            teachers
        })
    } catch (error) {
        console.error({
            message: `Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching teachers for display",
            error: error.message
        })
    }
})

export default teacherRouter 
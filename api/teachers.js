import pool from "../database/db.js"
import express from 'express'

const teacherRouter = express.Router()

// Input validation middleware
const validateTeacherInput = (req, res, next) => {
    const { firstName, lastName, gender, age, email, schoolYear } = req.body
    
    const errors = []
    
    if (!firstName || firstName.trim().length === 0) {
        errors.push('First name is required')
    }
    if (!lastName || lastName.trim().length === 0) {
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
    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
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
        firstName, middleName, lastName, gender, age, email,
        phoneNumber, department, qualification,
        yearsOfExperience, schoolYear
    } = req.body

    const query = `
        INSERT INTO teacher(
            firstName, middleName, lastName, gender, age, email,
            phoneNumber, department, qualification,
            yearsOfExperience, schoolYear, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) 
        RETURNING *
    `
    const insertQuery = [
        firstName, middleName, lastName, gender, age, email,
        phoneNumber, department, qualification,
        yearsOfExperience, schoolYear
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

// Get all teachers with pagination and search
teacherRouter.get('/teachers', async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search,
        department,
        schoolYear
    } = req.query

    const offset = (page - 1) * limit
    let query = `
        SELECT t.*, 
               json_agg(json_build_object(
                   'id', s.id,
                   'name', s.name,
                   'code', s.code
               )) as subjects
        FROM teacher t
        LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id AND ts.is_active = true
        LEFT JOIN subject s ON ts.subject_id = s.id AND s.is_active = true
        WHERE t.is_active = true
    `
    const queryParams = []
    let paramCount = 1

    if (search) {
        query += ` AND (
            LOWER(t.firstName) LIKE LOWER($${paramCount}) OR 
            LOWER(t.lastName) LIKE LOWER($${paramCount}) OR 
            LOWER(t.middleName) LIKE LOWER($${paramCount}) OR
            LOWER(t.email) LIKE LOWER($${paramCount})
        )`
        queryParams.push(`%${search}%`)
        paramCount++
    }

    if (department) {
        query += ` AND t.department = $${paramCount}`
        queryParams.push(department)
        paramCount++
    }

    if (schoolYear) {
        query += ` AND t.schoolYear = $${paramCount}`
        queryParams.push(schoolYear)
        paramCount++
    }

    // Add pagination
    query += ` GROUP BY t.id ORDER BY t.lastName, t.firstName LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    try {
        const result = await pool.query(query, queryParams)
        const teachers = result.rows.map(teacher => ({
            ...teacher,
            subjects: teacher.subjects.filter(s => s.id !== null)
        }))

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(DISTINCT t.id)
            FROM teacher t
            WHERE t.is_active = true
            ${search ? `AND (
                LOWER(t.firstName) LIKE LOWER($1) OR 
                LOWER(t.lastName) LIKE LOWER($1) OR 
                LOWER(t.middleName) LIKE LOWER($1) OR
                LOWER(t.email) LIKE LOWER($1)
            )` : ''}
            ${department ? `AND t.department = $${search ? 2 : 1}` : ''}
            ${schoolYear ? `AND t.schoolYear = $${search ? (department ? 3 : 2) : (department ? 2 : 1)}` : ''}
        `
        const countParams = []
        if (search) countParams.push(`%${search}%`)
        if (department) countParams.push(department)
        if (schoolYear) countParams.push(schoolYear)

        const countResult = await pool.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count)

        res.status(200).json({
            message: "Successfully retrieved the data",
            teachers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error({
            message: `Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching teachers",
            error: error.message
        })
    }
})

// Get single teacher by ID
teacherRouter.get('/teachers/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        SELECT t.*, 
               json_agg(json_build_object(
                   'id', s.id,
                   'name', s.name,
                   'code', s.code
               )) as subjects
        FROM teacher t
        LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id AND ts.is_active = true
        LEFT JOIN subject s ON ts.subject_id = s.id AND s.is_active = true
        WHERE t.id = $1 AND t.is_active = true
        GROUP BY t.id
    `

    try {
        const result = await pool.query(query, [id])
        const teacher = result.rows[0]

        if (!teacher) {
            res.status(404).json({
                message: "Teacher not found"
            })
        } else {
            teacher.subjects = teacher.subjects.filter(s => s.id !== null)
            res.status(200).json({
                message: "Successfully retrieved teacher",
                teacher
            })
        }
    } catch (error) {
        console.error({
            message: `Error fetching teacher: ${error.message}`
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
        firstName, middleName, lastName, gender, age, email,
        phoneNumber, department, qualification,
        yearsOfExperience, schoolYear
    } = req.body
    
    const query = `
        UPDATE teacher 
        SET firstName = $1, 
            middleName = $2, 
            lastName = $3, 
            gender = $4, 
            age = $5, 
            email = $6,
            phoneNumber = $7,
            department = $8,
            qualification = $9,
            yearsOfExperience = $10,
            schoolYear = $11,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $12 AND is_active = true
        RETURNING *
    `
    const updateQuery = [
        firstName, middleName, lastName, gender, age, email,
        phoneNumber, department, qualification,
        yearsOfExperience, schoolYear, id
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
    const { subjectIds, schoolYear } = req.body

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({
            message: 'Subject IDs array is required'
        })
    }

    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
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
             WHERE teacher_id = $1 AND schoolYear = $2`,
            [teacherId, schoolYear]
        )

        // Then, insert new assignments
        for (const subjectId of subjectIds) {
            await client.query(
                `INSERT INTO teacher_subjects (teacher_id, subject_id, schoolYear)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (teacher_id, subject_id, schoolYear) 
                 DO UPDATE SET is_active = true, 
                              deleted_at = NULL,
                              updated_at = CURRENT_TIMESTAMP`,
                [teacherId, subjectId, schoolYear]
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
    const { schoolYear } = req.query

    let query = `
        SELECT s.*
        FROM subject s
        JOIN teacher_subjects ts ON s.id = ts.subject_id
        WHERE ts.teacher_id = $1 
        AND ts.is_active = true
        AND s.is_active = true
    `
    const queryParams = [teacherId]

    if (schoolYear) {
        query += ` AND ts.schoolYear = $2`
        queryParams.push(schoolYear)
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

export default teacherRouter 
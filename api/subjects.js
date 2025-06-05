import pool from "../database/db.js"
import express from 'express'

const subjectRouter = express.Router()

// Input validation middleware
const validateSubjectInput = (req, res, next) => {
    const { name, code, department } = req.body
    
    const errors = []
    
    if (!name || name.trim().length === 0) {
        errors.push('Subject name is required')
    }
    if (!code || code.trim().length === 0) {
        errors.push('Subject code is required')
    }
    if (code && !/^[A-Z0-9-]+$/.test(code)) {
        errors.push('Subject code must contain only uppercase letters, numbers, and hyphens')
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        })
    }
    
    next()
}

// Create subject
subjectRouter.post("/subjects", validateSubjectInput, async (req, res) => {
    const { name, code, description, department } = req.body

    const query = `
        INSERT INTO subject(name, code, description, department, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
    `
    const insertQuery = [name, code, description, department]

    try {
        const result = await pool.query(query, insertQuery)
        const subject = result.rows[0]

        if (!subject) {
            res.status(400).json({
                message: "Error creating the subject"
            })
        } else {
            res.status(200).json({
                message: "Successfully added the subject",
                subject
            })
        }
    } catch (error) {
        console.error({
            message: `Error creating the subject: ${error.message}`
        })
        res.status(500).json({
            message: "Error creating subject",
            error: error.message
        })
    }
})

// Get all subjects with pagination and search
subjectRouter.get('/subjects', async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search,
        department
    } = req.query

    const offset = (page - 1) * limit
    let query = `SELECT * FROM subject WHERE is_active = true`
    const queryParams = []
    let paramCount = 1

    if (search) {
        query += ` AND (
            LOWER(name) LIKE LOWER($${paramCount}) OR 
            LOWER(code) LIKE LOWER($${paramCount})
        )`
        queryParams.push(`%${search}%`)
        paramCount++
    }

    if (department) {
        query += ` AND department = $${paramCount}`
        queryParams.push(department)
        paramCount++
    }

    // Add pagination
    query += ` ORDER BY name LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    try {
        const result = await pool.query(query, queryParams)
        const subjects = result.rows

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*)
            FROM subject
            WHERE is_active = true
            ${search ? `AND (
                LOWER(name) LIKE LOWER($1) OR 
                LOWER(code) LIKE LOWER($1)
            )` : ''}
            ${department ? `AND department = $${search ? 2 : 1}` : ''}
        `
        const countParams = []
        if (search) countParams.push(`%${search}%`)
        if (department) countParams.push(department)

        const countResult = await pool.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count)

        res.status(200).json({
            message: "Successfully retrieved the data",
            subjects,
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
            message: "Error fetching subjects",
            error: error.message
        })
    }
})

// Get single subject by ID
subjectRouter.get('/subjects/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        SELECT s.*, 
               json_agg(json_build_object(
                   'id', t.id,
                   'firstName', t.firstName,
                   'lastName', t.lastName,
                   'email', t.email
               )) as teachers
        FROM subject s
        LEFT JOIN teacher_subjects ts ON s.id = ts.subject_id AND ts.is_active = true
        LEFT JOIN teacher t ON ts.teacher_id = t.id AND t.is_active = true
        WHERE s.id = $1 AND s.is_active = true
        GROUP BY s.id
    `

    try {
        const result = await pool.query(query, [id])
        const subject = result.rows[0]

        if (!subject) {
            res.status(404).json({
                message: "Subject not found"
            })
        } else {
            // Filter out null teachers
            subject.teachers = subject.teachers.filter(t => t.id !== null)
            res.status(200).json({
                message: "Successfully retrieved subject",
                subject
            })
        }
    } catch (error) {
        console.error({
            message: `Error fetching subject: ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching subject",
            error: error.message
        })
    }
})

// Update subject
subjectRouter.put('/subjects/:id', validateSubjectInput, async (req, res) => {
    const { id } = req.params
    const { name, code, description, department } = req.body
    
    const query = `
        UPDATE subject 
        SET name = $1,
            code = $2,
            description = $3,
            department = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND is_active = true
        RETURNING *
    `
    const updateQuery = [name, code, description, department, id]

    try {
        const result = await pool.query(query, updateQuery)
        const updatedSubject = result.rows[0]

        if (!updatedSubject) {
            res.status(404).json({
                message: "Subject not found"
            })
        } else {
            res.status(200).json({
                message: "Subject updated successfully",
                subject: updatedSubject
            })
        }
    } catch (error) {
        console.error({
            message: `Error updating subject: ${error.message}`
        })
        res.status(500).json({
            message: "Error updating subject",
            error: error.message
        })
    }
})

// Soft delete subject
subjectRouter.delete('/subjects/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        UPDATE subject 
        SET is_active = false,
            deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING *
    `

    try {
        const result = await pool.query(query, [id])
        const deletedSubject = result.rows[0]

        if (!deletedSubject) {
            res.status(404).json({
                message: "Subject not found"
            })
        } else {
            res.status(200).json({
                message: "Subject deleted successfully",
                subject: deletedSubject
            })
        }
    } catch (error) {
        console.error({
            message: `Error deleting subject: ${error.message}`
        })
        res.status(500).json({
            message: "Error deleting subject",
            error: error.message
        })
    }
})

// Assign subjects to teacher
subjectRouter.post('/teachers/:teacherId/subjects', async (req, res) => {
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
subjectRouter.get('/teachers/:teacherId/subjects', async (req, res) => {
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

export default subjectRouter
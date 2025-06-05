import pool from "../database/db.js"
import express from 'express'

const sectionRouter = express.Router()

// Input validation middleware
const validateSectionInput = (req, res, next) => {
    const { name, gradeLevel, schoolYear, adviserId } = req.body
    
    const errors = []
    
    if (!name || name.trim().length === 0) {
        errors.push('Section name is required')
    }
    if (!gradeLevel || gradeLevel.trim().length === 0) {
        errors.push('Grade level is required')
    }
    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
        errors.push('School year must be in format YYYY-YYYY')
    }
    if (!adviserId || isNaN(adviserId)) {
        errors.push('Adviser ID is required')
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        })
    }
    
    next()
}

// Create section
sectionRouter.post("/sections", validateSectionInput, async (req, res) => {
    const { name, gradeLevel, schoolYear, adviserId } = req.body

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        // Check if adviser exists
        const adviserCheck = await client.query(
            'SELECT id FROM teacher WHERE id = $1 AND is_active = true',
            [adviserId]
        )

        if (adviserCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Adviser not found'
            })
        }

        const query = `
            INSERT INTO section(name, grade_level, school_year, adviser_id, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `
        const insertQuery = [name, gradeLevel, schoolYear, adviserId]

        const result = await client.query(query, insertQuery)
        const section = result.rows[0]

        await client.query('COMMIT')

        res.status(200).json({
            message: "Successfully added the section",
            section
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error creating the section: ${error.message}`
        })
        res.status(500).json({
            message: "Error creating section",
            error: error.message
        })
    } finally {
        client.release()
    }
})

// Get all sections with pagination and search
sectionRouter.get('/sections', async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search,
        gradeLevel,
        schoolYear
    } = req.query

    const offset = (page - 1) * limit
    let query = `
        SELECT s.*, 
               json_build_object(
                   'id', t.id,
                   'firstName', t.firstName,
                   'lastName', t.lastName,
                   'email', t.email
               ) as adviser,
               (SELECT COUNT(*) FROM section_students ss WHERE ss.section_id = s.id AND ss.is_active = true) as student_count
        FROM section s
        LEFT JOIN teacher t ON s.adviser_id = t.id AND t.is_active = true
        WHERE s.is_active = true
    `
    const queryParams = []
    let paramCount = 1

    if (search) {
        query += ` AND (
            LOWER(s.name) LIKE LOWER($${paramCount}) OR 
            LOWER(s.grade_level) LIKE LOWER($${paramCount})
        )`
        queryParams.push(`%${search}%`)
        paramCount++
    }

    if (gradeLevel) {
        query += ` AND s.grade_level = $${paramCount}`
        queryParams.push(gradeLevel)
        paramCount++
    }

    if (schoolYear) {
        query += ` AND s.school_year = $${paramCount}`
        queryParams.push(schoolYear)
        paramCount++
    }

    // Add pagination
    query += ` ORDER BY s.grade_level, s.name LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    try {
        const result = await pool.query(query, queryParams)
        const sections = result.rows

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(DISTINCT s.id)
            FROM section s
            WHERE s.is_active = true
            ${search ? `AND (
                LOWER(s.name) LIKE LOWER($1) OR 
                LOWER(s.grade_level) LIKE LOWER($1)
            )` : ''}
            ${gradeLevel ? `AND s.grade_level = $${search ? 2 : 1}` : ''}
            ${schoolYear ? `AND s.school_year = $${search ? (gradeLevel ? 3 : 2) : (gradeLevel ? 2 : 1)}` : ''}
        `
        const countParams = []
        if (search) countParams.push(`%${search}%`)
        if (gradeLevel) countParams.push(gradeLevel)
        if (schoolYear) countParams.push(schoolYear)

        const countResult = await pool.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count)

        res.status(200).json({
            message: "Successfully retrieved the data",
            sections,
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
            message: "Error fetching sections",
            error: error.message
        })
    }
})

// Get single section by ID with details
sectionRouter.get('/sections/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        SELECT s.*, 
               json_build_object(
                   'id', t.id,
                   'firstName', t.firstName,
                   'lastName', t.lastName,
                   'email', t.email
               ) as adviser,
               (
                   SELECT json_agg(json_build_object(
                       'id', ss.id,
                       'subject', json_build_object(
                           'id', sub.id,
                           'name', sub.name,
                           'code', sub.code
                       ),
                       'teacher', json_build_object(
                           'id', tea.id,
                           'firstName', tea.firstName,
                           'lastName', tea.lastName
                       ),
                       'schedule', ss.schedule,
                       'room', ss.room
                   ))
                   FROM section_subjects ss
                   JOIN subject sub ON ss.subject_id = sub.id
                   JOIN teacher tea ON ss.teacher_id = tea.id
                   WHERE ss.section_id = s.id AND ss.is_active = true
               ) as subjects,
               (
                   SELECT json_agg(json_build_object(
                       'id', st.id,
                       'student', json_build_object(
                           'id', stu.id,
                           'firstName', stu.firstName,
                           'lastName', stu.lastName,
                           'email', stu.email
                       ),
                       'enrollmentDate', st.enrollment_date,
                       'status', st.status
                   ))
                   FROM section_students st
                   JOIN student stu ON st.student_id = stu.id
                   WHERE st.section_id = s.id AND st.is_active = true
               ) as students
        FROM section s
        LEFT JOIN teacher t ON s.adviser_id = t.id AND t.is_active = true
        WHERE s.id = $1 AND s.is_active = true
    `

    try {
        const result = await pool.query(query, [id])
        const section = result.rows[0]

        if (!section) {
            res.status(404).json({
                message: "Section not found"
            })
        } else {
            // Filter out null values from arrays
            section.subjects = section.subjects?.filter(s => s !== null) || []
            section.students = section.students?.filter(s => s !== null) || []
            
            res.status(200).json({
                message: "Successfully retrieved section",
                section
            })
        }
    } catch (error) {
        console.error({
            message: `Error fetching section: ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching section",
            error: error.message
        })
    }
})

// Update section
sectionRouter.put('/sections/:id', validateSectionInput, async (req, res) => {
    const { id } = req.params
    const { name, gradeLevel, schoolYear, adviserId } = req.body
    
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        // Check if adviser exists
        const adviserCheck = await client.query(
            'SELECT id FROM teacher WHERE id = $1 AND is_active = true',
            [adviserId]
        )

        if (adviserCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Adviser not found'
            })
        }

        const query = `
            UPDATE section 
            SET name = $1,
                grade_level = $2,
                school_year = $3,
                adviser_id = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND is_active = true
            RETURNING *
        `
        const updateQuery = [name, gradeLevel, schoolYear, adviserId, id]

        const result = await client.query(query, updateQuery)
        const updatedSection = result.rows[0]

        if (!updatedSection) {
            await client.query('ROLLBACK')
            res.status(404).json({
                message: "Section not found"
            })
        } else {
            await client.query('COMMIT')
            res.status(200).json({
                message: "Section updated successfully",
                section: updatedSection
            })
        }
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error updating section: ${error.message}`
        })
        res.status(500).json({
            message: "Error updating section",
            error: error.message
        })
    } finally {
        client.release()
    }
})

// Soft delete section
sectionRouter.delete('/sections/:id', async (req, res) => {
    const { id } = req.params
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        // Soft delete section
        const sectionQuery = `
            UPDATE section 
            SET is_active = false,
                deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_active = true
            RETURNING *
        `
        const sectionResult = await client.query(sectionQuery, [id])

        if (sectionResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({
                message: "Section not found"
            })
        }

        // Soft delete related records
        await client.query(
            `UPDATE section_subjects 
             SET is_active = false,
                 deleted_at = CURRENT_TIMESTAMP
             WHERE section_id = $1`,
            [id]
        )

        await client.query(
            `UPDATE section_students 
             SET is_active = false,
                 deleted_at = CURRENT_TIMESTAMP
             WHERE section_id = $1`,
            [id]
        )

        await client.query('COMMIT')

        res.status(200).json({
            message: "Section deleted successfully",
            section: sectionResult.rows[0]
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error deleting section: ${error.message}`
        })
        res.status(500).json({
            message: "Error deleting section",
            error: error.message
        })
    } finally {
        client.release()
    }
})

// Assign subjects to section
sectionRouter.post('/sections/:sectionId/subjects', async (req, res) => {
    const { sectionId } = req.params
    const { subjects } = req.body // Array of { subjectId, teacherId, schedule, room }

    if (!Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({
            message: 'Subjects array is required'
        })
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        // Check if section exists
        const sectionCheck = await client.query(
            'SELECT id FROM section WHERE id = $1 AND is_active = true',
            [sectionId]
        )

        if (sectionCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Section not found'
            })
        }

        // Deactivate existing subject assignments
        await client.query(
            `UPDATE section_subjects 
             SET is_active = false,
                 deleted_at = CURRENT_TIMESTAMP
             WHERE section_id = $1`,
            [sectionId]
        )

        // Insert new assignments
        for (const subject of subjects) {
            const { subjectId, teacherId, schedule, room } = subject

            // Verify subject and teacher exist
            const [subjectCheck, teacherCheck] = await Promise.all([
                client.query('SELECT id FROM subject WHERE id = $1 AND is_active = true', [subjectId]),
                client.query('SELECT id FROM teacher WHERE id = $1 AND is_active = true', [teacherId])
            ])

            if (subjectCheck.rows.length === 0) {
                throw new Error(`Subject with ID ${subjectId} not found`)
            }
            if (teacherCheck.rows.length === 0) {
                throw new Error(`Teacher with ID ${teacherId} not found`)
            }

            await client.query(
                `INSERT INTO section_subjects (section_id, subject_id, teacher_id, schedule, room)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (section_id, subject_id, teacher_id) 
                 DO UPDATE SET is_active = true,
                              deleted_at = NULL,
                              schedule = $4,
                              room = $5,
                              updated_at = CURRENT_TIMESTAMP`,
                [sectionId, subjectId, teacherId, schedule, room]
            )
        }

        await client.query('COMMIT')

        // Get updated section with subjects
        const result = await client.query(
            `SELECT s.*, 
                    json_agg(json_build_object(
                        'id', ss.id,
                        'subject', json_build_object(
                            'id', sub.id,
                            'name', sub.name,
                            'code', sub.code
                        ),
                        'teacher', json_build_object(
                            'id', tea.id,
                            'firstName', tea.firstName,
                            'lastName', tea.lastName
                        ),
                        'schedule', ss.schedule,
                        'room', ss.room
                    )) as subjects
             FROM section s
             LEFT JOIN section_subjects ss ON s.id = ss.section_id AND ss.is_active = true
             LEFT JOIN subject sub ON ss.subject_id = sub.id
             LEFT JOIN teacher tea ON ss.teacher_id = tea.id
             WHERE s.id = $1 AND s.is_active = true
             GROUP BY s.id`,
            [sectionId]
        )

        const section = result.rows[0]
        section.subjects = section.subjects.filter(s => s !== null)

        res.status(200).json({
            message: "Subjects assigned successfully",
            section
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

// Enroll students in section
sectionRouter.post('/sections/:sectionId/students', async (req, res) => {
    const { sectionId } = req.params
    const { studentIds } = req.body

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
            message: 'Student IDs array is required'
        })
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        // Check if section exists
        const sectionCheck = await client.query(
            'SELECT id FROM section WHERE id = $1 AND is_active = true',
            [sectionId]
        )

        if (sectionCheck.rows.length === 0) {
            return res.status(404).json({
                message: 'Section not found'
            })
        }

        // Verify all students exist
        const studentCheck = await client.query(
            'SELECT id FROM student WHERE id = ANY($1) AND is_active = true',
            [studentIds]
        )

        if (studentCheck.rows.length !== studentIds.length) {
            return res.status(404).json({
                message: 'One or more students not found'
            })
        }

        // Insert student enrollments
        for (const studentId of studentIds) {
            await client.query(
                `INSERT INTO section_students (section_id, student_id)
                 VALUES ($1, $2)
                 ON CONFLICT (section_id, student_id) 
                 DO UPDATE SET is_active = true,
                              deleted_at = NULL,
                              status = 'active',
                              updated_at = CURRENT_TIMESTAMP`,
                [sectionId, studentId]
            )
        }

        await client.query('COMMIT')

        // Get updated section with students
        const result = await client.query(
            `SELECT s.*, 
                    json_agg(json_build_object(
                        'id', st.id,
                        'student', json_build_object(
                            'id', stu.id,
                            'firstName', stu.firstName,
                            'lastName', stu.lastName,
                            'email', stu.email
                        ),
                        'enrollmentDate', st.enrollment_date,
                        'status', st.status
                    )) as students
             FROM section s
             LEFT JOIN section_students st ON s.id = st.section_id AND st.is_active = true
             LEFT JOIN student stu ON st.student_id = stu.id
             WHERE s.id = $1 AND s.is_active = true
             GROUP BY s.id`,
            [sectionId]
        )

        const section = result.rows[0]
        section.students = section.students.filter(s => s !== null)

        res.status(200).json({
            message: "Students enrolled successfully",
            section
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error enrolling students: ${error.message}`
        })
        res.status(500).json({
            message: "Error enrolling students",
            error: error.message
        })
    } finally {
        client.release()
    }
})

export default sectionRouter 
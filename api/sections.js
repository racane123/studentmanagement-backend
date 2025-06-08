import pool from "../database/db.js"
import express from 'express'

const sectionRouter = express.Router()

// Input validation middleware
const validateSectionInput = (req, res, next) => {
    const { name, gradeLevel, schoolYear, adviserId, subjects } = req.body

    const errors = []
    
    if (!name) {
        errors.push('Section name is required')
    }
    if (!gradeLevel) {
        errors.push('Grade level is required')
    }
    if (!schoolYear) {
        errors.push('School year is required')
    }
    if (!adviserId) {
        errors.push('Adviser is required')
    }

    // Validate subjects if provided
    if (subjects && Array.isArray(subjects)) {
        subjects.forEach((subject, index) => {
            if (!subject.subjectId) {
                errors.push(`Subject ID is required for subject ${index + 1}`)
            }
            if (!subject.teacherId) {
                errors.push(`Teacher ID is required for subject ${index + 1}`)
            }
            if (!subject.schedule) {
                errors.push(`Schedule is required for subject ${index + 1}`)
            }
            if (!subject.room) {
                errors.push(`Room is required for subject ${index + 1}`)
            }
        })
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors })
    }
    
    next()
}

// Create section with students and subjects
sectionRouter.post("/sections", validateSectionInput, async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { name, gradeLevel, schoolYear, adviserId, subjects } = req.body

        // Check if adviser exists
        const adviserResult = await client.query(
            'SELECT id FROM teacher WHERE id = $1 AND is_active = true',
            [adviserId]
        )

        if (adviserResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Adviser not found' })
        }

        // Create section
        const sectionResult = await client.query(
            `INSERT INTO sections (name, grade_level, school_year, adviser_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, gradeLevel, schoolYear, adviserId]
        )

        const section = sectionResult.rows[0]

        // Add subjects if provided
        if (subjects && subjects.length > 0) {
            // Validate all subjects and teachers exist
            const subjectIds = subjects.map(s => s.subjectId)
            const teacherIds = subjects.map(s => s.teacherId)

            const subjectsResult = await client.query(
                'SELECT id FROM subject WHERE id = ANY($1) AND is_active = true',
                [subjectIds]
            )

            const teachersResult = await client.query(
                'SELECT id FROM teacher WHERE id = ANY($1) AND is_active = true',
                [teacherIds]
            )

            if (subjectsResult.rows.length !== subjectIds.length) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'One or more subjects not found' })
            }

            if (teachersResult.rows.length !== teacherIds.length) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'One or more teachers not found' })
            }

            // Insert all subject assignments
            const subjectValues = subjects.map(s => 
                `(${section.id}, ${s.subjectId}, ${s.teacherId}, '${s.schedule}', '${s.room}')`
            ).join(',')

            await client.query(
                `INSERT INTO section_subjects (section_id, subject_id, teacher_id, schedule, room)
                 VALUES ${subjectValues}`
            )
        }

        await client.query('COMMIT')

        // Fetch the complete section with relationships
        const result = await client.query(`
            SELECT s.*, 
                   json_build_object(
                       'id', t.id,
                       'firstName', t.firstname,
                       'lastName', t.lastname,
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
                               'firstName', tea.firstname,
                               'lastName', tea.lastname
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
                               'firstName', stu.firstname,
                               'lastName', stu.lastname
                           ),
                           'enrollmentDate', st.enrollment_date,
                           'status', st.status
                       ))
                       FROM section_students st
                       JOIN student stu ON st.student_id = stu.id
                       WHERE st.section_id = s.id AND st.is_active = true
                   ) as students,
                   (SELECT COUNT(*) FROM section_students ss WHERE ss.section_id = s.id AND ss.is_active = true) as student_count
            FROM sections s
            LEFT JOIN teacher t ON s.adviser_id = t.id
            WHERE s.id = $1 AND s.is_active = true
            GROUP BY s.id, t.id, t.firstname, t.lastname, t.email
        `, [section.id])

        res.status(201).json(result.rows[0])
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error creating section:', error)
        res.status(500).json({ error: 'Failed to create section' })
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
                   'firstName', t.firstname,
                   'lastName', t.lastname,
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
                           'firstName', tea.firstname,
                           'lastName', tea.lastname
                       ),
                       'schedule', ss.schedule,
                       'room', ss.room
                   ))
                   FROM section_subjects ss
                   JOIN subject sub ON ss.subject_id = sub.id
                   JOIN teacher tea ON ss.teacher_id = tea.id
                   WHERE ss.section_id = s.id
               ) as subjects,
               (
                   SELECT json_agg(json_build_object(
                       'id', st.id,
                       'student', json_build_object(
                           'id', stu.id,
                           'firstName', stu.firstname,
                           'lastName', stu.lastname
                       ),
                       'enrollmentDate', st.enrollment_date,
                       'status', st.status
                   ))
                   FROM section_students st
                   JOIN student stu ON st.student_id = stu.id
                   WHERE st.section_id = s.id
               ) as students,
               (SELECT COUNT(*) FROM section_students ss WHERE ss.section_id = s.id) as student_count
        FROM sections s
        LEFT JOIN teacher t ON s.adviser_id = t.id
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
        query += ` AND s.academic_year = $${paramCount}`
        queryParams.push(schoolYear)
        paramCount++
    }

    // Add pagination
    query += ` ORDER BY s.grade_level, s.name LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    try {
        const result = await pool.query(query, queryParams)
        const sections = result.rows.map(section => ({
            ...section,
            subjects: section.subjects?.filter(s => s !== null) || [],
            students: section.students?.filter(s => s !== null) || []
        }))

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(DISTINCT s.id)
            FROM sections s
            ${search ? `WHERE (
                LOWER(s.name) LIKE LOWER($1) OR 
                LOWER(s.grade_level) LIKE LOWER($1)
            )` : ''}
            ${gradeLevel ? `${search ? 'AND' : 'WHERE'} s.grade_level = $${search ? 2 : 1}` : ''}
            ${schoolYear ? `${search || gradeLevel ? 'AND' : 'WHERE'} s.academic_year = $${search ? (gradeLevel ? 3 : 2) : (gradeLevel ? 2 : 1)}` : ''}
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
                   'firstName', t.firstname,
                   'lastName', t.lastname,
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
                           'firstName', tea.firstname,
                           'lastName', tea.lastname
                       ),
                       'schedule', ss.schedule,
                       'room', ss.room
                   ))
                   FROM section_subjects ss
                   JOIN subject sub ON ss.subject_id = sub.id
                   JOIN teacher tea ON ss.teacher_id = tea.id
                   WHERE ss.section_id = s.id
               ) as subjects,
               (
                   SELECT json_agg(json_build_object(
                       'id', st.id,
                       'student', json_build_object(
                           'id', stu.id,
                           'firstName', stu.firstname,
                           'lastName', stu.lastname
                       ),
                       'enrollmentDate', st.enrollment_date,
                       'status', st.status
                   ))
                   FROM section_students st
                   JOIN student stu ON st.student_id = stu.id
                   WHERE st.section_id = s.id
               ) as students
        FROM sections s
        LEFT JOIN section_advisers sa ON s.id = sa.section_id
        LEFT JOIN teacher t ON sa.teacher_id = t.id
        WHERE s.id = $1
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
            message: `Error has occurred ${error.message}`
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
    const { name, gradeLevel, schoolYear, adviserId, subjectIds, teacherIds } = req.body
    
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

        // Update section basic info
        const query = `
            UPDATE sections
            SET name = $1,
                grade_level = $2,
                academic_year = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `
        const updateQuery = [name, gradeLevel, schoolYear, id]

        const result = await client.query(query, updateQuery)
        const section = result.rows[0]

        if (!section) {
            return res.status(404).json({
                message: "Section not found"
            })
        }

        // Update adviser
        await client.query(
            `INSERT INTO section_advisers(section_id, teacher_id)
             VALUES ($1, $2)
             ON CONFLICT (section_id) 
             DO UPDATE SET teacher_id = $2`,
            [section.id, adviserId]
        )

        // If new subjects are provided, add them
        if (subjectIds && teacherIds && subjectIds.length > 0 && teacherIds.length > 0) {
            // Check if all teachers exist
            const teacherCheck = await client.query(
                'SELECT id FROM teacher WHERE id = ANY($1) AND is_active = true',
                [teacherIds]
            )

            if (teacherCheck.rows.length !== teacherIds.length) {
                return res.status(404).json({
                    message: 'One or more teachers not found'
                })
            }

            // Check if all subjects exist
            const subjectCheck = await client.query(
                'SELECT id FROM subject WHERE id = ANY($1) AND is_active = true',
                [subjectIds]
            )

            if (subjectCheck.rows.length !== subjectIds.length) {
                return res.status(404).json({
                    message: 'One or more subjects not found'
                })
            }

            // Add new subjects and teachers to section
            for (let i = 0; i < subjectIds.length; i++) {
                await client.query(
                    `INSERT INTO section_subjects(section_id, subject_id, teacher_id)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (section_id, subject_id) 
                     DO UPDATE SET teacher_id = $3`,
                    [section.id, subjectIds[i], teacherIds[i]]
                )
            }
        }

        await client.query('COMMIT')

        // Get the complete updated section with all relationships
        const completeSection = await client.query(`
            SELECT s.*, 
                   json_build_object(
                       'id', t.id,
                       'firstName', t.firstname,
                       'lastName', t.lastname,
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
                               'firstName', tea.firstname,
                               'lastName', tea.lastname
                           ),
                           'schedule', ss.schedule,
                           'room', ss.room
                       ))
                       FROM section_subjects ss
                       JOIN subject sub ON ss.subject_id = sub.id
                       JOIN teacher tea ON ss.teacher_id = tea.id
                       WHERE ss.section_id = s.id
                   ) as subjects,
                   (
                       SELECT json_agg(json_build_object(
                           'id', st.id,
                           'student', json_build_object(
                               'id', stu.id,
                               'firstName', stu.firstname,
                               'lastName', stu.lastname
                           ),
                           'enrollmentDate', st.enrollment_date,
                           'status', st.status
                       ))
                       FROM section_students st
                       JOIN student stu ON st.student_id = stu.id
                       WHERE st.section_id = s.id
                   ) as students
            FROM sections s
            LEFT JOIN section_advisers sa ON s.id = sa.section_id
            LEFT JOIN teacher t ON sa.teacher_id = t.id
            WHERE s.id = $1
        `, [id])

        const updatedSection = completeSection.rows[0]
        updatedSection.subjects = updatedSection.subjects?.filter(s => s !== null) || []
        updatedSection.students = updatedSection.students?.filter(s => s !== null) || []

        res.status(200).json({
            message: "Successfully updated section",
            section: updatedSection
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error updating section",
            error: error.message
        })
    } finally {
        client.release()
    }
})

// Delete section (soft delete)
sectionRouter.delete('/sections/:id', async (req, res) => {
    const { id } = req.params
    
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const query = `
            UPDATE sections
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `

        const result = await client.query(query, [id])
        const section = result.rows[0]

        if (!section) {
            return res.status(404).json({
                message: "Section not found"
            })
        }

        await client.query('COMMIT')

        res.status(200).json({
            message: "Successfully deleted section",
            section
        })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error({
            message: `Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error deleting section",
            error: error.message
        })
    } finally {
        client.release()
    }
})

export default sectionRouter 
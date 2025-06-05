import pool from "../database/db.js"
import express from 'express'

const studentRouter = express.Router()

// Input validation middleware
const validateStudentInput = (req, res, next) => {
    const { firstName, lastName, gender, age, schoolYear, grade } = req.body
    
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
    if (!age || isNaN(age) || age < 4 || age > 100) {
        errors.push('Age must be a number between 4 and 100')
    }
    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
        errors.push('School year must be in format YYYY-YYYY')
    }
    if (!grade || isNaN(grade) || grade < 1 || grade > 12) {
        errors.push('Grade must be a number between 1 and 12')
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        })
    }
    
    next()
}

// Create student
studentRouter.post("/students", validateStudentInput, async (req,res)=>{
    const {firstName, middleName, lastName, gender, age, section, schoolYear, schoolName, subject, gradingPeriod, division, grade, classSection} = req.body
    const query = `
        INSERT INTO student(
            firstName, middleName, lastName, gender, age, section, 
            schoolYear, schoolName, subject, gradingPeriod, division, 
            grade, classSection, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true) 
        RETURNING *
    `
    const insertQuery = [firstName, middleName, lastName, gender, age, section, schoolYear, schoolName, subject, gradingPeriod, division, grade, classSection]

    try {
        const result = await pool.query(query, insertQuery)
        const user = result.rows[0]

        if(!user){
            res.status(400).json({
                message: "Error Creating on the students"
            })
        }else{
            res.status(200).json({
                message:"successfully added the student",
                student: user
            })
        }
        
    } catch (error) {
        console.error({
            message: `Error Creating the student${error.message}`
        })
        res.status(500).json({
            message: "Error creating student",
            error: error.message
        })
    }
})

// Get all students with pagination and search
studentRouter.get('/students', async(req,res)=>{
    const { 
        page = 1, 
        limit = 10, 
        search,
        grade,
        section,
        schoolYear
    } = req.query

    const offset = (page - 1) * limit
    let query = `SELECT * FROM student WHERE is_active = true`
    const queryParams = []
    let paramCount = 1

    if (search) {
        query += ` AND (
            LOWER(firstName) LIKE LOWER($${paramCount}) OR 
            LOWER(lastName) LIKE LOWER($${paramCount}) OR 
            LOWER(middleName) LIKE LOWER($${paramCount})
        )`
        queryParams.push(`%${search}%`)
        paramCount++
    }

    if (grade) {
        query += ` AND grade = $${paramCount}`
        queryParams.push(grade)
        paramCount++
    }

    if (section) {
        query += ` AND section = $${paramCount}`
        queryParams.push(section)
        paramCount++
    }

    if (schoolYear) {
        query += ` AND schoolYear = $${paramCount}`
        queryParams.push(schoolYear)
        paramCount++
    }

    // Add pagination
    query += ` ORDER BY lastName, firstName LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    try {
        const result = await pool.query(query, queryParams)
        const students = result.rows

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) 
            FROM student 
            WHERE is_active = true
            ${search ? `AND (
                LOWER(firstName) LIKE LOWER($1) OR 
                LOWER(lastName) LIKE LOWER($1) OR 
                LOWER(middleName) LIKE LOWER($1)
            )` : ''}
            ${grade ? `AND grade = $${search ? 2 : 1}` : ''}
            ${section ? `AND section = $${search ? (grade ? 3 : 2) : (grade ? 2 : 1)}` : ''}
            ${schoolYear ? `AND schoolYear = $${search ? (grade ? (section ? 4 : 3) : (section ? 3 : 2)) : (grade ? (section ? 3 : 2) : (section ? 2 : 1))}` : ''}
        `
        const countParams = []
        if (search) countParams.push(`%${search}%`)
        if (grade) countParams.push(grade)
        if (section) countParams.push(section)
        if (schoolYear) countParams.push(schoolYear)

        const countResult = await pool.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count)

        res.status(200).json({
            message: "Successfully retrieved the data",
            students,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error({
            message:`Error has occurred ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching students",
            error: error.message
        })
    }
})

// Get single student by ID
studentRouter.get('/students/:id', async (req, res) => {
    const { id } = req.params
    const query = `SELECT * FROM student WHERE id = $1 AND is_active = true`

    try {
        const result = await pool.query(query, [id])
        const student = result.rows[0]

        if (!student) {
            res.status(404).json({
                message: "Student not found"
            })
        } else {
            res.status(200).json({
                message: "Successfully retrieved student",
                student
            })
        }
    } catch (error) {
        console.error({
            message: `Error fetching student: ${error.message}`
        })
        res.status(500).json({
            message: "Error fetching student",
            error: error.message
        })
    }
})

// Update student
studentRouter.put('/students/:id', validateStudentInput, async (req, res) => {
    const { id } = req.params
    const { firstName, middleName, lastName, gender, age, section, schoolYear, schoolName, subject, gradingPeriod, division, grade, classSection } = req.body
    
    const query = `
        UPDATE student 
        SET firstName = $1, 
            middleName = $2, 
            lastName = $3, 
            gender = $4, 
            age = $5, 
            section = $6, 
            schoolYear = $7, 
            schoolName = $8, 
            subject = $9, 
            gradingPeriod = $10, 
            division = $11, 
            grade = $12, 
            classSection = $13,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $14 AND is_active = true
        RETURNING *
    `
    const updateQuery = [firstName, middleName, lastName, gender, age, section, schoolYear, schoolName, subject, gradingPeriod, division, grade, classSection, id]

    try {
        const result = await pool.query(query, updateQuery)
        const updatedStudent = result.rows[0]

        if (!updatedStudent) {
            res.status(404).json({
                message: "Student not found"
            })
        } else {
            res.status(200).json({
                message: "Student updated successfully",
                student: updatedStudent
            })
        }
    } catch (error) {
        console.error({
            message: `Error updating student: ${error.message}`
        })
        res.status(500).json({
            message: "Error updating student",
            error: error.message
        })
    }
})

// Soft delete student
studentRouter.delete('/students/:id', async (req, res) => {
    const { id } = req.params
    const query = `
        UPDATE student 
        SET is_active = false,
            deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING *
    `

    try {
        const result = await pool.query(query, [id])
        const deletedStudent = result.rows[0]

        if (!deletedStudent) {
            res.status(404).json({
                message: "Student not found"
            })
        } else {
            res.status(200).json({
                message: "Student deleted successfully",
                student: deletedStudent
            })
        }
    } catch (error) {
        console.error({
            message: `Error deleting student: ${error.message}`
        })
        res.status(500).json({
            message: "Error deleting student",
            error: error.message
        })
    }
})

export default studentRouter
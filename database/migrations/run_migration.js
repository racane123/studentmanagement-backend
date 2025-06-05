import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
    try {
        // Read and execute student table migration
        const studentSql = fs.readFileSync(
            path.join(__dirname, 'create_student_table.sql'),
            'utf8'
        )
        await pool.query(studentSql)
        console.log('Student table migration completed successfully')

        // Read and execute teacher table migration
        const teacherSql = fs.readFileSync(
            path.join(__dirname, 'create_teacher_table.sql'),
            'utf8'
        )
        await pool.query(teacherSql)
        console.log('Teacher table migration completed successfully')

        // Read and execute subject tables migration
        const subjectSql = fs.readFileSync(
            path.join(__dirname, 'create_subject_table.sql'),
            'utf8'
        )
        await pool.query(subjectSql)
        console.log('Subject tables migration completed successfully')

        // Read and execute section tables migration
        const sectionSql = fs.readFileSync(
            path.join(__dirname, 'create_section_table.sql'),
            'utf8'
        )
        await pool.query(sectionSql)
        console.log('Section tables migration completed successfully')

    } catch (error) {
        console.error('Migration failed:', error)
    } finally {
        // Close the pool
        await pool.end()
    }
}

runMigration() 
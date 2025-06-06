import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // Read and execute student table migration
        const studentSql = fs.readFileSync(
            path.join(__dirname, 'create_student_table.sql'),
            'utf8'
        )
        await client.query(studentSql)
        console.log('Student table migration completed successfully')

        // Read and execute teacher table migration
        const teacherSql = fs.readFileSync(
            path.join(__dirname, 'create_teacher_table.sql'),
            'utf8'
        )
        await client.query(teacherSql)
        console.log('Teacher table migration completed successfully')

        // Read and execute subject tables migration
        const subjectSql = fs.readFileSync(
            path.join(__dirname, 'create_subject_table.sql'),
            'utf8'
        )
        await client.query(subjectSql)
        console.log('Subject tables migration completed successfully')

        // Read and execute section tables migration
        const sectionSql = fs.readFileSync(
            path.join(__dirname, 'create_section_table.sql'),
            'utf8'
        )
        await client.query(sectionSql)
        console.log('Section tables migration completed successfully')

        await client.query('COMMIT')
        console.log('All migrations completed successfully')

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Migration failed:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

runMigration().catch(console.error) 
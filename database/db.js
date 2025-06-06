import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from the correct path
const envPath = path.join(__dirname, '../.env')
console.log('Looking for .env file at:', envPath)

const result = dotenv.config({ path: envPath })

//if (result.error) {
    //console.error('Error loading .env file:', result.error)
    //console.error('Please make sure you have a .env file in your backend directory with the following variables:')
    //console.error('DB_USER=postgres')
    //console.error('DB_HOST=localhost')
    //console.error('DB_NAME=student_mgnt')
    //console.error('DB_PASSWORD=postgres')
    //console.error('DB_PORT=5432')
    //process.exit(1)//
//}

const { Pool } = pg

/** 
console.log('Database Configuration:')
console.log('DB_USER:', process.env.DB_USER)
console.log('DB_HOST:', process.env.DB_HOST)
console.log('DB_NAME:', process.env.DB_NAME)
console.log('DB_PORT:', process.env.DB_PORT)
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '****' : 'undefined')
*/
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PORT || !process.env.DB_PASSWORD) {
    console.error('Error: Missing required database configuration. Please check your .env file.')
    process.exit(1)
}

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
})

pool.connect()
    .then(() => {
        console.log('Successfully connected to database')
    })
    .catch((err) => {
        console.error('Database connection error:', err.message)
        process.exit(1)
    })

export default pool





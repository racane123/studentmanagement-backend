import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import middlewareAuth from './middleware/authentication.js'
import teacherRouter from "./api/teachers.js"
import subjectRouter from "./api/subjects.js"
import studentRouter from "./api/students.js"
import authRouter from './api/auth.js'
import sectionRouter from './api/sections.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT = process.env.PORT || 3000
const app = express()

console.log(process.env.DB_PASSWORD)

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:5173', // Vite's default port
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}

// Add middleware
app.use(cors(corsOptions))
app.use(express.json())

// Routes
app.use('/authentication', authRouter)
app.use('/student', studentRouter)
app.use('/teacher', teacherRouter)
app.use('/subject', subjectRouter)
app.use('/section', sectionRouter)

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`)
})
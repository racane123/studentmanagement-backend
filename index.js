import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import middlewareAuth from './middleware/authentication.js'
import teacherRouter from "./api/teachers.js"
import subjectRouter from "./api/subjects.js"
import studentRouter from "./api/students.js"
import authRouter from './api/auth.js'

dotenv.config()
const PORT = 3000 || process.env.PORT
const app = express()

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

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`)
})
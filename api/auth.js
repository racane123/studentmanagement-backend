import pool from '../database/db.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import express from 'express'
import crypto from 'crypto'

const authRouter = express.Router()

// Helper function to generate unique token payload
const generateTokenPayload = (user) => {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        iat: Math.floor(Date.now() / 1000), // Issued at timestamp
        jti: crypto.randomUUID(), // Unique token ID
        type: 'access_token'
    }
}

authRouter.post('/register', async (req, res)=>{
    const {name, email, password} = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const query = 'INSERT INTO account (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *'
    
    try {
        const result = await pool.query(query, [name, email, hashedPassword])
        const user = result.rows[0]
        if(!user){
            return res.status(400).json({message: 'User not found'})
        }else{
            const tokenPayload = generateTokenPayload(user)
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {expiresIn: '1h'})
            res.status(201).json({message: 'User registered successfully', token})
        }
        
    } catch (error) {
        res.status(500).json({message: `Error registering user${error.message}`})
    }

})

authRouter.post('/login', async (req,res)=>{
    const {email, password} = req.body
    const queryInput = [email]
    const query = "SELECT id, email, name, password_hash FROM account WHERE email = $1"

    try {
        const result = await pool.query(query, queryInput)
        const user = result.rows[0]
        if(!user){
            return res.status(400).json({message: 'User not found'})
        }else{
            const isPasswordValid = await bcrypt.compare(password, user.password_hash)
            if(!isPasswordValid){
                return res.status(400).json({message: 'Invalid password'})
            }else{
                const tokenPayload = generateTokenPayload(user)
                const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {expiresIn: '1h'})
                res.status(200).json({message: 'Logged in successfully', token})
            }
        }
    } catch (error) {
        res.status(500).json({message: `Error logging in${error.message}`})
    }
})

export default authRouter
import express from 'express'

const router = express.Router()

router.use((req, res, next)=>{
    const token = req.headers.authorization
    if(!token){
        return res.status(401).json({message: "Unauthorized"})
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()

})

export default router



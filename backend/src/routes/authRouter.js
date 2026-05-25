import express from 'express';
import {
    signUp
} from '../controllers/authController.js';

const authRouter = express.Router();

// 기능
authRouter.post('/signup', signUp);     // POST     /api/auth/signup

export default authRouter;
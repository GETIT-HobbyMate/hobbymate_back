import express from 'express';
import {
    signUp,
    checkDuplicateStudentId,
    checkDuplicateNickname,
    logIn
} from '../controllers/authController.js';

const authRouter = express.Router();

// 기능
authRouter.post('/signup', signUp);     // POST /api/auth/signup
authRouter.get('/studentId/:studentId', checkDuplicateStudentId);  // GET /api/auth/studentId/:studentId
authRouter.get('/nickname/:nickname', checkDuplicateNickname);      // GET /api/auth/nickname/:nickname
authRouter.post('/login', logIn);       // POST /api/auth/logIn

export default authRouter;
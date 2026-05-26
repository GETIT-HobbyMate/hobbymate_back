import express from 'express';
import {
    signUp,
    checkDuplicateStudentId,
    checkDuplicateNickname
} from '../controllers/authController.js';

const authRouter = express.Router();

// 기능
authRouter.post('/signup', signUp);     // POST /api/auth/signup
authRouter.get('/studentId/:studentId', checkDuplicateStudentId);  // GET /api/auth/studentId/:studentId
authRouter.get('/nickname/:nickname', checkDuplicateNickname);      // GET /api/auth/nickname/:nickname

export default authRouter;
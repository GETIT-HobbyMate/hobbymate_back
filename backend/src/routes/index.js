import express, { Router } from 'express';
import authRouter from './authRouter.js';
import postRouter from './postRouter.js';
import userRouter from './userRouter.js';
import notificationRouter from './notificationRouter.js';

const router = Router();

router.use('/api/auth', authRouter);
router.use('/posts', postRouter);
router.use('/users', userRouter);
router.use('/notifications', notificationRouter);

export default router;

import express from 'express';
import userRouter from './userRouter.js';
import notificationRouter from './notificationRouter.js';

const router = express.Router();

// /api/users/* 요청은 userRouter가 처리
router.use('/users', userRouter);

// /api/notifications/* 요청은 notificationRouter가 처리
router.use('/notifications', notificationRouter);

export default router;

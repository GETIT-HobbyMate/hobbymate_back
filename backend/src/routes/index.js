import express from 'express';
// 기존 mypageRouter 대신 userRouter로 이름을 변경하여 가져옵니다.
import userRouter from './userRouter.js';
import notificationRouter from './notificationRouter.js';

// import postRouter from './postRouter.js'; 

const router = express.Router();

// ==========================================
// 통합 라우팅 설정
// ==========================================

// /api/users 로 시작하는 요청은 userRouter가 처리하도록 연결 (사진 1 반영)
router.use('/users', userRouter);

// /api/notifications 로 시작하는 요청은 notificationRouter가 처리
router.use('/notifications', notificationRouter);

// router.use('/posts', postRouter); 

export default router;
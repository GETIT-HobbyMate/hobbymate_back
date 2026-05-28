import express from 'express';
import { getMyNotifications, readNotification } from '../controllers/notificationController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// [GET]   /api/notifications        : 내 알림 전체 목록 조회 (최신순)
router.get('/', authenticateToken, getMyNotifications);

// [PATCH] /api/notifications/:id/read : 특정 알림 읽음 처리
router.patch('/:id/read', authenticateToken, readNotification);

export default router;

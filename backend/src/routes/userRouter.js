import express from 'express';
import { getMe, updateMyProfile } from '../controllers/userController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// authMiddleware: JWT 토큰 검증 후 req.user.id를 세팅해줌
// 로그인한 유저만 본인 정보에 접근/수정 가능하도록 보호

// [GET]   /api/users/me : 내 프로필 및 참여 내역 조회
router.get('/me', authenticateToken, getMe);

// [PATCH] /api/users/me : 내 프로필 정보(닉네임/비밀번호) 수정
router.patch('/me', authenticateToken, updateMyProfile);

export default router;

import express from 'express';
// 컨트롤러 이름도 userController로 맞춰주었습니다.
import { getMe, updateMyProfile } from '../controllers/userController.js';

const router = express.Router();

// [GET] /api/users/me : 내 프로필 및 참여 내역 한 번에 조회 (명세서 완벽 일치)
router.get('/me', getMe);       

// [PATCH] /api/users/me : 내 프로필 정보(닉네임/비번) 일부 수정하기
// 조회 주소와 통일성을 맞추기 위해 동일한 URI(/me)에 PATCH 메서드를 사용합니다.
router.patch('/me', updateMyProfile);  

export default router;
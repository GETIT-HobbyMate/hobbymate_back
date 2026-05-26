import express from 'express';
// 컨트롤러에서 만들어둔 3개의 함수를 가져옵니다.
import { getMyProfile, updateMyProfile, getMyHistory } from '../controllers/mypageController.js';

const router = express.Router();

// [GET] /api/mypage/profile : 내 프로필 정보 가져오기
router.get('/profile', getMyProfile);       

// [PATCH] /api/mypage/profile : 내 프로필 정보(닉네임/비번) 일부 수정하기
// (REST API 규칙상 일부 수정은 PUT보다 PATCH를 권장합니다.)
router.patch('/profile', updateMyProfile);  

// [GET] /api/mypage/history : 내 모임 참여/개설 내역 가져오기
router.get('/history', getMyHistory);       

export default router;
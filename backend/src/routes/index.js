import express from 'express';
// 각 도메인별(기능별) 라우터를 모두 불러옵니다.
import mypageRouter from './mypageRouter.js';
import notificationRouter from './notificationRouter.js';

// 나중에 2번 팀원이 postRouter를 완성하면 아래 주석을 풀고 연결해주면 됩니다!
// import postRouter from './postRouter.js'; 

const router = express.Router();

// ==========================================
// 통합 라우팅 설정
// 클라이언트가 요청한 주소의 앞부분에 따라 적절한 라우터 파일로 길을 안내해줍니다.
// ==========================================

// /api/mypage 로 시작하는 모든 요청은 mypageRouter가 처리해라!
router.use('/mypage', mypageRouter);

// /api/notifications 로 시작하는 모든 요청은 notificationRouter가 처리해라!
router.use('/notifications', notificationRouter);

// /api/posts 로 시작하는 모든 요청은 postRouter가 처리해라! (팀원 코드 연동 시 사용)
// router.use('/posts', postRouter); 

export default router;
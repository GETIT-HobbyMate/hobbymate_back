import express from 'express';
// 컨트롤러에서 새로 구현한 매칭 완료 트리거(triggerMatchComplete)를 포함해 총 3개의 함수를 가져옵니다.
import { getMyNotifications, readNotification } from '../controllers/notificationController.js';

const router = express.Router();

// [GET] /api/notifications : 내 알림 전체 목록 가져오기
// 내 알림 리스트를 최신순으로 정렬하여 오픈채팅 링크와 함께 조회합니다.
router.get('/', getMyNotifications);            

// [PATCH] /api/notifications/:id/read : 특정 알림(id)을 읽음 상태로 변경하기
// 동적 파라미터(:id)를 사용해서 프론트엔드가 요청한 특정 알림 번호의 이력을 읽음(TRUE) 처리합니다.
router.patch('/:id/read', readNotification);    

export default router;
import pool from '../db.js';
import { HttpError } from '../errors/httpError.js';

/**
 * ====================================================================
 * [공용 함수] 매칭 완료 알림 전송 및 게시글 상태 변경 로직
 *
 * - 호출 시점: 신청 승인 등 인원 변동이 일어나는 시점에 다른 팀원이 호출해서 사용
 * - 반환값: { status, message } 객체
 */

export const sendMatchCompleteNotification = async (postId) => {

    // [단계 1] 게시글 정보 조회
    const [posts] = await pool.query(
        'SELECT current_capacity, max_capacity, author_id, title, open_chat_url, status FROM Posts WHERE id = ?',
        [postId]
    );

    if (posts.length === 0) {
        return { status: 404, message: '존재하지 않는 게시글입니다.' };
    }

    const post = posts[0];

    // 이미 모집 완료 상태이면 중복 실행 차단
    if (post.status === 'COMPLETED') {
        return { status: 400, message: '이미 모집이 완료되어 마감 처리가 끝난 모임입니다.' };
    }

    // 인원 미달이면 조기 종료
    if (post.current_capacity < post.max_capacity) {
        return {
            status: 'NOT_FULL',
            message: `아직 인원이 가득 차지 않았습니다. (현재: ${post.current_capacity}명 / 최대: ${post.max_capacity}명)`,
        };
    }

    // 아래 로직은 만석 상태(현재 인원 == 최대 인원)에서만 실행됨

    // [단계 2] 방장에게 매칭 완료 알림 발송
    await pool.query(
        'INSERT INTO Notifications (user_id, post_id, type, message, open_chat_url) VALUES (?, ?, "MATCH_COMPLETE", ?, ?)',
        [
            post.author_id,
            postId,
            `주최하신 [${post.title}] 모임의 인원이 모두 충족되어 모집이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`,
            post.open_chat_url,
        ]
    );

    // [단계 3] 승인된 참가자 목록 조회
    const [applicants] = await pool.query(
        'SELECT applicant_id FROM Applications WHERE post_id = ? AND status = "APPLIED"',
        [postId]
    );

    // [단계 4] 참가자 알림 데이터 미리 생성 (방장 제외)
    const notificationValues = applicants
        .filter(app => app.applicant_id !== post.author_id)
        .map(app => [
            app.applicant_id,
            postId,
            'MATCH_COMPLETE',
            `신청하신 [${post.title}] 모임이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`,
            post.open_chat_url,
        ]);

    // [단계 5] 참가자들에게 알림 한 번에 INSERT
    if (notificationValues.length > 0) {
        await pool.query(
            `
            INSERT INTO Notifications
            (user_id, post_id, type, message, open_chat_url)
            VALUES ?
            `,
            [notificationValues]
        );
    }
    
    // [단계 6] 게시글 상태를 COMPLETED로 업데이트
    await pool.query(
        'UPDATE Posts SET status = "COMPLETED" WHERE id = ?',
        [postId]
    );

    return {
        status: 200,
        message: '인원 충족 확인 성공! 방장 및 신청자 전체에게 알림 발송 및 게시글 마감 처리 완료.',
    };
};



// 1. 내 알림 목록 전체 조회 API
// [GET] /api/notifications
// ==========================================
export const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [notifications] = await pool.query(
            'SELECT id, post_id, type, message, open_chat_url, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: '알림 목록을 불러왔습니다.',
            data: {
                notifications: notifications.map(n => ({
                    notificationId: n.id,
                    type: n.type,
                    postId: n.post_id,
                    message: n.message,
                    openChatUrl: n.open_chat_url,
                    isRead: n.is_read,
                    createdAt: n.created_at,
                })),
            },
        });
    } catch (e) {
        next(new HttpError(500, '데이터베이스 조회(SELECT) 실패'));
    }
};


// 2. 알림 읽음 처리 API
// [PATCH] /api/notifications/:id/read
// ==========================================
export const readNotification = async (req, res, next) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        // 본인 알림인지 확인 후 읽음 처리 (다른 유저의 알림 조작 방지)
        const [result] = await pool.query(
            'UPDATE Notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );

        // 404 : 해당 알림이 없거나 본인 알림이 아닌 경우
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 알림을 찾을 수 없습니다.',
            });
        }

        return res.status(200).json({
            success: true,
            message: '알림 읽음 처리 완료',
        });
    } catch (e) {
        next(new HttpError(500, '데이터베이스 업데이트(UPDATE) 실패'));
    }
};

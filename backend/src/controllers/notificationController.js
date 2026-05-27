import pool from '../db.js';

/**
 * ====================================================================
 * [공용 함수] 매칭 완료 알림 전송 및 게시글 상태 변경 로직
 * - 기능은 기존과 100% 동일하며, 2번 팀원이 가져다 쓸 수 있도록 분리했습니다.
 * ====================================================================
 */
export const sendMatchCompleteNotification = async (postId) => {
    // [단계 1] 해당 게시글의 현재 인원, 최대 인원, 방장 ID, 제목, 오픈챗 링크, 모집 상태를 모두 가져옵니다.
    const [posts] = await pool.query(
        'SELECT current_capacity, max_capacity, author_id, title, open_chat_url, status FROM Posts WHERE id = ?',
        [postId]
    );

    if (posts.length === 0) {
        return { status: 404, message: "존재하지 않는 게시글입니다." };
    }

    const post = posts[0];

    // [예외 체크] 이미 모집이 완료되어 마감(COMPLETED)된 방이라면 중복 차단
    if (post.status === 'COMPLETED') {
        return { status: 400, message: "이미 모집이 완료되어 마감 처리가 끝난 모임입니다." };
    }

    // ⭐⭐ [핵심 조건문] 현재 인원이 최대 인원보다 적다면 알림을 만들지 않고 종료
    if (post.current_capacity < post.max_capacity) {
        return {
            status: 'NOT_FULL',
            message: `아직 인원이 가득 차지 않았습니다. (현재 확정 인원: ${post.current_capacity}명 / 최대 모집 인원: ${post.max_capacity}명). 조건 미달로 알림을 발송하지 않습니다.`
        };
    }

    // ------------------------------------------------------------------
    // 💡 만석 상태(현재 인원 == 최대 인원)에서만 아래 로직이 실행됩니다.
    // ------------------------------------------------------------------

    // [단계 2] 방장에게 알림 생성 (오픈챗 링크 제외)
    await pool.query(
        'INSERT INTO Notifications (user_id, post_id, type, message) VALUES (?, ?, "MATCH_COMPLETE", ?)',
        [post.author_id, postId, `주최하신 [${post.title}] 모임의 인원이 모두 충족되어 모집이 완료되었습니다!`]
    );

    // [단계 3] 해당 모집글에 신청 상태가 'APPLIED'인 신청자들의 유저 ID 조회
    const [applicants] = await pool.query(
        'SELECT applicant_id FROM Applications WHERE post_id = ? AND status = "APPLIED"',
        [postId]
    );

    // [단계 4] 신청자 전원에게 알림 생성 (오픈챗 링크 포함)
    for (let app of applicants) {
        await pool.query(
            'INSERT INTO Notifications (user_id, post_id, type, message, open_chat_url) VALUES (?, ?, ?, ?, ?)',
            [
                app.applicant_id,
                postId,
                "MATCH_COMPLETE",
                `신청하신 [${post.title}] 모임이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`,
                post.open_chat_url
            ]
        );
    }

    // [단계 5] 모집이 끝났으므로 Posts 테이블의 상태(status)를 'COMPLETED'로 변경
    await pool.query(
        'UPDATE Posts SET status = "COMPLETED" WHERE id = ?',
        [postId]
    );

    return { 
        status: 200, 
        message: "인원 충족 확인 성공! 방장 및 신청자 전체에게 오픈챗 링크가 포함된 알림 발송 및 게시글 마감 처리를 완료했습니다." 
    };
};


// ==========================================
// 1. 내 알림 리스트 전체 확인 API (GET /api/notifications)
// ==========================================
export const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user?.id || 1;  // 나중에 로그인 기능과 합쳐지면 1을 지우면 됨! 
        const [notifications] = await pool.query(
            'SELECT id, post_id, type, message, open_chat_url, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return res.status(200).json({ message: "알림 내역 조회 성공", data: notifications });
    } catch (error) {
        console.error("알림 조회 에러:", error);
        next(error);
    }
};

// ==========================================
// 2. 알림 읽음 처리 API (PATCH /api/notifications/:id/read)
// ==========================================
export const readNotification = async (req, res, next) => {
    try {
        const notificationId = req.params.id;
        const [result] = await pool.query('UPDATE Notifications SET is_read = TRUE WHERE id = ?', [notificationId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "해당 알림을 찾을 수 없습니다." });
        }
        return res.status(200).json({ message: "알림 읽음 처리 완료" });
    } catch (error) {
        console.error("알림 읽음 처리 에러:", error);
        next(error);
    }
};

// ==========================================
// 3. 매칭 완료 알림 강제 발동 테스트용 API (POST /api/notifications/trigger-complete)
// - 기존 기능을 유지하면서, 위에서 만든 공용 함수를 호출해 결과만 포스트맨에 고스란히 뱉어줍니다.
// ==========================================
export const triggerMatchComplete = async (req, res, next) => {
    try {
        const { post_id } = req.body;

        if (!post_id) {
            return res.status(400).json({ message: "post_id 값이 필요합니다." });
        }

        // 💡 위에서 분리해둔 100% 동일한 로직의 함수를 실행합니다.
        const result = await sendMatchCompleteNotification(post_id);

        // 예외가 발생했거나 인원이 안 찼다면 해당 상태코드와 메시지를 포스트맨에 그대로 응답합니다.
        if (result.status === 'NOT_FULL') {
            return res.status(200).json({ message: result.message });
        }
        if (result.status === 404 || result.status === 400) {
            return res.status(result.status).json({ message: result.message });
        }

        // 성공 시 (200 OK)
        return res.status(200).json({ message: result.message });

    } catch (error) {
        console.error("매칭 완료 알림 발송 에러:", error);
        next(error);
    }
};
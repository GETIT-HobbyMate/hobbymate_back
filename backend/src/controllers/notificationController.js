import pool from '../db.js';

// ==========================================
// 1. 내 알림 리스트 전체 확인 API
// ==========================================
export const getMyNotifications = async (req, res, next) => {
    try {
        // 로그인 기능 구현 전이므로, 테스트를 위해 1번 유저(홍길동)로 임시 고정합니다.
        const userId = req.user?.id || 1; 

        // 해당 유저(user_id)에게 온 모든 알림을 최신순으로 정렬해서 가져옵니다.
        // 프론트에서 카카오톡 링크(open_chat_url)나 읽음 여부(is_read)를 바로 쓸 수 있게 다 넘겨줍니다.
        const [notifications] = await pool.query(
            'SELECT id, post_id, type, message, open_chat_url, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        return res.status(200).json({
            message: "알림 내역 조회 성공",
            data: notifications
        });
    } catch (error) {
        console.error("알림 조회 에러:", error);
        next(error); // 에러 발생 시 app.js 전역 에러 핸들러로 던짐
    }
};

// ==========================================
// 2. 알림 읽음 처리 API (안 읽은 알림 -> 읽은 알림으로 변경)
// ==========================================
export const readNotification = async (req, res, next) => {
    try {
        // URL 파라미터에서 알림 ID를 빼옵니다. (예: /api/notifications/5/read -> id는 5)
        const notificationId = req.params.id;

        // is_read 컬럼을 TRUE(1)로 업데이트하여 '읽음' 상태로 만듭니다.
        const [result] = await pool.query(
            'UPDATE Notifications SET is_read = TRUE WHERE id = ?',
            [notificationId]
        );

        // 업데이트 된 줄(row)이 없다면, 프론트에서 존재하지 않는 잘못된 알림 ID를 보낸 것입니다.
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
// 3. [조건 검증 추가] 매칭 완료 시 알림 자동 생성 트리거 API
// 포스트맨에서 post_id를 받아 진짜로 인원이 꽉 찬 방인지 검사한 후,
// 기획서 요구사항에 따라 방장과 신청자 전원에게 알림과 오픈챗 링크를 자동으로 쏩니다.
// ==========================================
export const triggerMatchComplete = async (req, res, next) => {
    try {
        // 포스트맨의 Body를 통해 어떤 모집 게시글(post_id)이 만석이 되었는지 요청을 받습니다.
        const { post_id } = req.body;

        if (!post_id) {
            return res.status(400).json({ message: "post_id 값이 필요합니다." });
        }

        // [단계 1] 해당 게시글의 현재 인원, 최대 인원, 방장 ID, 제목, 오픈챗 링크, 모집 상태를 모두 가져옵니다.
        const [posts] = await pool.query(
            'SELECT current_capacity, max_capacity, author_id, title, open_chat_url, status FROM Posts WHERE id = ?',
            [post_id]
        );

        if (posts.length === 0) {
            return res.status(404).json({ message: "존재하지 않는 게시글입니다." });
        }

        const post = posts[0];

        // [예외 체크] 이미 모집이 완료되어 마감(`COMPLETED`)된 방이라면 중복으로 알림을 보내지 않고 차단합니다.
        if (post.status === 'COMPLETED') {
            return res.status(400).json({ 
                message: "이미 모집이 완료되어 마감 처리가 끝난 모임입니다." 
            });
        }

        // ⭐⭐⭐ [핵심 조건문] 기획서 규칙 반영: 현재 인원이 최대 인원보다 적다면 알림을 만들지 않고 종료합니다.
        if (post.current_capacity < post.max_capacity) {
            return res.status(200).json({
                message: `아직 인원이 가득 차지 않았습니다. (현재 확정 인원: ${post.current_capacity}명 / 최대 모집 인원: ${post.max_capacity}명). 조건 미달로 알림을 발송하지 않습니다.`
            });
        }

        // ------------------------------------------------------------------
        // 💡 아래 로직은 위의 IF문 검증을 통과하여 [현재 인원 == 최대 인원]이 된 만석 상태에서만 발동합니다!
        // ------------------------------------------------------------------

        // [단계 2] 기획서 내용 반영 - (모집장)에게 해당 모집이 완료되었다는 사실을 Notifications 테이블에 INSERT 하여 알립니다.
        await pool.query(
            'INSERT INTO Notifications (user_id, post_id, type, message) VALUES (?, ?, "MATCH_COMPLETE", ?)',
            [post.author_id, post_id, `주최하신 [${post.title}] 모임의 인원이 모두 충족되어 모집이 완료되었습니다!`]
        );

        // [단계 3] 해당 모집글에 매칭을 신청하여 대기 중인 모든 신청자('APPLIED')들의 유저 ID를 Applications 테이블에서 수집합니다.
        const [applicants] = await pool.query(
            'SELECT applicant_id FROM Applications WHERE post_id = ? AND status = "APPLIED"',
            [post_id]
        );

        // [단계 4] 조회된 모든 (신청자)들에게 모임에 가야 함을 알리고, 오픈 카카오톡 방 링크(open_chat_url)를 담아 각각 알림을 생성합니다.
        for (let app of applicants) {
            await pool.query(
                'INSERT INTO Notifications (user_id, post_id, type, message, open_chat_url) VALUES (?, ?, ?, ?, ?)',
                [
                    app.applicant_id,
                    post_id,
                    "MATCH_COMPLETE",
                    `신청하신 [${post.title}] 모임이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`,
                    post.open_chat_url // 기획서 요구사항인 오픈 카카오톡 링크 매핑
                ]
            );
        }

        // [단계 5] 모집이 완벽히 끝났으므로 Posts 테이블의 상태(status)를 'COMPLETED'로 함께 변경해 줍니다.
        await pool.query(
            'UPDATE Posts SET status = "COMPLETED" WHERE id = ?',
            [post_id]
        );

        return res.status(200).json({
            message: "인원 충족 확인 성공! 방장 및 신청자 전체에게 오픈챗 링크가 포함된 알림 발송 및 게시글 마감 처리를 완료했습니다."
        });

    } catch (error) {
        console.error("매칭 완료 알림 발송 에러:", error);
        next(error);
    }
};
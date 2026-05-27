import pool from '../db.js'; // MySQL 데이터베이스 Pool 임포트 (DB 커넥션을 효율적으로 관리하기 위함)

/**
 * ====================================================================
 * [공용 함수] 매칭 완료 알림 전송 및 게시글 상태 변경 로직
 * - 기능: 특정 게시글의 인원이 만석이 되었는지 확인하고 알림을 쏴주는 핵심 비즈니스 로직
 * - 호출 시점: 신청 승인 API 등 인원 변동이 일어나는 시점에 다른 팀원이 호출해서 사용함
 * ====================================================================
 */
export const sendMatchCompleteNotification = async (postId) => {
    
    // [단계 1] 검증 및 알림 데이터 확보를 위해 해당 게시글의 정보를 DB에서 조회
    // 게시글 테이블(Posts)에서 현재 인원, 최대 인원, 주최자 ID, 제목, 오픈챗 링크, 모집 상태를 가져옴
    const [posts] = await pool.query(
        'SELECT current_capacity, max_capacity, author_id, title, open_chat_url, status FROM Posts WHERE id = ?',
        [postId] // SQL Injection 방지를 위해 파라미터 바인딩 처리
    );

    // 예외 처리: 만약 조회된 게시글 배열의 길이가 0이라면 존재하지 않는 게시글임
    if (posts.length === 0) {
        return { status: 404, message: "존재하지 않는 게시글입니다." };
    }

    // 배열의 첫 번째 요소를 변수에 담아 사용하기 편하게 만듦
    const post = posts[0];

    // 예외 처리: 이미 모집 완료(COMPLETED) 상태인 방이라면 로직이 중복 실행되거나 알림이 중복 발송되는 것을 원천 차단
    if (post.status === 'COMPLETED') {
        return { status: 400, message: "이미 모집이 완료되어 마감 처리가 끝난 모임입니다." };
    }

    // [핵심 조건 검사]: 현재까지 확정된 인원이 방의 최대 모집 인원보다 적다면 조건 미달이므로 즉시 종료
    if (post.current_capacity < post.max_capacity) {
        return {
            status: 'NOT_FULL', // 컨트롤러가 인식할 수 있도록 커스텀 상태 문자열 반환
            message: `아직 인원이 가득 차지 않았습니다. (현재 확정 인원: ${post.current_capacity}명 / 최대 모집 인원: ${post.max_capacity}명). 조건 미달로 알림을 발송하지 않습니다.`
        };
    }

    // ------------------------------------------------------------------
    // 💡 아래 로직은 위 조건문을 통과한 '만석 상태(현재 인원 == 최대 인원)'에서만 실행됨!
    // ------------------------------------------------------------------

    // [단계 2] 모임을 개최한 방장(주최자)에게 매칭 완료 알림 발송 (오픈채팅방 링크 포함)
    // 알림 테이블(Notifications)에 유저ID, 게시글ID, 알림타입, 메시지 내용, 오픈챗 링크를 삽입
    await pool.query(
        'INSERT INTO Notifications (user_id, post_id, type, message, open_chat_url) VALUES (?, ?, "MATCH_COMPLETE", ?, ?)',
        [
            post.author_id, // 알림을 받을 주최자의 고유 유저 ID
            postId,         // 연관된 게시글 ID
            `주최하신 [${post.title}] 모임의 인원이 모두 충족되어 모집이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`, // 알림 메시지 문구
            post.open_chat_url // 방장용 알림에도 오픈채팅방 링크를 저장
        ]
    );

    // [단계 3] 해당 게시글에 참여가 승인된 참가자들(Applications 테이블의 status가 'APPLIED'인 신청자들)의 유저 ID를 모두 추출
    const [applicants] = await pool.query(
        'SELECT applicant_id FROM Applications WHERE post_id = ? AND status = "APPLIED"',
        [postId]
    );

    // [단계 4] 조회된 참가자 명단을 루프(순회) 돌면서 한 명씩 알림을 생성하여 DB에 적재
    for (let app of applicants) {
        // 혹시 Applications 테이블에 방장 본인의 ID가 섞여 있다면 중복 알림을 막기 위해 제외 처리
        if (app.applicant_id !== post.author_id) { 
            // 일반 참가자들에게 전송될 알림 데이터 생성 (메시지 문구와 오픈채팅방 링크 매핑)
            await pool.query(
                'INSERT INTO Notifications (user_id, post_id, type, message, open_chat_url) VALUES (?, ?, ?, ?, ?)',
                [
                    app.applicant_id,  // 알림을 수신할 참가자의 유저 ID
                    postId,            // 연관된 게시글 ID
                    "MATCH_COMPLETE",  // 알림 종류 식별자
                    `신청하신 [${post.title}] 모임이 완료되었습니다! 아래 오픈채팅방 링크로 참여해 주세요.`, // 안내 문구
                    post.open_chat_url // 참가자가 타고 들어갈 오픈채팅방 URL 링크
                ]
            );
        }
    }

    // [단계 5] 모든 인원이 모여 매칭이 완전 마감되었으므로, 게시글 테이블(Posts)의 모집 상태(status)를 'COMPLETED'로 업데이트
    await pool.query(
        'UPDATE Posts SET status = "COMPLETED" WHERE id = ?',
        [postId]
    );

    // 성공 결과 처리를 위해 200 코드와 안내 메시지를 객체 형태로 반환
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
        // 인증 미들웨어(req.user)에서 로그인한 사용자 ID를 추출 (아직 비로그인 상태일 경우 테스트를 위해 기본값 1번 유저로 세팅)
        const userId = req.user?.id || 1; 
        
        // 데이터베이스에서 해당 유저에게 온 알림 목록을 최신순(created_at DESC)으로 정렬하여 쿼리 실행
        // ⚠️ (주의) Notifications 테이블에는 없는 current_capacity 정렬 조건을 제거하여 SQL 오류를 사전 방지함
        const [notifications] = await pool.query(
            'SELECT id, post_id, type, message, open_chat_url, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        // API 명세서 규격에 맞춰 응답 패킷 전송
        return res.status(200).json({ 
            success: true,                       // 성공 여부 판단 플래그 (기획서 필수 항목)
            message: "알림 목록을 불러왔습니다.", // 명세서 사진과 매칭시킨 성공 문구
            data: {
                // DB에서 꺼내온 스네이크 케이스(snake_case) 컬럼명을 프론트엔드가 요구하는 카멜 케이스(camelCase)로 전면 포맷 변환
                notifications: notifications.map(n => ({
                    type: n.type,                 // 알림 구분 타입 ("MATCH_COMPLETE")
                    postId: n.post_id,            // post_id 값을 postId 필드명으로 치환
                    message: n.message,           // 화면에 렌더링될 실제 알림 텍스트 문구
                    openChatUrl: n.open_chat_url, // open_chat_url 값을 openChatUrl 필드명으로 치환 (방장/참가자 모두 링크 탑재 완료)
                    createdAt: n.created_at       // created_at 값을 createdAt 필드명으로 치환
                }))
            }
        });
    } catch (error) {
        console.error("알림 조회 에러:", error); // 디버깅을 위해 콘솔(터미널)에 에러 원인 출력
        next(error);                            // app.js에 정의된 전역 에러 핸들러 미들웨어로 에러를 전달
    }
};

// ==========================================
// 2. 알림 읽음 처리 API (PATCH /api/notifications/:id/read)
// ==========================================
export const readNotification = async (req, res, next) => {
    try {
        // 클라이언트가 요청 라우터 파라미터로 넘겨준 알림 고유 ID 추출 (예: /api/notifications/7/read -> 7)
        const notificationId = req.params.id;
        
        // 데이터베이스에서 해당 알림의 읽음 여부 상태 컬럼(is_read)을 TRUE(1)로 변경 업데이트 수행
        const [result] = await pool.query('UPDATE Notifications SET is_read = TRUE WHERE id = ?', [notificationId]);
        
        // 예외 처리: DB에서 수정된 행의 개수(affectedRows)가 0개라면, 조작하려는 알림 ID가 존재하지 않는 경우임
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, // 실패 플래그 전송
                message: "해당 알림을 찾을 수 없습니다." 
            });
        }
        
        // 수정 완료 시 공통 응답 규격 포맷(success, message)에 맞춰서 브라우저에 결과 반환
        return res.status(200).json({ 
            success: true,
            message: "알림 읽음 처리 완료" 
        });
    } catch (error) {
        console.error("알림 읽음 처리 에러:", error); // 터미널에 에러 기록
        next(error);                            // 전역 에러 미들웨어로 토스
    }
};

import pool from '../db.js'; // MySQL 데이터베이스와 연결하기 위한 커넥션 풀을 가져옵니다.

// ==========================================
// 1. 내 프로필 및 참여 내역 통합 조회 API (GET /api/users/me)
// 기획서(555.jpg) 요구사항: success, message 문구 및 CamelCase 구조 일치화
// ==========================================
export const getMe = async (req, res, next) => {
    try {
        // [1] 유저 식별 (로그인 구현 전이므로 테스트용 1번 고정)
        const userId = req.user?.id || 1; 

        // --------------------------------------------------
        // [2] 내 프로필 정보 조회 (Users 테이블)
        // --------------------------------------------------
        const [userRows] = await pool.query(
            'SELECT student_id, nickname FROM Users WHERE id = ?', 
            [userId]
        );
        
        if (userRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "존재하지 않는 유저입니다." 
            });
        }

        const userProfile = userRows[0];

        // --------------------------------------------------
        // [3] 참여 내역 - 내가 만든 방 (Posts 테이블)
        // --------------------------------------------------
        const [hostedPosts] = await pool.query(
            'SELECT id, title, status, meeting_time FROM Posts WHERE author_id = ? ORDER BY created_at DESC', 
            [userId]
        );

        // --------------------------------------------------
        // [4] 참여 내역 - 내가 신청한 방 (Posts + Applications 조인)
        // --------------------------------------------------
        const [appliedPosts] = await pool.query(
            `SELECT p.id, p.title, p.status, p.meeting_time FROM Posts p 
             INNER JOIN Applications a ON p.id = a.post_id 
             WHERE a.applicant_id = ? AND a.status = 'APPLIED'
             ORDER BY a.created_at DESC`, 
            [userId]
        );

        // --------------------------------------------------
        // [5] 최종 응답 데이터 조립 및 반환
        // --------------------------------------------------
        return res.status(200).json({ 
            success: true,                      // 1. success 필드 추가
            message: "내 정보를 불러왔습니다.",   // 2. 메시지 텍스트 일치
            data: {
                profile: {
                    studentId: userProfile.student_id, // 3. studentId 카멜케이스 변환
                    nickname: userProfile.nickname
                },
                // 4. history 계층 제거하고 hostedPosts, appliedPosts로 분리 + 내부 필드 카멜케이스 변환
                hostedPosts: hostedPosts.map(post => ({
                    postId: post.id,            // id -> postId
                    title: post.title,
                    status: post.status,
                    meetingTime: post.meeting_time // meeting_time -> meetingTime
                })),
                appliedPosts: appliedPosts.map(post => ({
                    postId: post.id,            // id -> postId
                    title: post.title,
                    status: post.status,
                    meetingTime: post.meeting_time // meeting_time -> meetingTime
                }))
            } 
        });
    } catch (error) {
        console.error("내 프로필 및 참여 내역 통합 조회 에러:", error);
        next(error); 
    }
};

// ==========================================
// 2. 내 프로필 수정 API (PATCH /api/users/me)
// 요구사항: 수정 성공 시 success: true 및 "프로필 정보가 변경되었습니다." 반환
// ==========================================
export const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        // 클라이언트가 HTTP 요청의 body에 담아 보낸 데이터를 구조분해할당으로 추출합니다.
        const { nickname, password } = req.body;

        // [데이터 검증] 닉네임이나 비밀번호 중 하나라도 누락되었다면 400 에러를 반환합니다.
        if (!nickname || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "닉네임과 비밀번호를 모두 입력해주세요." 
            });
        }

        // [프로필 업데이트]
        const [result] = await pool.query(
            'UPDATE Users SET nickname = ?, password = ? WHERE id = ?', 
            [nickname, password, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "수정할 유저를 찾지 못했습니다." 
            });
        }

        // 정상적으로 업데이트가 완료되었음을 알립니다.
        return res.status(200).json({ 
            success: true,                        // success 필드 추가
            message: "프로필 정보가 변경되었습니다." // 메시지 문구 일치 ("성공적으로" 삭제)
        });
    } catch (error) {
        console.error("프로필 수정 에러:", error);
        next(error);
    }
};
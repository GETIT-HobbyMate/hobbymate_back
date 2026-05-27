import pool from '../db.js'; // MySQL 데이터베이스와 연결하기 위한 커넥션 풀을 가져옵니다.

// ==========================================
// 1. 내 프로필 및 참여 내역 통합 조회 API (GET /api/users/me)
// 기획서 요구사항: 단일 API(/api/users/me) 호출만으로 사용자의 프로필 정보와 
//                 참여 이력(개설한 방, 참여한 방)을 모두 반환해야 합니다.
// ==========================================
export const getMe = async (req, res, next) => {
    try {
        // [1] 유저 식별
        // 실제 운영 환경에서는 로그인 검증 미들웨어(예: JWT 확인)를 거쳐 req.user.id 값을 받아옵니다.
        // 현재는 로그인 기능이 연동되기 전이므로, 테스트를 위해 유저 ID를 1로 강제 할당합니다.
        const userId = req.user?.id || 1; 

        // --------------------------------------------------
        // [2] 내 프로필 정보 조회 (Users 테이블)
        // --------------------------------------------------
        // 보안상 중요 정보인 비밀번호(password)는 제외하고 화면에 보여줄 정보만 명시적으로 SELECT 합니다.
        const [userRows] = await pool.query(
            'SELECT id, student_id, nickname, created_at FROM Users WHERE id = ?', 
            [userId]
        );
        
        // 만약 조회된 데이터가 없다면(길이가 0), DB에 존재하지 않거나 탈퇴한 유저입니다.
        if (userRows.length === 0) {
            return res.status(404).json({ message: "존재하지 않는 유저입니다." });
        }

        // --------------------------------------------------
        // [3] 참여 내역 - 내가 만든 방 (Posts 테이블)
        // --------------------------------------------------
        // 내가 '방장(author_id)'으로 작성한 모든 모집글을 가져옵니다.
        // 최신 글이 위로 오도록 생성일자(created_at) 기준 내림차순(DESC) 정렬합니다.
        const [hostedPosts] = await pool.query(
            'SELECT * FROM Posts WHERE author_id = ? ORDER BY created_at DESC', 
            [userId]
        );

        // --------------------------------------------------
        // [4] 참여 내역 - 내가 신청한 방 (Posts + Applications 조인)
        // --------------------------------------------------
        // 내가 '신청자'로 들어간 방의 "게시글(Posts) 정보"가 필요하므로 두 테이블을 조인(INNER JOIN)합니다.
        // p.* 를 통해 Posts 테이블의 모든 정보를 가져오고, 
        // 조건 1: a.applicant_id = ? -> 내가 신청한 내역이어야 함
        // 조건 2: a.status = 'APPLIED' -> 신청이 취소/거절되지 않고 정상적으로 완료된 상태여야 함
        const [appliedPosts] = await pool.query(
            `SELECT p.* FROM Posts p 
             INNER JOIN Applications a ON p.id = a.post_id 
             WHERE a.applicant_id = ? AND a.status = 'APPLIED'
             ORDER BY a.created_at DESC`, 
            [userId]
        );

        // --------------------------------------------------
        // [5] 최종 응답 데이터 조립 및 반환
        // --------------------------------------------------
        // 프론트엔드에서 데이터를 쉽게 다룰 수 있도록 직관적인 객체 구조(profile, history)로 묶어서 보내줍니다.
        return res.status(200).json({ 
            message: "내 프로필 및 참여 내역 조회 성공", 
            data: {
                profile: userRows[0],         // 배열의 첫 번째 요소(실제 유저 데이터 객체)만 전달
                history: {
                    myRooms: hostedPosts,     // 조회한 '내가 개설한 모임' 배열
                    joinedRooms: appliedPosts // 조회한 '내가 참여한 모임' 배열
                }
            } 
        });
    } catch (error) {
        // 쿼리 실행 중 문법 에러나 DB 연결 문제가 발생하면 이곳으로 빠집니다.
        console.error("내 프로필 및 참여 내역 통합 조회 에러:", error);
        // next(error)를 호출하여 app.js에 등록된 글로벌 에러 핸들러가 처리하도록 위임합니다.
        next(error); 
    }
};

// ==========================================
// 2. 내 프로필 수정 API (PATCH /api/users/me)
// 요구사항: 수정할 수 있는 내용은 닉네임과 비밀번호로 제한해야 합니다.
// ==========================================
export const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id || 1;

        // 클라이언트가 HTTP 요청의 body에 담아 보낸 데이터를 구조분해할당으로 추출합니다.
        const { nickname, password } = req.body;

        // [데이터 검증] 닉네임이나 비밀번호 중 하나라도 누락되었다면 400 Bad Request 에러를 반환합니다.
        if (!nickname || !password) {
            return res.status(400).json({ message: "닉네임과 비밀번호를 모두 입력해주세요." });
        }

        // [프로필 업데이트]
        // 학번(student_id) 등은 불변 데이터이므로 쿼리에서 제외하여 수정 요구사항을 충족합니다.
        // 🚨 중요: 추후 회원가입/로그인 로직이 완성되면, 여기서 들어온 password를 
        // 그냥 저장하지 말고 bcrypt 등을 사용해 '해싱(암호화)'한 뒤 저장하도록 로직을 추가해야 합니다.
        const [result] = await pool.query(
            'UPDATE Users SET nickname = ?, password = ? WHERE id = ?', 
            [nickname, password, userId]
        );

        // UPDATE 쿼리 실행 결과, 변경된 행(affectedRows)이 0개라면
        // 조건(WHERE id = ?)에 맞는 유저가 DB에 없다는 의미입니다.
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "수정할 유저를 찾지 못했습니다." });
        }

        // 정상적으로 업데이트가 완료되었음을 알립니다.
        return res.status(200).json({ message: "프로필 정보가 성공적으로 변경되었습니다." });
    } catch (error) {
        console.error("프로필 수정 에러:", error);
        next(error);
    }
};
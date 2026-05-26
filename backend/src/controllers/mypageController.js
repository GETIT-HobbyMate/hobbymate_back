import pool from '../db.js'; // 트리 구조상 controllers 폴더 상위에 있는 db.js 호출

// ==========================================
// 1. 내 프로필 조회 API
// ==========================================
export const getMyProfile = async (req, res, next) => {
    try {
        // [임시 처리] 원래는 1번 개발자가 만든 로그인 미들웨어를 통해 req.user.id로 받아옵니다.
        // 현재는 테스트를 위해 DBeaver Users 테이블에 id가 1인 유저가 있다고 가정하고 진행합니다.
        const userId = req.user?.id || 1; 

        // 보안상 비밀번호(password)는 제외하고 학번, 닉네임, 가입일만 안전하게 추출합니다.
        const [rows] = await pool.query(
            'SELECT id, student_id, nickname, created_at FROM Users WHERE id = ?', 
            [userId]
        );
        
        // DB에 해당 유저가 없는 경우 404 에러를 반환합니다.
        if (rows.length === 0) {
            return res.status(404).json({ message: "존재하지 않는 유저입니다." });
        }
        
        // 성공 시 200 상태 코드와 함께 유저 데이터를 클라이언트(프론트)로 보냅니다.
        return res.status(200).json({ 
            message: "프로필 조회 성공", 
            data: rows[0] 
        });
    } catch (error) {
        console.error("프로필 조회 에러:", error);
        // [글로벌 에러 처리] 에러가 발생하면 app.js에 있는 전역 에러 핸들러로 책임을 넘깁니다.
        next(error); 
    }
};

// ==========================================
// 2. 내 프로필 수정 API (닉네임, 비밀번호만 수정 가능)
// ==========================================
export const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id || 1;
        // 클라이언트가 body에 담아 보낸 수정할 닉네임과 비밀번호를 꺼냅니다.
        const { nickname, password } = req.body;

        // 둘 중 하나라도 입력하지 않았다면 400(Bad Request) 에러를 뱉습니다.
        if (!nickname || !password) {
            return res.status(400).json({ message: "닉네임과 비밀번호를 모두 입력해주세요." });
        }

        // 학번(student_id)은 불변 정보이므로 제외하고, 닉네임과 비밀번호만 업데이트합니다.
        // (💡주의: 나중에 1번 개발자가 패스워드 해시화를 도입하면, 여기서 bcrypt 라이브러리로 암호화하는 과정이 추가되어야 합니다!)
        const [result] = await pool.query(
            'UPDATE Users SET nickname = ?, password = ? WHERE id = ?', 
            [nickname, password, userId]
        );

        // affectedRows가 0이라는 것은 WHERE id = ? 조건에 맞는 유저가 없었다는 뜻입니다.
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "수정할 유저를 찾지 못했습니다." });
        }

        return res.status(200).json({ message: "프로필 정보가 성공적으로 변경되었습니다." });
    } catch (error) {
        console.error("프로필 수정 에러:", error);
        next(error);
    }
};

// ==========================================
// 3. 참여 내역 조회 API (내가 만든 방 + 내가 신청한 방 분리 반환)
// ==========================================
export const getMyHistory = async (req, res, next) => {
    try {
        const userId = req.user?.id || 1;

        // [Case A] 내가 '방장(author_id)'으로서 직접 등록한 모집 게시글 목록을 최신순(DESC)으로 가져옵니다.
        const [hostedPosts] = await pool.query(
            'SELECT * FROM Posts WHERE author_id = ? ORDER BY created_at DESC', 
            [userId]
        );

        // [Case B] 내가 '신청자(applicant_id)'로서 매칭 신청한 게시글 목록을 가져옵니다.
        // INNER JOIN을 사용해 Applications(신청내역) 테이블과 Posts(게시글) 테이블을 연결합니다.
        // 현재 상태가 'APPLIED(신청완료)'인 것만 필터링합니다.
        const [appliedPosts] = await pool.query(
            `SELECT p.* FROM Posts p 
             INNER JOIN Applications a ON p.id = a.post_id 
             WHERE a.applicant_id = ? AND a.status = 'APPLIED'
             ORDER BY a.created_at DESC`, 
            [userId]
        );

        // 방장인 경우와 신청자인 경우를 분리해서 프론트에 예쁘게 포장해서 보내줍니다.
        return res.status(200).json({
            message: "참여 내역 조회 성공",
            data: {
                myRooms: hostedPosts,     // 내가 개설한 모임 리스트
                joinedRooms: appliedPosts // 내가 신청해서 들어간 모임 리스트
            }
        });
    } catch (error) {
        console.error("참여 내역 조회 에러:", error);
        next(error);
    }
};
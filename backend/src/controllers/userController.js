import bcrypt from 'bcrypt';
import pool from '../db.js';
import { HttpError } from '../errors/httpError.js';


// 1. 내 프로필 및 참여 내역 통합 조회 API
// [GET] /api/users/me
// ==========================================
export const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        // [1] [2] [3] <- 병렬로 동시에 처리
        // 내 프로필 정보 조회, 내가 만든 방 (방장인 게시글), 내가 신청한 방
        const [[userRows], [hostedPosts], [appliedPosts]] = await Promise.all([ 
            pool.query(  // [1] 내 프로필 정보 조회
                'SELECT student_id, nickname FROM Users WHERE id = ?',
                [userId]
            ),
            pool.query(  // [2] 내가 만든 방 (방장인 게시글)
                'SELECT id, title, status, meeting_time FROM Posts WHERE author_id = ? ORDER BY created_at DESC',
                [userId]
            ),
            pool.query(  // [3] 내가 신청한 방
                `SELECT p.id, p.title, p.status, p.meeting_time
                FROM Posts p
                INNER JOIN Applications a ON p.id = a.post_id
                WHERE a.applicant_id = ? AND a.status = 'APPLIED'
                ORDER BY a.created_at DESC`,
                [userId]
            ),
        ]);

        // 404 : 존재하지 않는 유저
        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '존재하지 않는 유저입니다.',
            });
        }

        return res.status(200).json({
            success: true,
            message: '내 정보를 불러왔습니다.',
            data: {
                profile: {
                    studentId: userRows[0].student_id,
                    nickname: userRows[0].nickname,
                },
                hostedPosts: hostedPosts.map(post => ({
                    postId: post.id,
                    title: post.title,
                    status: post.status,
                    meetingTime: post.meeting_time,
                })),
                appliedPosts: appliedPosts.map(post => ({
                    postId: post.id,
                    title: post.title,
                    status: post.status,
                    meetingTime: post.meeting_time,
                })),
            },
        });
    } catch (e) {
        next(new HttpError(500, '데이터베이스 조회(SELECT) 실패'));
    }
};

// 닉네임 형식 검사 함수
const isValidNickname = (nickname) => {
    const nicknameRegex = /^[가-힣a-zA-Z0-9]{2,10}$/;
    return nicknameRegex.test(nickname);
};

// 닉네임 중복 검사 함수
const isNicknameDuplicate = async (nickname, excludeUserId = null) => {
    const [rows] = await pool.query(
        'SELECT id FROM Users WHERE nickname = ? AND id != ?',
        [nickname, excludeUserId ?? -1]  // excludeUserId를 통해서 닉네임을 안 바꾸고 비밀번호만 수정하는 경우를
    );                                   // 정상 처리하기 위해서 자기자신의 Id는 제외함
    return rows.length > 0;
}

// 2. 내 프로필 수정 API
// [PATCH] /api/users/me
// ==========================================
export const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { nickname, password } = req.body;

        // 400: 둘 다 안 보낸 경우 (닉네임/비밀번호 둘 중 하나만 수정 가능)
        if (!nickname && !password) {
            return res.status(400).json({
                success: false,
                message: '수정할 값을 입력해주세요.',
            });
        }

        const updateFields = [];  // updateFields에 들어간 것만 수정 (닉네임 or 비밀번호)
        const values = [];  // 닉네임 or 비밀번호 값을 입력

        // 닉네임 수정 (닉네임을 입력했을 시)
        if (nickname) {
            // 400: 닉네임 형식 검사
            if (!isValidNickname(nickname)) {
                return res.status(400).json({
                    success: false,
                    message: '닉네임 형식이 올바르지 않습니다. (한글, 영문, 숫자 조합 2~10자. 특수문자/공백 불가)',
                });
            }
            // 409: 닉네임 중복 검사 (자기 자신은 제외)
            if (await isNicknameDuplicate(nickname, userId)) {
                return res.status(409).json({
                    success: false,
                    message: '이미 사용 중인 닉네임입니다.',
                });
            }
            updateFields.push('nickname = ?');
            values.push(nickname);
        }

        // 비밀번호 수정 (비밀번호를 입력했을 시)
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            values.push(hashedPassword);
        }

        values.push(userId);

        const [result] = await pool.query(  //updateFields에 들어간 것만 수정 (닉네임 or 비밀번호)
            `UPDATE Users SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );

        // 404 : 수정할 유저가 없는 경우
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '수정할 유저를 찾지 못했습니다.',
            });
        }

        return res.status(200).json({
            success: true,
            message: '프로필 정보가 변경되었습니다.',
        });
    } catch (e) {
        next(new HttpError(500, '데이터베이스 업데이트(UPDATE) 실패'));
    }
};
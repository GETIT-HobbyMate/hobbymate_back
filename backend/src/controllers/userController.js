import bcrypt from 'bcrypt';
import pool from '../db.js';
import { HttpError } from '../errors/httpError.js';


// 1. 내 프로필 및 참여 내역 통합 조회 API
// [GET] /api/users/me
// ==========================================
export const getMe = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // [1] 내 프로필 정보 조회
        const [userRows] = await pool.query(
            'SELECT student_id, nickname FROM Users WHERE id = ?',
            [userId]
        );

        // 404 : 존재하지 않는 유저
        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '존재하지 않는 유저입니다.',
            });
        }

        const userProfile = userRows[0];

        // [2] 참여 내역 - 내가 만든 방 (방장인 게시글)
        const [hostedPosts] = await pool.query(
            'SELECT id, title, status, meeting_time FROM Posts WHERE author_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // [3] 참여 내역 - 내가 신청한 방
        const [appliedPosts] = await pool.query(
            `SELECT p.id, p.title, p.status, p.meeting_time
             FROM Posts p
             INNER JOIN Applications a ON p.id = a.post_id
             WHERE a.applicant_id = ? AND a.status = 'APPLIED'
             ORDER BY a.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: '내 정보를 불러왔습니다.',
            data: {
                profile: {
                    studentId: userProfile.student_id,
                    nickname: userProfile.nickname,
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

// 2. 내 프로필 수정 API
// [PATCH] /api/users/me
// ==========================================
export const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { nickname, password } = req.body;

        // 400 : 닉네임과 비밀번호 중 하나라도 없으면
        if (!nickname || !password) {
            return res.status(400).json({
                success: false,
                message: '닉네임과 비밀번호를 모두 입력해주세요.',
            });
        }

        // 비밀번호 해시화 (평문 저장 금지)
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'UPDATE Users SET nickname = ?, password = ? WHERE id = ?',
            [nickname, hashedPassword, userId]
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

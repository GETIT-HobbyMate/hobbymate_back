import pool from '../db.js';
import bcrypt from 'bcrypt';

//

// 회원가입
export const signUp = async (req, res, next) => {   // async 사용
    const { studentId, password, nickname } = req.body;

    // 입력값 누락 시
    if (!studentId || !password || !nickname)
        return res.status(400).json({
            "success": false,
            "message": "필수 입력값이 누락되었습니다.",
            "data": {
                "errorCode": "INVALID_INPUT"
            }
        });

    // 중복 학번 확인될 시
    /*
        res.status(409).json({
            "success": false,
            "message": "이미 존재하는 학번입니다.",
            "data": {
                "errorCode": "DUPLICATE_USER"
            }
        });
    */

    // 중복 닉네임 확인될 시
    /*
        res.status(409).json({
            "success": false,
            "message": "이미 존재하는 닉네임입니다.",
            "data": {
                "errorCode": "DUPLICATE_USER"
            }
        });
    */

    try {
        // 비밀번호 해싱
        const saltRounds = 10;  // 해싱 복잡도
        const hashedPassword = await bcrypt.hash(password, saltRounds); // 해싱 거친 비밀번호

        // INSERT
        const [result] = await pool.execute(
            'INSERT INTO Users (student_id, password, nickname) VALUES (?, ?, ?)',
            [studentId, hashedPassword, nickname]
        );

        res.status(201).json({
            "success": true,
            "message": "회원가입이 완료되었습니다.",
            "data": {
                userId: result.insertId
            }
        });
    } catch (e) {
        next(e);
    }
}
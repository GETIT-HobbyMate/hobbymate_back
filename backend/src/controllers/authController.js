import pool from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 중복 학번 확인
export const checkDuplicateStudentId = async (req, res, next) => {
    try {
        const { studentId } = req.params; // Path Variable (/studentId/{studentId})
        const studentIdRegex = /^\d{10}$/;  // 학번의 정규표현식

        // 400 : 올바르지 않은 학번 형식
        if (!studentIdRegex.test(studentId)) {  // studentId가 학번의 정규표현식(studentIdRegex)에 부합?
            return res.status(400).json({
                "success": false,
                "message": "학번 형식이 올바르지 않습니다.",
                "data": {
                    "errorCode": "INVALID_FORMAT"
                }
            });
        }

        // DB에서 id 조회
        const [rows] = await pool.query(
            'SELECT id FROM Users WHERE student_id = ?',
            [studentId]
        );

        // 200 : 데이터가 존재하면 중복된 학번
        if (rows.length > 0) {
            return res.status(200).json({
                "success": true,
                "message": "이미 가입된 학번입니다.",
                "data": {
                    "isAvailable": false
                }
            });
        }

        // 200 : 중복X. 사용 가능한 경우
        res.status(200).json({
            "success": true,
            "message": "사용 가능한 학번입니다.",
            "data": {
                "isAvailable": true
            }
        });
    } catch (e) {
        next(e);
    }
}

// 중복 닉네임 확인
export const checkDuplicateNickname = async (req, res, next) => {
    try {
        const { nickname } = req.params; // Path Variable (/nickname/{nickname})
        const nicknameRegex = /^[가-힣a-zA-Z0-9]{2,10}$/;   // (1)한글(가-힣), 영문(a-zA-Z), 숫자(0-9)로만 이루어진, (2)2자 이상 10자 이하 문자열

        // 400 : 올바르지 않은 형식(규칙?)
        if (!nicknameRegex.test(nickname)) {    // nickname이 정규표현식(nicknameRegex)에 부합?
            return res.status(400).json({
                "success": false,
                "message": "닉네임 형식이 올바르지 않습니다. (한글, 영문, 숫자 조합 2~10자. 특수문자/공백 불가)",
                "data": {
                    "errorCode": "INVALID_FORMAT"
                }
            });
        }

        const [rows] = await pool.query(
            'SELECT id FROM Users WHERE nickname = ?',
            [nickname]
        );

        // 200 : 중복된 닉네임
        if (rows.length > 0) {
            return res.status(200).json({
                "success": true,
                "message": "이미 가입된 닉네임입니다.",
                "data": {
                    "isAvailable": false
                }
            });
        }

        // 200 : 중복되지 않은 경우
        res.status(200).json({
            "success": true,
            "message": "사용 가능한 닉네임입니다.",
            "data": {
                "isAvailable": true
            }
        });
    } catch (e) {
        next(e);
    }
}

// 회원가입
export const signUp = async (req, res, next) => {   // async 사용
    const { studentId, password, nickname } = req.body;

    // 400 : 입력값 누락 시
    if (!studentId || !password || !nickname)
        return res.status(400).json({
            "success": false,
            "message": "필수 입력값이 누락되었습니다.",
            "data": {
                "errorCode": "INVALID_INPUT"
            }
        });

    // 201 : create
    try {
        // 학번 중복 검사 (필요시 형식 검사도 추가해야 함)
        const [studentRows] = await pool.query(
            'SELECT id FROM Users WHERE student_id = ?',
            [studentId]
        );
        if (studentRows.length > 0) {
            return res.status(409).json({ // 명세서 요구사항에 따라 400 혹은 409
                "success": false,          // 회원가입 실패 상황이므로 false가 자연스러워!
                "message": "이미 가입된 학번입니다.",
                "data": { "errorCode": "DUPLICATE_USER" }
            });
        }

        // 닉네임 중복 검사 (필요시 형식 검사도 추가해야 함)
        const [nicknameRows] = await pool.query(
            'SELECT id FROM Users WHERE nickname = ?',
            [nickname]
        );
        if (nicknameRows.length > 0) {
            return res.status(409).json({
                "success": false,
                "message": "이미 가입된 닉네임입니다.",
                "data": { "errorCode": "DUPLICATE_USER" }
            });
        }

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

// 로그인
export const logIn = async (req, res, next) => {
    const { studentId, password } = req.body;

    // 입력값 누락 검사 (보류)
    /*
    if (!studentId || !password)
        return res.status(400).json({
            
        });
    */

    try {
        /* 1. **학번** 검사 */
        // DB에서 학번에 해당하는 사용자 정보 조회
        const [rows] = await pool.query(
            'SELECT id, student_id, password, nickname FROM Users WHERE student_id = ?',
            [studentId]);

        // 잘못된 학번 or 존재하지 않는 학번을 입력한 경우
        if (rows.length === 0)
            return res.status(401).json({
                "success": false,
                "message": "학번 또는 비밀번호가 일치하지 않습니다.",
                "data": {
                    "errorCode": "UNAUTHORIZED"
                }
            });

        const user = rows[0];   // 학번에 해당되는 정보(record)를 user에 저장.

        /* 2. **비밀번호** 검사 */
        // user.password는 암호화 되어있지만, 앞부분에 알고리즘 버전, 강도, Salt가 저장되어 있어 bycrypt.compare로 비교 가능!
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        // 잘못된 비밀번호를 입력한 경우
        if (!isPasswordMatch)
            return res.status(401).json({
                "success": false,
                "message": "학번 또는 비밀번호가 일치하지 않습니다.",
                "data": {
                    "errorCode": "UNAUTHORIZED"
                }
            });

        /* JWT 토큰 발급 */
        // sign 메소드의 첫 번째 인자. 누구나 열어볼 수 있으므로 민감한 정보(ex. 비밀번호)는 넣지 않는다.
        const payload = {
            userId: user.id,
            studentId: user.student_id
        };
        // sign 메소드의 두 번째 인자. 백엔드 서버만 알 수 있고, 이걸 이용해서 payload 값을 복잡하게 꼰다.
        const secretKey = 'YOUR_JWT_SECRET_KEY';
        // sign : Token 발급
        const accessToken = jwt.sign( payload, secretKey, { expiresIn: '1h' });

        // 로그인 성공
        res.status(200).json({
            "success": true,
            "message": "로그인에 성공했습니다.",
            "data": {
                "accessToken": accessToken,
                "userId": user.id,
                "nickname": user.nickname
            }
        });
    } catch (e) {
        next(e);
    }
}
import jwt from 'jsonwebtoken';

// 커스텀 에러 객체(HttpError)를 쓰고 있다면 import
// import { HttpError } from '../errors/HttpError.js'; 

export const authenticateToken = (req, res, next) => {
    // HTTP 요청 헤더로부터 순수 토큰 문자열(Authorization 값) 추출
    // 헤더 값은 보통 "Bearer eyJhbGci..." 형태로 오기 때문에 공백으로 쪼개서 토큰만 파싱
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 토큰이 아예 없는 경우 (401 Unauthorized)
    if (!token) {
        return res.status(401).json({
            "success": false,
            "message": "인증 토큰이 누락되었습니다. 로그인이 필요합니다.",
            "data": {
                "errorCode": "UNAUTHORIZED"
            }
        });
    }

    try {
        const secretKey = process.env.JWT_SECRET;
        if (!secretKey) {   // .env 파일 내 JWT_SECRET 누락 확인
            return res.status(500).json({
                "success": false,
                "message": "서버 인증 설정(JWT_SECRET)이 비어있습니다."
            });
        }

        // 토큰 검증 : 유효기간이 지났거나, secretKey가 안 맞으면 에러 throw
        const decoded = jwt.verify(token, secretKey);

        // 토큰 payload {userId,studentId}에 담아뒀던 유저 정보를 req(요청 객체)에 바인딩
        req.user = {
            id: decoded.userId,
            studentId: decoded.studentId
        };
        req.body.authorId = decoded.userId;

        // 검증 통과했으니 다음 컨트롤러 함수로 이동!
        next();

    } catch (e) {
        // 토큰은 들고 왔으나, 변조되었거나 유효기간이 만료된 경우
        return res.status(401).json({
            "success": false,
            "message": "유효하지 않거나 만료된 토큰입니다.",
            "data": { 
                "errorCode": "INVALID_TOKEN" 
            }
        });
    }
};
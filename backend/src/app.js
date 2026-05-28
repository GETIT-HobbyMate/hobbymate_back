import router from './routes/index.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 세팅
app.use(cors()); // 모든 도메인에서의 요청을 허용 (실무에서는 특정 도메인만 허용하도록 수정)
app.use(express.json()); // JSON 형태의 요청 Body를 파싱
app.use('/api', router);         // 라우터 연결

app.use('/', router);

// 테스트용 기본 라우트
app.get('/', (req, res) => {
  res.send('HobbyMate Backend Server is running!');
});

// 에러 핸들러: 모든 라우트 설정 뒤에 위치해야 함
app.use(errorHandler);

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
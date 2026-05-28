import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { loggingMiddleware } from './middlewares/loggingMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 세팅
app.use(cors());
app.use(express.json());
app.use(loggingMiddleware); // 가장 위에 등록해야 모든 요청을 빠짐없이 기록함
app.use('/api', router); // /api/* 로 시작하는 요청은 통합 라우터가 처리

// 테스트용 기본 라우트
app.get('/', (req, res) => {
  res.send('HobbyMate Backend Server is running!');
});

// 에러 핸들러: 반드시 모든 라우트 설정 뒤에 위치해야 함
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;

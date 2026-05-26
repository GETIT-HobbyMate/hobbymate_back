import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/index.js'; // 👈 통합 라우터가 잘 import 되었는지 확인!

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// ⭐ [가장 중요] 이 코드가 누락되었거나 오타가 있으면 404가 뜹니다!
// ==========================================
app.use('/api', router); 

// 테스트용 메인 주소
app.get('/', (req, res) => {
  res.send('HobbyMate Backend Server is running!');
});

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error("🔥 백엔드 전역 서버 에러 감지:", err);
  res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 세팅
app.use(cors()); // 모든 도메인에서의 요청을 허용 (실무에서는 특정 도메인만 허용하도록 수정)
app.use(express.json()); // JSON 형태의 요청 Body를 파싱

// 테스트용 기본 라우트
app.get('/', (req, res) => {
  res.send('HobbyMate Backend Server is running!');
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
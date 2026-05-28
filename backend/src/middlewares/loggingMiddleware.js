// 로깅 미들웨어
// 모든 요청이 들어올 때마다 자동으로 실행되어 콘솔에 요청/응답 정보를 기록함.
// app.js에서 가장 위에 등록해야 모든 요청을 빠짐없이 기록할 수 있음.
export function loggingMiddleware(req, res, next) {
  const start = Date.now(); // 요청이 들어온 시각 기록

  // res.on('finish') : 응답이 완전히 끝난 시점에 실행되는 이벤트
  // 응답이 끝나야 상태코드(res.statusCode)와 소요시간을 알 수 있기 때문에 여기서 로그를 찍음
  res.on('finish', () => {
    const duration = Date.now() - start; // 요청 ~ 응답 완료까지 걸린 시간 (ms)
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next(); // 다음 미들웨어(또는 라우터)로 넘김
}

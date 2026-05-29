// 에러 핸들러 : 이 함수가 json 형식으로 error를 return. 이 핸들러가 아니면
//             지저분하게 html 페이지 형태로 return
export function errorHandler(err, req, res, next) {
  console.error(err.stack); // console.log()와 약간 다른 형태로 경고해줌.
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(status).json({ error: message });
}

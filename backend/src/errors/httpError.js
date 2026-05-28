// Error 클래스는 message만 담을 수 있음. 이를 상속한 HttpError는
// message도 우리가 임의로 설정(기존 Error의 기능)할 뿐만 아니라
// 상태 코드도 우리가 설정(HttpError의 새 기능)할 수 있다.
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
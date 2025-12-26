/**
 * 커스텀 에러 클래스
 */

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message = '유효성 검사 실패') {
    super(message, 400)
  }
}

export class NotFoundError extends AppError {
  constructor(message = '리소스를 찾을 수 없습니다') {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '인증이 필요합니다') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '접근 권한이 없습니다') {
    super(message, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message = '이미 존재하는 리소스입니다') {
    super(message, 409)
  }
}


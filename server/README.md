# TaxChat Backend Server

Express.js 기반 백엔드 서버입니다.

## 프로젝트 구조

```
server/
├── config/          # 설정 파일 (데이터베이스, 초기화 등)
├── middleware/      # 미들웨어 (인증 등)
├── routes/          # API 라우트
├── utils/           # 유틸리티 함수 (로거, 에러 처리, 유효성 검사 등)
├── uploads/         # 업로드된 파일 저장 디렉토리
├── server.js        # 서버 진입점
├── package.json     # 의존성 및 스크립트
└── nodemon.json     # nodemon 설정
```

## 설치

```bash
npm install
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# 서버 포트
PORT=3001

# 환경 설정
NODE_ENV=development

# PostgreSQL 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxchat
DB_USER=postgres
DB_PASSWORD=postgres

# JWT 시크릿 키 (프로덕션에서는 반드시 변경하세요)
JWT_SECRET=your-secret-key-change-in-production

# 파일 업로드 디렉토리
UPLOAD_DIR=./uploads

# CORS 설정 (필요시)
CORS_ORIGIN=http://localhost:5173
```

## 데이터베이스 설정

1. PostgreSQL이 설치되어 있어야 합니다.
2. 데이터베이스를 생성합니다:

```bash
psql -U postgres
CREATE DATABASE taxchat;
\q
```

3. 서버를 실행하면 자동으로 테이블이 생성됩니다.

## 실행

### 개발 모드 (자동 재시작)
```bash
npm run dev
```
nodemon을 사용하여 파일 변경 시 자동으로 서버가 재시작됩니다.

### 프로덕션 모드
```bash
npm start
```

서버는 기본적으로 `http://localhost:3001`에서 실행됩니다.

## 주요 기능

### 미들웨어
- **CORS**: Cross-Origin Resource Sharing 지원
- **Body Parser**: JSON 및 URL-encoded 요청 파싱
- **요청 로깅**: 개발 환경에서 요청 로그 출력
- **에러 핸들링**: 통합 에러 처리 미들웨어

### 유틸리티
- **logger.js**: 구조화된 로깅 유틸리티
- **errors.js**: 커스텀 에러 클래스
- **validators.js**: 유효성 검사 함수

### 에러 처리
서버는 다음 커스텀 에러를 지원합니다:
- `ValidationError` (400): 유효성 검사 실패
- `UnauthorizedError` (401): 인증 필요
- `ForbiddenError` (403): 접근 권한 없음
- `NotFoundError` (404): 리소스를 찾을 수 없음
- `ConflictError` (409): 이미 존재하는 리소스
- `AppError` (500): 일반 서버 오류

## API 엔드포인트

### 헬스 체크
- `GET /api/health` - 서버 상태 확인

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/signup` - 회원가입

### 회원 관리
- `GET /api/members` - 회원 목록 조회
- `POST /api/members` - 회원 등록
- `PUT /api/members/:id` - 회원 정보 수정
- `DELETE /api/members/:id` - 회원 삭제
- `GET /api/members/:id/memos` - 메모 조회
- `POST /api/members/:id/memos` - 메모 추가
- `DELETE /api/members/:id/memos/:memoId` - 메모 삭제

### 상품 관리
- `GET /api/products/categories` - 상품 카테고리 조회
- `POST /api/products/categories` - 상품 카테고리 등록
- `PUT /api/products/categories/:id` - 상품 카테고리 수정
- `PATCH /api/products/categories/:id/display` - 진열 상태 변경
- `GET /api/products` - 상품 조회
- `POST /api/products` - 상품 등록
- `PATCH /api/products/:id/display` - 진열 상태 변경

### 주문 관리
- `GET /api/orders` - 주문 조회
- `POST /api/orders` - 주문 생성
- `PATCH /api/orders/:id/status` - 주문 상태 변경

### 서류 관리
- `GET /api/documents/categories` - 서류 카테고리 조회
- `POST /api/documents/categories` - 서류 카테고리 등록
- `GET /api/documents` - 서류 조회
- `POST /api/documents` - 서류 등록
- `GET /api/documents/member/:memberId` - 회원 서류 조회
- `POST /api/documents/member/:memberId/upload` - 서류 업로드
- `GET /api/documents/member/:memberId/:documentId/download` - 서류 다운로드
- `DELETE /api/documents/member/:memberId/:documentId` - 서류 삭제

## 파일 업로드

업로드된 파일은 `uploads/` 디렉토리에 저장됩니다. 이 디렉토리는 자동으로 생성됩니다.

## 인증

대부분의 API 엔드포인트는 JWT 토큰 인증이 필요합니다. 요청 헤더에 다음을 포함하세요:

```
Authorization: Bearer <token>
```

로그인 또는 회원가입 시 받은 토큰을 사용하세요.


# TaxChat Backend Server

## 설치

```bash
npm install
```

## 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 데이터베이스 정보를 입력하세요:

```bash
cp .env.example .env
```

`.env` 파일 내용:
```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxchat
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-secret-key-change-in-production
UPLOAD_DIR=./uploads
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

### 프로덕션 모드
```bash
npm start
```

서버는 기본적으로 `http://localhost:3001`에서 실행됩니다.

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


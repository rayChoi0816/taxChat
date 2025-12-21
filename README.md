# TaxChat - 세무사 전문 서비스 앱

세금 신고 결제, 서류 관리, SMS 알림 기능을 제공하는 풀스택 웹 애플리케이션입니다.

## 기술 스택

- **프론트엔드**: React, Vite
- **백엔드**: Node.js, Express
- **데이터베이스**: PostgreSQL

## 프로젝트 구조

```
taxChat/
├── ui/              # 프론트엔드 (React)
├── server/           # 백엔드 (Node.js + Express)
└── docs/             # 문서
```

## 설치 및 실행

### 1. 데이터베이스 설정

PostgreSQL을 설치하고 데이터베이스를 생성합니다:

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE taxchat;

# 종료
\q
```

### 2. 백엔드 서버 설정

```bash
# server 디렉토리로 이동
cd server

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 데이터베이스 정보 수정

# 서버 실행
npm start
# 또는 개발 모드 (자동 재시작)
npm run dev
```

서버는 기본적으로 `http://localhost:3001`에서 실행됩니다.

### 3. 프론트엔드 설정

```bash
# ui 디렉토리로 이동
cd ui

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

프론트엔드는 기본적으로 `http://localhost:5173`에서 실행됩니다.

## 환경 변수

### 백엔드 (.env)

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

### 프론트엔드 (.env)

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## API 엔드포인트

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

## 주요 기능

### 사용자 페이지
- 로그인/회원가입
- 상품 카테고리 및 상품 선택
- 결제 처리
- 서류 업로드 및 관리
- 서비스 이용 내역 조회
- 마이 페이지

### 관리자 페이지
- 고객 관리
- 상품 관리
- 상품 카테고리 관리
- 주문 결제 관리
- 첨부 서류 관리
- SMS 관리

## 개발 가이드

### 데이터베이스 초기화

서버를 처음 실행하면 자동으로 테이블이 생성됩니다. 수동으로 초기화하려면:

```javascript
// server/config/initDatabase.js를 직접 실행
```

### 빌드

프론트엔드 빌드:
```bash
cd ui
npm run build
```

빌드된 파일은 `ui/dist` 디렉토리에 생성됩니다.

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.


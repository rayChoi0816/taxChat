# 서버 실행 가이드

## 설정 완료 사항

1. ✅ 서버 인증 우회 설정 (개발 모드)
2. ✅ 관리자 페이지 페이지네이션 옵션 확장 (최대 1000건)
3. ✅ DB 연결 설정

## 서버 실행 방법

### 방법 1: 스크립트 사용

```bash
cd /Users/ray/byray/vsc/taxChat
bash start-servers.sh
```

### 방법 2: 수동 실행

**터미널 1 - 백엔드 서버:**
```bash
cd /Users/ray/byray/vsc/taxChat/server
NODE_ENV=development SKIP_AUTH=true npm run dev
```

**터미널 2 - 프론트엔드 서버:**
```bash
cd /Users/ray/byray/vsc/taxChat/ui
npm run dev
```

## 접속 주소

- **프론트엔드 (사용자 페이지)**: http://localhost:5173
- **프론트엔드 (관리자 페이지)**: http://localhost:5173/admin/customer
- **백엔드 API**: http://localhost:3001/api
- **헬스 체크**: http://localhost:3001/api/health

## 관리자 페이지 경로

- 고객 관리: http://localhost:5173/admin/customer
- 상품 관리: http://localhost:5173/admin/product
- 주문 결제 관리: http://localhost:5173/admin/payment
- 첨부 서류 관리: http://localhost:5173/admin/document
- SMS 관리: http://localhost:5173/admin/sms
- 상품 카테고리: http://localhost:5173/admin/product-category

## 사용자 페이지 경로

- 홈페이지: http://localhost:5173/
- 로그인: http://localhost:5173/login
- 결제하기: http://localhost:5173/payment (로그인 필요)
- 내 서류 관리: http://localhost:5173/document-storage (로그인 필요)
- 마이페이지: http://localhost:5173/mypage (로그인 필요)

## 데이터베이스 설정

현재 설정된 DB 정보:
- Host: localhost
- Port: 5432
- Database: taxchat
- User: postgres
- Password: postgres

환경 변수 파일(.env)을 생성하여 설정을 변경할 수 있습니다:
```
NODE_ENV=development
SKIP_AUTH=true
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxchat
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
```

## 주의사항

1. **개발 모드에서만 인증이 우회됩니다** (NODE_ENV=development, SKIP_AUTH=true)
2. 프로덕션 환경에서는 반드시 인증을 활성화해야 합니다
3. PostgreSQL 데이터베이스가 실행 중이어야 합니다
4. 서버를 재시작하면 변경사항이 적용됩니다


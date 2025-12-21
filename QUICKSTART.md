# 빠른 시작 가이드

## 1. 데이터베이스 설정

PostgreSQL이 설치되어 있어야 합니다.

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE taxchat;

# 종료
\q
```

## 2. 백엔드 서버 실행

### 방법 1: 스크립트 사용
```bash
./start-server.sh
```

### 방법 2: 수동 실행
```bash
cd server
npm install
cp .env.example .env
# .env 파일을 열어 데이터베이스 정보 수정
npm start
```

서버는 `http://localhost:3001`에서 실행됩니다.

## 3. 프론트엔드 실행

새 터미널에서:
```bash
cd ui
npm install
npm run dev
```

프론트엔드는 `http://localhost:5173`에서 실행됩니다.

## 4. 접속

- **사용자 페이지**: http://localhost:5173
- **관리자 페이지**: http://localhost:5173/admin/customer

## 주요 기능 테스트

### 사용자 페이지
1. 로그인: 휴대폰 번호로 로그인 (자동 회원가입)
2. 결제하기: 상품 카테고리 선택 → 상품 선택
3. 마이 페이지: 회원 정보 확인

### 관리자 페이지
1. 고객 관리: 회원 목록 조회, 등록, 수정, 삭제
2. 메모 관리: 회원별 메모 추가/삭제

## 문제 해결

### 데이터베이스 연결 오류
- `.env` 파일의 데이터베이스 정보 확인
- PostgreSQL 서비스가 실행 중인지 확인

### 포트 충돌
- 서버 포트(3001) 또는 프론트엔드 포트(5173)가 사용 중인 경우 변경

### API 호출 오류
- 서버가 실행 중인지 확인
- 브라우저 콘솔에서 오류 메시지 확인


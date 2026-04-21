# DB 연결 및 데이터 출력 문제 해결 가이드

## 현재 상황
- 서버는 실행 중입니다 (포트 3001)
- API 호출 시 "회원 조회 중 오류가 발생했습니다" 에러 발생
- DB 연결 문제로 추정됨

## 해결 방법

### 1. 서버 재시작 (필수)

서버 코드 변경사항을 적용하려면 **서버를 재시작**해야 합니다.

#### 방법 A: 스크립트 사용
```bash
# 기존 서버 프로세스 종료 후
cd /Users/ray/byray/vsc/taxChat
bash start-servers.sh
```

#### 방법 B: 수동 재시작

**터미널 1 - 기존 서버 종료 후 재시작:**
```bash
# 실행 중인 서버 종료 (Ctrl+C 또는 프로세스 종료)
cd /Users/ray/byray/vsc/taxChat/server
NODE_ENV=development SKIP_AUTH=true PORT=3001 DB_HOST=localhost DB_PORT=5432 DB_NAME=taxchat DB_USER=postgres DB_PASSWORD=postgres CORS_ORIGIN=http://localhost:5173 npm run dev
```

**터미널 2 - 프론트엔드:**
```bash
cd /Users/ray/byray/vsc/taxChat/ui
npm run dev
```

### 2. PostgreSQL 데이터베이스 확인

#### DB 서비스 실행 확인
```bash
# macOS
brew services list | grep postgresql
# 또는
pg_isready
```

#### DB 서비스 시작 (실행 중이 아닌 경우)
```bash
# macOS (Homebrew)
brew services start postgresql@14
# 또는
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

#### DB 연결 테스트
```bash
psql -h localhost -p 5432 -U postgres -d taxchat
```

#### 테이블 확인
```sql
-- DB에 연결 후
\dt  -- 테이블 목록 확인
SELECT COUNT(*) FROM members;  -- 회원 수 확인
```

### 3. 환경 변수 확인

서버 디렉토리에 `.env` 파일이 있다면 다음 내용을 확인:
```
NODE_ENV=development
SKIP_AUTH=true
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxchat
DB_USER=postgres
DB_PASSWORD=postgres
CORS_ORIGIN=http://localhost:5173
```

### 4. 수정된 사항

1. ✅ DB 연결 에러 로깅 개선
2. ✅ API 응답 에러 상세 정보 추가
3. ✅ 프론트엔드 에러 메시지 표시 개선
4. ✅ 서버 시작 스크립트에 환경 변수 설정 추가

### 5. 확인 사항

서버 재시작 후 다음을 확인:

1. **서버 로그 확인**
   - "데이터베이스 연결 성공" 메시지 확인
   - DB 연결 실패 시 에러 메시지 확인

2. **API 테스트**
   ```bash
   curl http://localhost:3001/api/health
   curl "http://localhost:3001/api/members?page=1&limit=5"
   ```

3. **브라우저 콘솔 확인**
   - 개발자 도구 (F12) → Console 탭
   - "회원 목록 API 응답" 로그 확인
   - 에러 메시지 확인

4. **관리자 페이지 접속**
   - http://localhost:5173/admin/customer
   - 데이터가 표시되는지 확인

### 6. 여전히 문제가 발생하는 경우

1. **DB 비밀번호 확인**
   - `DB_PASSWORD` 환경 변수가 실제 PostgreSQL 비밀번호와 일치하는지 확인

2. **DB 존재 여부 확인**
   ```sql
   -- PostgreSQL에 연결 후
   \l  -- 데이터베이스 목록 확인
   CREATE DATABASE taxchat;  -- 없으면 생성
   ```

3. **테이블 초기화**
   ```bash
   cd /Users/ray/byray/vsc/taxChat/server
   node -e "import('./config/initDatabase.js').then(m => m.default())"
   ```

### 7. 지원

문제가 계속되면 다음 정보를 확인:
- 서버 콘솔 로그
- 브라우저 콘솔 로그
- PostgreSQL 로그


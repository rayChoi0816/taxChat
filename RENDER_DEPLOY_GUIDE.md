# 🚀 Render 배포 가이드 (초등학생도 따라할 수 있어요!)

이 문서를 따라하면 우리 taxChat 사이트를 인터넷에 올릴 수 있어요.
**서버(백엔드)** 와 **화면(프론트)** 두 개를 만들 거예요. 마치 레고 두 개를 끼우는 거랑 똑같아요.

---

## 🍰 전체 그림 (이게 머릿속에 있어야 해요)

```
┌────────────────────────────────────────────────┐
│  내 컴퓨터 (코드 작성)                          │
│        ↓ git push                              │
│  GitHub (코드 저장 창고)                        │
│        ↓ 자동으로 가져감                         │
│  Render (인터넷에 띄워주는 곳)                  │
│    ├─ taxchat-api   ← 서버 (계산하는 두뇌)      │
│    └─ taxchat-ui    ← 화면 (사용자가 보는 것)   │
└────────────────────────────────────────────────┘
```

토스페이먼츠 결제 흐름:
```
사용자 → [결제하기] 버튼 → 토스 결제창 → 카드 결제
                                            ↓
                            우리 서버(시크릿 키) → 토스에 "이거 결제 진짜 맞아요?" 확인
                                            ↓
                                         결제 완료!
```

---

## 1단계: GitHub 에 코드 올리기 ✅ (이미 되어있다면 건너뛰기)

이미 GitHub 에 코드가 있다면 패스. 없다면 평소처럼 `git push` 로 올려주세요.

```bash
git add .
git commit -m "토스페이먼츠 연동"
git push
```

> ⚠️ **중요**: `server/.env` 파일과 `ui/.env` 파일은 절대 GitHub 에 올리면 안 돼요! (`.gitignore` 에 이미 들어있는지 확인하세요)

---

## 2단계: Render 회원가입 / 로그인

1. https://render.com 접속
2. **Sign up** 또는 GitHub 계정으로 로그인 (강추!)
3. GitHub 권한 허용 → Render 가 내 저장소를 볼 수 있게 됨

---

## 3단계: Blueprint 로 한 방에 두 서비스 만들기 🎉

이 프로젝트에는 이미 `render.yaml` 이라는 "설계도" 파일이 있어요. Render 가 이걸 보고 알아서 두 개 만들어 줍니다.

1. Render Dashboard 에서 우측 상단 **New +** 클릭
2. **Blueprint** 선택
3. 내 GitHub 저장소 `taxChat` 선택 → **Connect**
4. Render 가 `render.yaml` 을 자동으로 읽고 두 개 서비스를 만들 준비를 함
   - `taxchat-api` (서버)
   - `taxchat-ui` (화면)
5. **Apply** 버튼을 누르기 전에, **환경변수(Environment Variables)** 를 입력하라고 할 거예요.

---

## 4단계: 환경변수 입력 (가장 중요해요!) 🔑

환경변수는 "비밀번호 같은 값"이라고 생각하면 돼요. 코드에 직접 적으면 위험하니까 따로 보관하는 거예요.

### 📦 `taxchat-api` (서버) 환경변수

| 변수 이름 | 무엇을 적을까? | 예시 |
|---|---|---|
| `DB_HOST` | 데이터베이스 주소 | `dpg-d7jngphf9bms73805n10-a.oregon-postgres.render.com` |
| `DB_PORT` | 데이터베이스 포트 | `5432` |
| `DB_NAME` | 데이터베이스 이름 | `taxchat` |
| `DB_USER` | 데이터베이스 아이디 | `taxchat_user` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | (실제 비밀번호) |
| `DB_SSL` | SSL 사용 여부 | `true` |
| `JWT_SECRET` | 로그인 토큰용 비밀키 | (Render가 자동 생성, 그대로 둬도 됨) |
| `CORS_ORIGIN` | 어느 사이트가 우리 서버에 접속 가능한지 | `https://taxchat-ui.onrender.com,http://localhost:5173` |
| **`TOSS_CLIENT_KEY`** | **토스 테스트 클라이언트 키** | **`test_ck_D5GePWvyJnrKnyd0NWJoq8Bcaeke`** |
| **`TOSS_SECRET_KEY`** | **토스 테스트 시크릿 키 (💥 절대 비밀!)** | **`test_sk_D5GePWvyJnrKnyd0NWJoq8Bcaeke`** |
| `PPURIO_ACCOUNT` | 뿌리오 계정 (문자) | `tax5wol` |
| `PPURIO_API_KEY` | 뿌리오 API 키 | (실제 키) |
| `PPURIO_FROM` | 발신 전화번호 | `01021637610` |
| `PPURIO_KAKAO_SENDER_KEY` | 카카오 발신프로필 | `@세무회계오월` |
| `PPURIO_SIGNUP_ALIMTALK_TEMPLATE_CODE` | 알림톡 템플릿 코드 | `ppur_2026...` |
| `ADMIN_NOTIFY_PHONE` | 관리자 알림 전화번호 | `01088810816,01021637610` |

### 🎨 `taxchat-ui` (화면) 환경변수

| 변수 이름 | 무엇을 적을까? | 예시 |
|---|---|---|
| `VITE_API_BASE_URL` | 서버 주소 + `/api` | `https://taxchat-api.onrender.com/api` |
| **`VITE_TOSS_CLIENT_KEY`** | **토스 테스트 클라이언트 키** | **`test_ck_D5GePWvyJnrKnyd0NWJoq8Bcaeke`** |

> 💡 `VITE_` 로 시작하는 변수만 브라우저에서 사용할 수 있어요. **시크릿 키는 절대 `VITE_` 로 시작하게 만들면 안 돼요!**

---

## 5단계: 배포 시작! 🟢

환경변수 다 채웠으면 **Apply** 클릭.

Render 가 알아서:
1. GitHub 에서 코드 다운로드
2. `npm install` 실행
3. 서버는 `npm start`, 프론트는 `npm run build` 실행
4. 인터넷에 띄워줌

⏱️ 처음엔 5~10분 정도 걸려요. 커피 한 잔 마시고 오세요 ☕

---

## 6단계: 주소 확인

배포가 끝나면 이런 주소가 생겨요:
- 서버: `https://taxchat-api.onrender.com`
- 화면: `https://taxchat-ui.onrender.com`

> 🔎 서버가 잘 살아있는지 확인하려면 브라우저로 `https://taxchat-api.onrender.com/api/health` 들어가서 `{"status":"ok"...}` 가 보이면 성공!

---

## 7단계: 두 서비스 서로 알려주기 (한 번만 더!) 🔁

처음 배포가 끝나면 진짜 주소가 정해지니까, 환경변수를 한 번 더 맞춰줘야 해요.

### `taxchat-api` 환경변수 다시 확인
- `CORS_ORIGIN` → 실제 프론트 주소 넣기
  ```
  https://taxchat-ui.onrender.com,http://localhost:5173
  ```

### `taxchat-ui` 환경변수 다시 확인
- `VITE_API_BASE_URL` → 실제 서버 주소 넣기
  ```
  https://taxchat-api.onrender.com/api
  ```

⚠️ **프론트 환경변수를 바꿨으면 `Manual Deploy → Deploy latest commit` 을 눌러 다시 빌드해야 적용돼요.** (Vite 는 빌드할 때 환경변수를 코드에 박아넣기 때문)

---

## 8단계: 토스페이먼츠 콘솔에서 도메인 등록 🌐

마지막! 토스에 "이 사이트에서 결제 쓸게요" 라고 알려줘야 해요.

1. https://app.tosspayments.com 로그인
2. **개발자센터 → 테스트 키** 메뉴
3. **허용 도메인** 에 다음을 추가:
   ```
   http://localhost:5173
   https://taxchat-ui.onrender.com
   ```

---

## 🧪 결제 테스트 해보기

1. `https://taxchat-ui.onrender.com` 접속
2. 로그인 → 결제하기 → 상품 선택 → 결제하기 버튼
3. 토스 결제창이 뜨면 **테스트 카드** 입력:
   - 카드번호: `4330-1234-1234-1234`
   - 유효기간/CVC: 아무 값
   - 비밀번호 앞 2자리: 아무 값
4. `/payment/success` 페이지에서 "결제가 완료되었습니다." 보이면 ✅

---

## 😵 자주 막히는 곳 (트러블슈팅)

### ❌ "CORS 차단: https://..." 에러
→ `CORS_ORIGIN` 에 프론트 주소가 빠져있어요. 콤마(`,`)로 구분해서 추가하고 서버 재배포.

### ❌ 결제창에서 "허용되지 않은 도메인" 에러
→ 토스 콘솔 **허용 도메인** 에 Render 프론트 주소를 안 넣었어요. (위 8단계 참고)

### ❌ "Toss 클라이언트 키가 설정되어 있지 않습니다"
→ `VITE_TOSS_CLIENT_KEY` 가 비어있어요. 프론트 환경변수에 넣고 **재배포**.

### ❌ 결제 승인 실패 "TOSS_SECRET_KEY 가 설정되어 있지 않습니다"
→ 서버 환경변수에 `TOSS_SECRET_KEY` 가 빠져있어요.

### ❌ 무료 플랜 서버가 자꾸 잠들어요
→ Render 무료 플랜은 15분 동안 요청이 없으면 잠들어요(콜드 스타트). 깨우려면 다시 접속하면 1분 이내에 깨어나요. 결제 테스트 직전에 한번 깨워두면 좋아요.

---

## 📝 한눈에 정리 (요약)

1. GitHub 에 코드 푸시
2. Render → New → Blueprint → 저장소 선택
3. 환경변수 채우기 (위 표 참고)
4. **Apply** 클릭
5. 배포 끝나면 실제 주소로 `CORS_ORIGIN`, `VITE_API_BASE_URL` 다시 맞추기
6. 토스 콘솔에 Render 프론트 주소 등록
7. 결제 테스트 🎉

끝!

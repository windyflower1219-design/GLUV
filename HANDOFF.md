# GLUV 프로젝트 인수인계 문서

> **새 Claude 계정/세션에서 이 프로젝트를 이어받을 때 가장 먼저 읽는 문서.**
> 최근 갱신: 2026-04-19

---

## 1. 프로젝트 개요

**GLUV** — 한국인 대상 혈당/식단 통합 기록 Next.js 앱. 음성으로 "식후 혈당 125 나왔어" 같이 말하면 자동 파싱해서 Firestore에 저장하고, 대시보드에서 추이를 본다.

- 저장소: https://github.com/windyflower1219-design/GLUV
- 로컬 경로(예): `C:\Users\USER\Desktop\second project\healthcare app`
- 소유자: windyflower1219@gmail.com (최동혁)
- 사용자 커뮤니케이션 선호: **예시를 들어 설명하면 이해가 빠름**

## 2. 기술 스택

- Next.js 15+ (App Router) + TypeScript
- Firebase Auth + Firestore
- Google Gemini API (`gemini-2.0-flash`) — 음성 파싱
- 공공데이터포털 전국통합식품영양성분 API — 영양정보 enrich
- Web Speech API — 브라우저 음성 인식

## 3. 꼭 읽어야 하는 기존 문서들

이 HANDOFF.md 다음으로 이 순서로 읽으면 된다:

1. `README.md` — 프로젝트 소개
2. `BACKEND.md` — 서버/Firestore 구조
3. `FRONTEND.md` — 페이지/컴포넌트 맵
4. `METHODOLOGY.md` — 설계 원칙
5. `USER_TEST_SCENARIOS.md` — 수동 테스트 시나리오

## 4. 환경 변수 (.env.local)

`.env.local` 은 gitignore 되어있어서 **GitHub에 없음.** PC 에만 존재.
새 환경이면 아래 키들을 수동으로 넣어야 한다:

- `NEXT_PUBLIC_FIREBASE_*` (6개) — Firebase 콘솔에서 복사
- `GEMINI_API_KEY` + `NEXT_PUBLIC_GEMINI_API_KEY` — aistudio.google.com 발급
- `FOOD_API_BASE_URL` = `https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api`
- `FOOD_API_KEY` — 공공데이터포털 "전국통합식품영양성분정보표준데이터" 신청

키 유효기간(2026-04-18 ~ 2028-04-18) 안에만 쓰면 됨.

## 5. 최근 주요 의사결정 (시간순)

### 2026-04-19 음성 혈당 입력 안 되던 버그 수정
- **원인**: `src/lib/hooks/useUnifiedStorage.ts` 의 `saveMeal`/`saveGlucose` 콜백이 `useCallback(fn, [])` 으로 빈 의존성 배열이었음. 로그인 전 `userId='guest'` 가 클로저에 고정돼서, 로그인 후에도 `'guest'` 로 저장되는 stale closure 버그.
- **수정**: 의존성 배열을 `[userId]` 로 변경.
- **검증**: `test_closure.mjs` 로 시뮬레이션해 재현→수정 확인 완료.

### 2026-04-19 로컬 폴백 파서 개선 (`src/lib/algorithms/mealParser.ts` 155줄)
- **이전 regex**: `/혈당\s*(\d{2,3})/` — "혈당이 140", "혈당 수치가 110" 매칭 실패.
- **현재 regex**: `/혈당[은이가는의]?\s*(?:수치[가는은이]?\s*)?(\d{2,3})/` — 한국어 조사와 "수치" 중간어 처리.
- 측정타입에 `postmeal_30m` 추가, 띄어쓰기 없는 `식후2시간` 등도 인식.
- 14개 테스트 케이스 전부 통과 (`test_local_parser.mjs`).

### 2026-04-19 debug-env 프로덕션 노출 방지
- `src/app/api/debug-env/route.ts` 에 `NODE_ENV !== 'development'` 이면 404 반환.
- 이유: API 키 존재 여부 정보가 프로덕션 URL 로 노출되면 공격 벡터.

### 2026-04-19 공공데이터 API 연동 검증
- `scripts/test-food-api.mjs` 로 8개 음식 테스트.
- 결과: 4/8 이 DB 매칭 (사과/바나나/우유/김치), 4/8 은 `resultCode=03 NODATA_ERROR` (쌀밥/닭가슴살/고구마/계란 — DB에 없음, Gemini 폴백으로 커버).
- `resultCode=03` 은 "키 문제" 가 아니라 "그 이름으로 매칭 안 됨" 이라는 뜻. 키는 정상 활성화됨.

## 6. 알려진 개선 여지

- [ ] `parse-meal/route.ts` 에서 `foodNm` 매칭률을 올리기 위해 변형 이름 시도 (예: "고구마" 실패 → "고구마,생것" 재시도)
- [ ] 공공데이터 API 가 정확 매칭인지 LIKE 매칭인지 파라미터 확인
- [ ] Windows PowerShell 5.1 은 BOM 없는 UTF-8 을 cp949 로 읽어서 한국어 깨짐. autopush.ps1 은 영어로만 작성됨. 다른 ps1 만들 때 주의.

## 7. 샌드박스 제약 (새 Claude가 알아야 할 것)

코웍 샌드박스에서는 다음이 **전부 차단**된다:
- `api.data.go.kr` — 공공데이터 API 직접 호출 불가 → 테스트는 사용자 PC 에서 `node scripts/test-food-api.mjs` 실행 요청
- `generativelanguage.googleapis.com` — Gemini 직접 호출 불가
- npm 레지스트리 — `npm install` 실패 (EAI_AGAIN)
- `.git/` 내부 파일 삭제 (bindfs FUSE) — git lock 파일은 사용자가 직접 제거해야 함

**따라서 빌드·실제 API 호출·git push 는 전부 사용자 PC 에서 `autopush.ps1` 등으로 수행해야 한다.** 샌드박스에서는 코드 편집·정적 분석·로컬 시뮬레이션 테스트까지만 가능.

## 8. Git 워크플로우

PC PowerShell 에서 GLUV 폴더 열고:
```powershell
.\autopush.ps1 "커밋 메시지"
```

autopush.ps1 이 하는 일: 오래된 `.git/index.lock` 제거 → `git add -A` → `git commit -m $Message` → `git push origin main`.
Korean 메시지는 파라미터로 받으면 OK (스크립트 본체는 영어만).

## 9. 다음 Claude 가 바로 시작할 수 있는 체크리스트

1. 사용자에게 "어떤 작업을 이어서 하고 싶으신지" 물어보기
2. `BACKEND.md` + `FRONTEND.md` 로 전체 구조 파악
3. `git log --oneline -20` 으로 최근 커밋 확인
4. 사용자 PC 환경이므로 실제 테스트는 사용자에게 `npm run dev` 또는 `node scripts/test-food-api.mjs` 실행 요청

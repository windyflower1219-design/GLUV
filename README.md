# 🏥 GLUV (혈당 비서) - AI 음성 통합 혈당 & 식단 관리

아내분을 위한 세상에서 가장 다정하고 똑똑한 혈당 관리 비서, **GLUV**입니다.  
복잡한 수치 입력 대신, 대화하듯 편안하게 말씀만 하세요. AI가 식단과 혈당을 한 번에 기록해 드립니다.

---

## ✨ 주요 핵심 기능

### 1. 🎤 통합 음성 비서 (Unified Voice Assistant)
- **한 문장으로 기록**: "비빔밥 먹고 혈당 120 나왔어" 라고 말씀하시면 식단과 혈당을 동시에 인식합니다.
- **연속 인식 모드**: 말씀 도중 끊기지 않도록 충분히 기다려주는 아내분 맞춤형 음성 엔진.
- **Gemini 1.5 Flash**: 최신 AI가 식재료의 영양 성분과 혈당 측정 시점(공복/식후 등)을 정밀 분석합니다.
- **수동 종료 및 확인**: 말씀이 끝나면 [인식 완료] 버튼으로 즉시 분석 가능하며, 결과 카드를 직접 수정할 수도 있습니다.

### 2. 🎨 따뜻한 라이트 테마 (Warm Light UI)
- **감성적인 디자인**: 아내분의 눈이 편안하도록 부드러운 아이보리와 파스텔 톤으로 구성된 따스한 UI.
- **모바일 최적화**: 한 손으로 조작하기 쉬운 버튼 배치와 부드러운 애니메이션.

### 3. 📊 정밀 데이터 리포트
- **혈당 추이**: 일/주/월별 혈당 흐름을 한눈에 파악하는 고해상도 인터랙티브 차트.
- **영양 요약**: 오늘 먹은 칼로리와 탄수화물을 직관적으로 확인.
- **Glucotype 분석**: 혈당 반응을 Green(안전) / Yellow(주의) / Red(위험)로 시각화.

### 4. 📱 PWA 지원 (홈 화면에 설치)
- 앱스토어 설치 없이 브라우저에서 '홈 화면에 추가'하여 앱처럼 사용할 수 있습니다.

---

## 🛠️ 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Vanilla CSS + Tailwind (Custom Warm Palette)
- **AI**: Google Gemini 1.5 Flash API
- **Backend**: Firebase Firestore (Real-time Database)
- **Voice Engine**: Web Speech API (Continuous Recognition)
- **Charts**: Recharts (Custom Styled)

---

## ⚙️ 환경변수 설정 (.env.local)

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 키를 입력하세요:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# AI Configuration
NEXT_PUBLIC_GEMINI_API_KEY=...
```

---

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

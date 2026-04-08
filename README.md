# 🏥 GLUV (혈당 비서) - AI 통합 건강 관리 파트너

당신을 위한 세상에서 가장 다정하고 똑똑한 스마트 건강 비서, **GLUV**입니다.  
복잡한 수치 입력 대신, 대화하듯 편안하게 말씀만 하세요. AI가 식단과 혈당을 한 번에 기록하고 개인화된 인사이트를 제공해 드립니다.

---

## ✨ 주요 핵심 기능

### 1. 🎤 통합 음성 비서 (Unified Voice Assistant)
- **한 문장으로 기록**: "비빔밥 먹고 혈당 120 나왔어" 라고 말씀하시면 식단과 혈당을 동시에 인식합니다.
- **연속 인식 모드**: 말씀 도중 끊기지 않도록 충분히 기다려주는 맞춤형 음성 엔진.
- **OpenAI ChatGPT-4o-mini**: 음성을 분석해 메뉴, 수량, 칼로리, 탄수화물을 정밀하게 타겟팅하여 JSON으로 추출합니다.
- **수동 종료 및 시간 수정**: [인식 완료] 버튼으로 즉시 분석이 가능하며, 기록된 시간(`datetime-local`)과 과거 수치를 자유롭게 수정할 수 있습니다.

### 2. 🎨 따뜻한 라이트 테마 (Warm Light UI)
- **감성적인 디자인**: 튀지 않고 편안한 아이보리와 파스텔 톤 핑크, 코랄로 구성된 따뜻한 UI.
- **모바일 최적화**: 한 손으로 조작하기 쉬운 버튼 배치와 부드러운 애니메이션을 제공합니다.

### 3. 📊 정밀 데이터 리포트 & 맞춤 인사이트
- **현장감 있는 대시보드**: 일/주/월별 혈당 흐름과 오늘 먹은 음식 정보를 깔끔하게 조합합니다.
- **개인별 데이터 격리**: Firebase Auth를 통해 로그인한 데이터는 타인과 절대 섞이지 않는 나만의 건강 수첩이 됩니다.
- **Google Gemini 인사이트**: 나의 며칠간 활동과 혈당 흐름을 파악하여 마치 헬스 트레이너처럼 실시간 조언 및 피드백 카드를 발행합니다.

### 4. 📱 PWA 지원 (홈 화면에 설치)
- 앱스토어 설치 없이 브라우저에서 '홈 화면에 추가'하여 앱처럼 사용할 수 있습니다.

---

## 🛠️ 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Vanilla CSS + Tailwind (Custom Warm Palette)
- **AI (Hybrid)**: OpenAI API (Parser 기능 담당), Google Gemini 1.5 Flash (Insight 기능 담당)
- **Backend**: Firebase Firestore & Firebase Authentication
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

# Hybrid AI Configuration
NEXT_PUBLIC_GEMINI_API_KEY=...
NEXT_PUBLIC_OPENAI_API_KEY=...
```

---

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

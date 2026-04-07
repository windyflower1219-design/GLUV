# 🏥 GLUV - AI 음성 식단 & 혈당 관리

## 환경변수 설정 (.env.local 파일 생성)

아래 내용을 `.env.local` 파일로 복사하고 실제 값을 입력하세요:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000

NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_pro_api_key
```

> API 키 없이도 데모 데이터로 앱이 동작합니다.

## 실행 방법

```bash
npm run dev
```

## 기술 스택

- **Frontend**: Next.js 15 App Router + TypeScript
- **Styling**: Tailwind CSS (glassmorphism 다크 테마)
- **AI**: Google Gemini Pro API
- **DB**: Firebase Firestore
- **Auth**: Firebase Auth
- **음성**: Web Speech API (STT, 한국어)
- **차트**: Recharts
- **아이콘**: Lucide React

## 주요 기능

1. 🎤 음성 식단 기록 (한국어 STT)
2. 📊 혈당 추이 차트 (일/주/월별)
3. 🧠 AI 인사이트 & Actionable Insight
4. 🔴 Glucotype 분석 (Green/Yellow/Red)
5. 📱 PWA (홈화면 추가 지원)

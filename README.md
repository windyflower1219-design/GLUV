# 🏥 GLUV (혈당 비서) - AI 통합 건강 관리 파트너

당신을 위한 세상에서 가장 다정하고 똑똑한 스마트 건강 비서, **GLUV**입니다.  
복잡한 수치 입력 대신, 대화하듯 편안하게 말씀만 하세요. AI가 식단과 혈당을 한 번에 기록하고 개인화된 인사이트를 제공해 드립니다.

---

## ✨ 주요 핵심 기능

### 1. 🎤 통합 음성 비서 (Unified Voice Assistant)
- **한 문장으로 기록**: "비빔밥 먹고 혈당 120 나왔어" 라고 말씀하시면 식단과 혈당을 동시에 인식합니다.
- **Gemma 3 27B 엔진**: 압도적인 할당량과 성능을 가진 최신 Gemma 3 모델을 사용하여 메뉴, 수량, 영양 성분(탄/단/지)을 정밀하게 추출합니다.
- **다단계 폴백**: 메인 모델 장애 시 Gemini 3 Flash, Gemini 2.5 등이 즉시 바톤을 이어받는 무중단 서비스 구조.

### 2. 🩸 혈당 영향 패널 (BG Impact Panel)
- **ΔBG (혈당 변화량)**: 식전 대비 식후 혈당이 얼마나 올랐는지 직관적인 수치로 표시합니다.
- **정밀 지표**: 피크 수치, 피크 도달 시간, 식후 2시간 수치를 분석하여 제공합니다.
- **개인 맞춤형 히스토리**: "이 음식은 평소에 +48만큼 올려요"와 같이 나의 과거 데이터를 기반으로 한 통계 칩을 노출합니다.

### 3. 🍱 균형 잡힌 영양 관리
- **탄/단/지 추적**: 탄수화물뿐만 아니라 단백질과 지방 섭취량까지 함께 관리하여 더 정교한 식이 분석이 가능합니다.
- **지능형 가이드**: 먹은 음식의 영양 밸런스를 고려하여 혈당 반응을 예측하고 조언합니다.

### 4. 📊 맞춤 인사이트 & 대시보드
- **Gemini 3 인사이트**: 나의 혈당 흐름을 분석하여 헬스 트레이너처럼 실시간 조언 및 피드백 카드를 발행합니다.
- **감성적인 디자인**: 아이보리와 파스텔 톤의 따뜻한 라이트 테마로 구성된 사용자 친화적 UI.

---

## 🛠️ 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Vanilla CSS + Tailwind (Custom Warm Palette)
- **AI Engine**: Google Gemma 3 27B (Primary) / Gemini 3 Flash / Gemini 2.5 (Fallback)
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

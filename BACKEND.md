# GLUV - Architecture & Backend Documentation

## 1. 개요 (Overview)
GLUV 프로젝트는 별도의 커스텀 백엔드 서버(Node.js, Spring 등)를 두지 않고, **Serverless 아키텍처**와 **BaaS(Backend as a Service)**를 결합하여 구성되어 있습니다. 이를 통해 모바일 헬스케어 앱의 빠른 응답성과 실시간 데이터 처리, AI 분석 기능을 유연하게 제공합니다.

## 2. 주요 기술 스택 (Tech Stack)
*   **데이터베이스 & 인증**: Firebase (Firestore)
*   **AI 및 자연어 처리**: Google Gemini API
*   **호스팅 & 배포**: Vercel (정적 및 Next.js SSR/API 배포)

## 3. 백엔드 핵심 구조 (Architecture)

백엔드 로직은 주로 `src/lib/` 디렉토리 내에 모듈화되어 있으며 클라이언트 사이드와 긴밀하게 연결되어 작동합니다.

### 3.1. Firebase 연동 (`src/lib/firebase/`)
*   `config.ts`: Firebase 프로젝트 초기화 및 환경 변수 설정.
*   `firestore.ts`: 사용자의 혈당(Glucose), 식단(Meals) 데이터를 읽고 쓰는 CRUD 추상화 로직.

### 3.2. AI 분석 알고리즘 (`src/lib/algorithms/`)
사용자의 데이터를 가공하고 의미 있는 인사이트를 도출하는 핵심 비즈니스 로직입니다.
*   `mealParser.ts`: 사용자의 음성 텍스트(Voice Text)를 Google Gemini API를 이용해 정형화된 식단 데이터(음식명, 칼로리, 탄수화물 등)로 변환하는 자연어 파싱 로직.
*   `glucoseAnalysis.ts`: 입력된 식단과 혈당 수치를 분석하여 사용자에게 맞춤형 조언(인사이트)을 제공하는 룰/AI 결합 엔진.

### 3.3. 외부 API 연동 (`src/lib/gemini/`)
*   `client.ts`: Google Gemini API와의 HTTP 통신을 담당하는 클라이언트 코드로, 프롬프트 엔지니어링 및 응답 결과 모델 매핑 수행.

## 4. 데이터 모델 (Data Model)
주요 데이터 구조는 `src/types/index.ts`에 선언되어 관리됩니다.
*   **User**: 사용자 프로필 및 개인 목표(목표 혈당 등)
*   **GlucoseRecord**: 혈당 측정 기록 (수치, 측정 시점 등)
*   **MealRecord**: 식단 기록 (음식 목록, 총 칼로리, 탄수화물 등)
*   **Insight**: AI가 분석한 조언 로그

## 5. 배포 및 운영 가이드
*   **환경 변수 관리**: Vercel 프로젝트 Settings > Environment Variables에서 Firebase SDK키 및 Google Gemini API Key 설정 필요.
*   **데이터베이스 보안**: Firestore Security Rules를 통해 사용자별 데이터 접근 제어 필요.

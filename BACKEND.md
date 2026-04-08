# GLUV - Architecture & Backend Documentation

## 1. 개요 (Overview)
GLUV 프로젝트는 별도의 커스텀 백엔드 서버(Node.js, Spring 등)를 두지 않고, **Serverless 아키텍처**와 **BaaS(Backend as a Service)**를 결합하여 구성되어 있습니다. 이를 통해 모바일 헬스케어 앱의 빠른 응답성과 실시간 데이터 처리, AI 분석 기능을 유연하게 제공합니다.

## 2. 주요 기술 스택 (Tech Stack)
*   **데이터베이스 & 인증**: Firebase (Firestore, Auth)
*   **AI 및 자연어 처리**: OpenAI (ChatGPT-4o-mini) & Google Gemini 1.5 Flash API (하이브리드 아키텍처)
*   **호스팅 & 배포**: Vercel (정적 및 Next.js SSR/API 배포)

## 3. 백엔드 핵심 구조 (Architecture)

백엔드 로직은 주로 `src/lib/` 디렉토리 내에 모듈화되어 있으며 클라이언트 사이드와 긴밀하게 연결되어 작동합니다.

### 3.1. Firebase 연동 (`src/lib/firebase/`)
*   `config.ts`: Firebase 프로젝트 초기화 및 환경 변수 설정. (Auth, Firestore, Storage 객체 반환)
*   `firestore.ts`: 가입/로그인한 사용자 ID(`user.uid`)를 기준으로 혈당(Glucose) 및 식단(Meals) 데이터를 읽고 쓰는 개인화 CRUD 추상화 로직.

### 3.2. AI 분석 알고리즘 (`src/lib/algorithms/`) 및 API (`src/app/api/`)
사용자의 데이터를 가공하고 의미 있는 인사이트를 도출하는 핵심 비즈니스 로직입니다.
*   `mealParser.ts` (OpenAI): 사용자의 음성 텍스트(Voice Text)를 OpenAI ChatGPT API (`json_object` 모드)를 이용해 정형화된 식단 및 혈당 데이터로 변환하는 정밀 자연어 파싱 로직.
*   `api/insights/route.ts` (Gemini): 입력된 최근 식단과 평균 혈당 수치를 분석하여 사용자에게 공감형/추천형/경고형 인사이트를 동적 생성해주는 서버 API 엔진.

## 4. 데이터 모델 (Data Model)
주요 데이터 구조는 `src/types/index.ts`에 선언되어 관리됩니다.
*   **User**: 사용자 프로필 및 개인 목표(목표 혈당 등)
*   **GlucoseRecord**: 혈당 측정 기록 (수치, 측정 시점 등)
*   **MealRecord**: 식단 기록 (음식 목록, 총 칼로리, 탄수화물 등)
*   **Insight**: AI가 분석한 조언 로그

## 5. 배포 및 운영 가이드
*   **환경 변수 관리**: Vercel 프로젝트 Settings > Environment Variables에서 다음 3가지 핵심 설정 그룹이 필요합니다.
    *   `NEXT_PUBLIC_FIREBASE_*`: Firebase 연결 키
    *   `NEXT_PUBLIC_GEMINI_API_KEY`: 주간 데이터 수집 및 공감/조언 인사이트용 모델 키
    *   `NEXT_PUBLIC_OPENAI_API_KEY`: 빠르고 정교한 음성/텍스트 식단 데이터 파싱용 모델 키
*   **데이터베이스 보안**: Firestore Security Rules를 통해 가입된 유저 본인(`request.auth.uid == resource.data.userId`)만 데이터에 접근할 수 있도록 개인화 제어 필수.

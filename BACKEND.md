# GLUV - Architecture & Backend Documentation

## 1. 개요 (Overview)
GLUV 프로젝트는 별도의 커스텀 백엔드 서버(Node.js, Spring 등)를 두지 않고, **Serverless 아키텍처**와 **BaaS(Backend as a Service)**를 결합하여 구성되어 있습니다. 이를 통해 모바일 헬스케어 앱의 빠른 응답성과 실시간 데이터 처리, AI 분석 기능을 유연하게 제공합니다.

## 2. 주요 기술 스택 (Tech Stack)
*   **데이터베이스 & 인증**: Firebase (Firestore, Auth)
*   **AI 및 자연어 처리**: Google Gemma 3 27B & Gemini 1.5/2.5/3.0 Series (다단계 모델 체인 아키텍처)
*   **호스팅 & 배포**: Vercel (Next.js App Router API Routes)

## 3. 백엔드 핵심 구조 (Architecture)

### 3.1. Firebase 연동 및 안정성 (`src/lib/firebase/`)
*   **실시간 하이브리드 저장**: Firestore 저장을 기본으로 하되, 네트워크 장애 시 **LocalStorage**에 즉시 저장하고 나중에 동기화하는 안정적인 구조를 갖추고 있습니다.
*   **성능 최적화**: 페이지 전환 시 지연을 없애기 위해 **In-memory 읽기 캐시(READ_CACHE)** 시스템(30초 TTL)을 도입하여 반복적인 데이터 요청을 최적화합니다.

### 3.2. AI 분석 및 다단계 폴백 (`src/app/api/`)
*   **`parse-meal` API**: 사용자의 음성을 분석하여 식단(탄/단/지)과 혈당을 추출합니다. **Gemma 3 27B**를 우선 사용하며, Quota 초과 시 Gemini 3, Gemini 2.5 등으로 자동 전환되는 **모델 체인(MODEL_CHAIN)** 시스템이 적용되어 있습니다.
*   **`insights` API**: 누적된 혈당 데이터와 식사 기록을 분석하여 개인화된 건강 가이드를 발행합니다.

### 3.3. 분석 알고리즘 (`src/lib/algorithms/`)
*   **`mealAnalysis.ts`**: 식사 시점 전후의 혈당 변화를 정밀 분석하여 ΔBG, 피크 도달 시간, 2시간 뒤 수치 등을 계산합니다.
*   **`mealParser.ts`**: 로컬 사전 기반 매칭 및 AI 분석 결과를 결합하여 정확도를 극대화합니다.

## 4. 데이터 모델 (Data Model)
*   **Meal**: 식사 종류(아침/점심 등), 영양소(탄/단/지/칼로리), 혈당 영향 지표 포함.
*   **GlucoseReading**: 혈당 수치, 측정 시각, 측정 타입(공복/식후 등).
*   **ParseCorrection**: 사용자가 수정한 파싱 오인식 데이터를 기록하여 추후 AI 학습 로그로 활용.

## 5. 배포 및 운영 가이드
*   **환경 변수 관리**:
    *   `GEMINI_API_KEY`: 모든 AI 분석의 핵심 키 (Google AI Studio 발행)
    *   `NEXT_PUBLIC_FIREBASE_*`: Firebase 클라이언트 연결 키
*   **보안**: Firestore Security Rules를 통해 사용자 본인의 데이터에만 접근 가능하도록 설정되어 있습니다. (userId 기반 격리)

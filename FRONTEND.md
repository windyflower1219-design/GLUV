# GLUV - Frontend Documentation

## 1. 개요 (Overview)
GLUV 프로젝트의 프론트엔드는 모바일 퍼스트(Mobile-First) 디자인 원칙에 입각하여 개발된 헬스케어 웹 애플리케이션입니다. React 기반의 Next.js (App Router) 프레임워크를 사용하며, 빠른 렌더링 성능과 프로그레시브 웹 앱(PWA) 기능을 바탕으로 네이티브 앱과 같은 사용자 경험을 제공합니다.

## 2. 주요 기술 스택 (Tech Stack)
*   **프레임워크**: Next.js 14+ (App Router)
*   **언어**: TypeScript
*   **스타일링**: Tailwind CSS
*   **상태 관리**: React Context API, Custom Hooks
*   **PWA**: `next-pwa`를 이용한 설치형 웹 앱 구성 및 오프라인 지원

## 3. 구조 및 역할 (Directory Structure)
애플리케이션은 기능 단위 및 역할에 따라 `src/` 디렉토리에 직관적으로 분리되어 있습니다.

### 3.1. Routing (`src/app/`)
Next.js App Router의 라우트 컨벤션을 따릅니다. 전체 페이지는 `AppLayout`의 인증 가드(Route Guard)로 보호됩니다.
*   `/login`: 이메일/비밀번호 기반 회원가입 및 로그인 페이지
*   `/dashboard`: 홈 대시보드 화면. 전체 요약 정보 표시
*   `/glucose`: 혈당 기록 및 트렌드 확인 (수동 시간 입력 지원)
*   `/meals`: 식사(식단) 기록 페이지
*   `/insights`: Gemini AI 분석 기반 실시간 생성 맞춤 조언 페이지 (`/api/insights` 연동)
*   `layout.tsx`: 애플리케이션의 뼈대(Root Layout). PWA 모바일 대응 화면 레이아웃 (`AppLayout`) 및 상태 관리를 위한 `<AuthProvider>`, `<VoiceInputProvider>`를 주입합니다.

### 3.2. Components (`src/components/`)
재사용성을 고려하여 모듈화된 UI 컴포넌트입니다.
*   **`common/`**: 여러 페이지에서 공통으로 사용되는 범용 컴포넌트.
    *   `StatCard.tsx`: 통계 요약 카드
    *   `GlucoseGauge.tsx`: 혈당 수치를 시각화하는 게이지
    *   `PageHeader.tsx`: 페이지 상단 헤더
*   **`layout/`**: 화면의 뼈대를 이루는 컴포넌트.
    *   `AppLayout.tsx`: 모바일 디바이스 크기에 맞춘 컨테이너 및 배경 설정. **더불어 로그인되지 않은 사용자 접근 시 `/login`으로 강제 리다이렉트하는 라우트 가드 수행.**
    *   `BottomNavigation.tsx`: 하단 탭 내비게이션 바
*   **기능별 주요 컴포넌트**:
    *   `VoiceInputModal.tsx`: 마이크 권한을 통해 사용자의 음성을 녹음하고 텍스트로 보여주는 통합 음성 비서 모달. (타임스탬프 개별 수정 기능 지원)

### 3.3. State Management & Hooks (`src/lib/hooks/` & `src/context/`)
*   `AuthContext.tsx`: Firebase Auth 상태 유지 관리.
*   `VoiceInputContext.tsx`: 전역에서 음성 인식 모달을 띄우고 상태를 제어할 수 있도록 돕는 전역 컴포넌트.
*   `useVoiceInput.ts`: Web Speech API (`SpeechRecognition`)를 추상화하여 연속적인 음성 인식과 예외 처리를 담당하는 커스텀 훅.
*   `useUnifiedStorage.ts`, `useGlucoseData.ts`: Firebase Firestore와 Auth 정보를 기반으로 동적(`user.uid`) 데이터 로딩 및 상태 동기화 담당.

## 4. UI/UX 디자인 원칙
1.  **모바일 최적화**: SafeArea 영역 대응(`safe-padding` 유틸리티) 및 모바일 네비게이션 제스처 등을 고려.
2.  **직관적 시각화**: 혈당 및 식단 데이터는 게이지(`GlucoseGauge`), 차트 형식을 통해 시각적으로 쉽게 인지되도록 구현.
3.  **심리스한 입력 경험**: `VoiceInputModal`을 통해 타이핑 입력 없이 음성만으로 식단과 혈당을 한 번에 기록할 수 있는 혁신적 UX 제공.

## 5. 실행 및 개발 스크립트
*   `npm run dev`: 로컬 개발 서버 실행
*   `npm run build`: 프로덕션 배포용 빌드 (PWA Service Worker 자동 생성)
*   `npm run lint`: 코드 컨벤션 검사

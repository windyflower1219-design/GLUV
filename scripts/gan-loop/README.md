# GAN Loop — 음성 파서 적대적 개선

Sonnet(Generator) ↔ Haiku(Discriminator) 적대적 루프로 `src/app/api/parse-meal/route.ts`의 Gemini 프롬프트를 자동 개선합니다.

> 참고: README엔 OpenAI로 표기되어 있지만 실제 파서는 **Gemini (gemini-2.0-flash)** 입니다. 이 루프의 평가 대상은 그 Gemini 호출 프롬프트입니다.

## 역할

| 역할 | 모델 | 책임 |
|---|---|---|
| **Generator** | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | 실패 분석을 받아 개선된 프롬프트 v(N+1) 제안 |
| **Discriminator** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | 적대적 케이스 생성 + 실패 클러스터 분석 |
| **Parser (SUT)** | Gemini 2.0 Flash | 실제 테스트 대상 — 앱에서 쓰는 파서 |

## 구조

```
scripts/gan-loop/
  runner.mjs              # 3라운드 오케스트레이터
  discriminator.mjs       # Haiku: 공격 케이스 생성 + 실패 분석
  generator.mjs           # Sonnet: 프롬프트 패치 제안
  evaluator.mjs           # Gemini로 현재 프롬프트 실행
  apply-prompt.mjs        # 우승 프롬프트를 route.ts에 반영 (수동)
  lib/
    llm.mjs               # Anthropic + Gemini HTTP 래퍼 (의존성 0)
    scorer.mjs            # 결정론적 채점 (foodRecall, glucose, ...)
    report.mjs            # round-N.md / FINAL.md 렌더러
    dotenv.mjs            # .env.local 로더
  prompts/
    baseline.txt          # 초기 스냅샷 (route.ts에서 추출)
    round-1.txt           # Sonnet이 만든 v1
    round-2.txt           # v2
    round-3.txt           # v3
  state/
    prompt.current.txt    # 현재 활성 프롬프트
  cases/
    seed.json             # 시드 20개 (Round 0)
    round-1.json          # Haiku 생성 케이스들
  results/
    round-N.json          # 케이스별 actual/expected/score
  reports/
    round-N.md
    FINAL.md
```

## 실행

### 필요 환경변수 (`.env.local`)

```env
ANTHROPIC_API_KEY=sk-ant-...         # Sonnet + Haiku
GEMINI_API_KEY=AIza...               # 파서 평가 대상
# 또는 기존 NEXT_PUBLIC_GEMINI_API_KEY 재사용 가능
```

### 명령

```bash
# 3라운드 전체 실행 (API 호출, 실제 비용 발생)
node scripts/gan-loop/runner.mjs

# 건조 실행 — API 호출 없이 파이프라인 점검
node scripts/gan-loop/runner.mjs --dry-run

# 옵션
node scripts/gan-loop/runner.mjs --rounds=2 --new-cases=8
```

### 반영

3라운드가 끝나면 `scripts/gan-loop/reports/FINAL.md`를 **직접 열어 확인**한 뒤:

```bash
node scripts/gan-loop/apply-prompt.mjs
```

이 스크립트는:
- `route.ts`의 ``const prompt = `...`;`` 블록만 교체
- 원본을 `route.ts.bak`로 백업
- `{{VOICE_TEXT}}` placeholder를 `${voiceText}`로 치환

되돌리기: `mv src/app/api/parse-meal/route.ts.bak src/app/api/parse-meal/route.ts`

## 예산·안전장치

- 1라운드 비용 추정: Haiku(케이스 10개 생성 + 실패 분석) + Sonnet(프롬프트 제안) + Gemini(10 케이스 평가) ≈ 매우 저렴 (< $0.10)
- **자동으로 `route.ts`를 수정하지 않습니다** — apply-prompt는 별도 명령.
- Generator 출력에 `{{VOICE_TEXT}}`가 없으면 적용 거부.
- JSON 스키마 드리프트는 평가 점수에 즉시 반영됨 (foodRecall 등이 0으로 떨어짐).

## 채점 방식

결정론적 채점 (`lib/scorer.mjs`) — 주요 가중치:

| Metric | Weight | 의미 |
|---|---|---|
| foodRecall | 0.20 | 기대 음식 중 몇 %가 잡혔나 |
| foodPrecision | 0.15 | 뽑힌 음식 중 환각 없는 비율 |
| quantityAcc | 0.15 | 수량이 기대치와 일치 (±0.05) |
| unitAcc | 0.10 | 단위 일치 |
| glucose | 0.20 | 혈당값 정확도 (없어야 하는데 있어도 0) |
| measType | 0.10 | 측정 타입 |
| time | 0.05 | HH:mm |
| needsClarification | 0.05 | 모호 케이스 분기 |

합계 ≥ 0.7 이면 "pass".

## 확장

- **케이스 수 늘리기**: `--new-cases=20`
- **Generator 역할을 코드 레벨로 확장**: `generator.mjs`의 system prompt를 수정해 프롬프트 대신 route.ts의 local-fallback 로직을 개선하도록 변경 가능.
- **스케줄링**: schedule skill로 매주 자동 실행 → 회귀 감지.

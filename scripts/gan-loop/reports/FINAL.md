# GAN Loop — Final Report

| Round | n | Composite | Food R | Food P | Qty | Unit | Glucose | MeasType | Time | Clarify |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 20 | 0.845 | 100.0% | 88.3% | 77.5% | 45.8% | 85.0% | 100.0% | 100.0% | 100.0% |
| 1 | 6 | 0.874 | 100.0% | 83.3% | 83.3% | 33.3% | 100.0% | 100.0% | 100.0% | n/a |
| 2 | 6 | 0.874 | 100.0% | 83.3% | 83.3% | 33.3% | 100.0% | 100.0% | 100.0% | n/a |
| 3 | 6 | 0.874 | 100.0% | 83.3% | 83.3% | 33.3% | 100.0% | 100.0% | 100.0% | n/a |

## Δ vs baseline: **2.8%p** (0.845 → 0.874)

## Patch Notes

### Round 1
- (dry-run) no patch applied

### Round 2
- (dry-run) no patch applied

### Round 3
- (dry-run) no patch applied

## Apply Winning Prompt

자동 적용은 하지 않습니다. 검토 후 다음 명령으로 반영:

```bash
node scripts/gan-loop/apply-prompt.mjs
```

이 명령은 `state/prompt.current.txt`의 본문(템플릿 마커 제외)을 `src/app/api/parse-meal/route.ts`의 prompt 변수에 치환합니다.
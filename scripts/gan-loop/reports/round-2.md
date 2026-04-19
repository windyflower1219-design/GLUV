# GAN Loop — Round 2

- **Cases**: 6 (pass 6 / fail 0)
- **Composite**: 0.874 (87.4%)

## Metrics

| Metric | Value |
|---|---|
| Food recall | 100.0% |
| Food precision | 83.3% |
| Quantity acc | 83.3% |
| Unit acc | 33.3% |
| Glucose value | 100.0% |
| Meas type | 100.0% |
| Detected time | 100.0% |
| needsClarification | n/a |

## Attack (Haiku — Discriminator)

- 생성된 새 케이스: **6** (시드 0 포함, 총 6 평가)
- 카테고리: basic-stub, time-context-stub, postmeal-ambiguous-stub, multi-food-stub, quantity-word-stub, dialect-stub

## Failure Analysis (Haiku)

> (dry-run skipped)

## Patch (Sonnet — Generator)

- (dry-run) no patch applied

Prompt saved to: `(none)`

## Failed Cases (top 10)

_None — all cases ≥ 0.7._

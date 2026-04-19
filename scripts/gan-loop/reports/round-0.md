# GAN Loop — Round 0

- **Cases**: 20 (pass 17 / fail 3)
- **Composite**: 0.845 (84.5%)

## Metrics

| Metric | Value |
|---|---|
| Food recall | 100.0% |
| Food precision | 88.3% |
| Quantity acc | 77.5% |
| Unit acc | 45.8% |
| Glucose value | 85.0% |
| Meas type | 100.0% |
| Detected time | 100.0% |
| needsClarification | 100.0% |

## Attack (Haiku — Discriminator)

- 생성된 새 케이스: **0** (시드 20 포함, 총 20 평가)
- 카테고리: basic, time-context, postmeal-ambiguous, multi-food, quantity-word, dialect, glucose-only, number-confusion, fractional-quantity, clarification-needed, evening-context, past-tense, loanword, informal-number, unit-swap, typo-spaceless, emotion-filler, imperative, ambiguous-measType, glucose-boundary

## Failed Cases (top 10)

| Case | Cat | Score | Input |
|---|---|---|---|
| seed-14 | informal-number | 0.531 | 김밥 한 줄 하고 혈당 백삼십 나왔어 |
| seed-15 | unit-swap | 0.667 | 햄버거 하나랑 콜라 한 캔 먹고 식후 30분 162 |
| seed-19 | ambiguous-measType | 0.667 | 밥 먹은 지 30분 지났는데 혈당 140 |

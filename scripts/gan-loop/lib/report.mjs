// Report rendering — round MD + final MD.
import { writeFile } from 'node:fs/promises';

const pct = (v) => (v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const num = (v) => (v === null || v === undefined ? 'n/a' : v.toFixed(3));

export async function writeRoundReport({ path, round, summary, results, attackInfo, analysis, patchInfo }) {
  const lines = [];
  lines.push(`# GAN Loop — Round ${round}`);
  lines.push('');
  lines.push(`- **Cases**: ${summary.n} (pass ${summary.pass} / fail ${summary.fail})`);
  lines.push(`- **Composite**: ${num(summary.composite)} (${pct(summary.composite)})`);
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Food recall | ${pct(summary.foodRecall)} |`);
  lines.push(`| Food precision | ${pct(summary.foodPrecision)} |`);
  lines.push(`| Quantity acc | ${pct(summary.quantityAcc)} |`);
  lines.push(`| Unit acc | ${pct(summary.unitAcc)} |`);
  lines.push(`| Glucose value | ${pct(summary.glucose)} |`);
  lines.push(`| Meas type | ${pct(summary.measType)} |`);
  lines.push(`| Detected time | ${pct(summary.time)} |`);
  lines.push(`| needsClarification | ${pct(summary.needsClarification)} |`);
  lines.push('');
  if (attackInfo) {
    lines.push('## Attack (Haiku — Discriminator)');
    lines.push('');
    lines.push(`- 생성된 새 케이스: **${attackInfo.generatedCount}** (시드 ${attackInfo.seedCount} 포함, 총 ${attackInfo.totalCount} 평가)`);
    if (attackInfo.categories?.length) lines.push(`- 카테고리: ${attackInfo.categories.join(', ')}`);
    lines.push('');
  }
  if (analysis) {
    lines.push('## Failure Analysis (Haiku)');
    lines.push('');
    lines.push(`> ${analysis.summary}`);
    lines.push('');
    for (const c of analysis.clusters || []) {
      lines.push(`### ${c.name} _(cases: ${(c.caseIds || []).join(', ')})_`);
      lines.push('');
      lines.push(`- **Root cause**: ${c.rootCause}`);
      lines.push(`- **Prompt fix**: ${c.promptFixDirection}`);
      lines.push('');
    }
  }
  if (patchInfo) {
    lines.push('## Patch (Sonnet — Generator)');
    lines.push('');
    for (const note of patchInfo.changeNotes || []) lines.push(`- ${note}`);
    lines.push('');
    lines.push(`Prompt saved to: \`${patchInfo.promptPath}\``);
    lines.push('');
  }
  lines.push('## Failed Cases (top 10)');
  lines.push('');
  const fails = results.filter((r) => (r.score?.composite ?? 1) < 0.7).slice(0, 10);
  if (fails.length === 0) {
    lines.push('_None — all cases ≥ 0.7._');
  } else {
    lines.push('| Case | Cat | Score | Input |');
    lines.push('|---|---|---|---|');
    for (const r of fails) {
      const inp = r.input.replace(/\|/g, '\\|').slice(0, 60);
      lines.push(`| ${r.caseId} | ${r.category} | ${num(r.score.composite)} | ${inp} |`);
    }
  }
  lines.push('');
  await writeFile(path, lines.join('\n'), 'utf8');
}

export async function writeFinalReport({ path, history }) {
  const lines = [];
  lines.push('# GAN Loop — Final Report');
  lines.push('');
  lines.push('| Round | n | Composite | Food R | Food P | Qty | Unit | Glucose | MeasType | Time | Clarify |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const h of history) {
    const s = h.summary;
    lines.push(`| ${h.round} | ${s.n} | ${num(s.composite)} | ${pct(s.foodRecall)} | ${pct(s.foodPrecision)} | ${pct(s.quantityAcc)} | ${pct(s.unitAcc)} | ${pct(s.glucose)} | ${pct(s.measType)} | ${pct(s.time)} | ${pct(s.needsClarification)} |`);
  }
  lines.push('');
  const baseline = history[0]?.summary?.composite ?? 0;
  const last = history[history.length - 1]?.summary?.composite ?? 0;
  const delta = last - baseline;
  lines.push(`## Δ vs baseline: **${(delta * 100).toFixed(1)}%p** (${num(baseline)} → ${num(last)})`);
  lines.push('');
  lines.push('## Patch Notes');
  lines.push('');
  for (const h of history) {
    if (!h.patchInfo) continue;
    lines.push(`### Round ${h.round}`);
    for (const n of h.patchInfo.changeNotes || []) lines.push(`- ${n}`);
    lines.push('');
  }
  lines.push('## Apply Winning Prompt');
  lines.push('');
  lines.push('자동 적용은 하지 않습니다. 검토 후 다음 명령으로 반영:');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/gan-loop/apply-prompt.mjs');
  lines.push('```');
  lines.push('');
  lines.push('이 명령은 `state/prompt.current.txt`의 본문(템플릿 마커 제외)을 `src/app/api/parse-meal/route.ts`의 prompt 변수에 치환합니다.');
  await writeFile(path, lines.join('\n'), 'utf8');
}

function nm(s) { return s; }

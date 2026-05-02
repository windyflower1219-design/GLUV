// 음식 NLP 파서 (서버사이드 API Route + 로컬 폴백)
import type { FoodItem, VoiceParseResult, MeasurementType } from '@/types';
import { apiFetch } from '@/lib/api/client';

// 한국 음식 영양 데이터베이스 (로컬 캐시)
const KOREAN_FOOD_DB: Record<string, Omit<FoodItem, 'id' | 'quantity'>> = {
  '밥': { name: '밥', unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
  '흰밥': { name: '흰밥', unit: '공기', carbs: 65, calories: 300, glycemicIndex: 72, protein: 5, fat: 1, sodium: 5 },
  '현미밥': { name: '현미밥', unit: '공기', carbs: 58, calories: 280, glycemicIndex: 55, protein: 6, fat: 2, sodium: 3 },
  '김치찌개': { name: '김치찌개', unit: '인분', carbs: 15, calories: 180, glycemicIndex: 45, protein: 12, fat: 8, sodium: 1200 },
  '된장찌개': { name: '된장찌개', unit: '인분', carbs: 12, calories: 120, glycemicIndex: 40, protein: 8, fat: 5, sodium: 1000 },
  '제육볶음': { name: '제육볶음', unit: '인분', carbs: 20, calories: 350, glycemicIndex: 55, protein: 25, fat: 18, sodium: 900 },
  '불고기': { name: '불고기', unit: '인분', carbs: 18, calories: 320, glycemicIndex: 50, protein: 28, fat: 15, sodium: 800 },
  '삼겹살': { name: '삼겹살', unit: '인분', carbs: 0, calories: 430, glycemicIndex: 0, protein: 22, fat: 38, sodium: 400 },
  '라면': { name: '라면', unit: '봉지', carbs: 70, calories: 500, glycemicIndex: 80, protein: 10, fat: 20, sodium: 1800 },
  '짜장면': { name: '짜장면', unit: '인분', carbs: 85, calories: 680, glycemicIndex: 75, protein: 18, fat: 22, sodium: 1500 },
  '짬뽕': { name: '짬뽕', unit: '인분', carbs: 80, calories: 620, glycemicIndex: 72, protein: 22, fat: 18, sodium: 2200 },
  '비빔밥': { name: '비빔밥', unit: '인분', carbs: 78, calories: 580, glycemicIndex: 68, protein: 18, fat: 14, sodium: 900 },
  '순두부찌개': { name: '순두부찌개', unit: '인분', carbs: 10, calories: 150, glycemicIndex: 35, protein: 14, fat: 10, sodium: 950 },
  '갈비탕': { name: '갈비탕', unit: '인분', carbs: 20, calories: 380, glycemicIndex: 40, protein: 32, fat: 22, sodium: 700 },
  '삼계탕': { name: '삼계탕', unit: '인분', carbs: 35, calories: 450, glycemicIndex: 55, protein: 40, fat: 20, sodium: 600 },
  '치킨': { name: '치킨', unit: '조각', carbs: 15, calories: 280, glycemicIndex: 45, protein: 22, fat: 18, sodium: 700 },
  '피자': { name: '피자', unit: '조각', carbs: 35, calories: 280, glycemicIndex: 60, protein: 12, fat: 12, sodium: 800 },
  '햄버거': { name: '햄버거', unit: '개', carbs: 45, calories: 500, glycemicIndex: 65, protein: 25, fat: 28, sodium: 1000 },
  '샌드위치': { name: '샌드위치', unit: '개', carbs: 38, calories: 380, glycemicIndex: 58, protein: 18, fat: 16, sodium: 850 },
  '샐러드': { name: '샐러드', unit: '인분', carbs: 10, calories: 80, glycemicIndex: 20, protein: 3, fat: 3, sodium: 200 },
  '바나나': { name: '바나나', unit: '개', carbs: 27, calories: 105, glycemicIndex: 51, protein: 1, fat: 0, sodium: 1 },
  '사과': { name: '사과', unit: '개', carbs: 25, calories: 95, glycemicIndex: 36, protein: 0, fat: 0, sodium: 2 },
  '오렌지주스': { name: '오렌지주스', unit: '컵', carbs: 26, calories: 110, glycemicIndex: 50, protein: 2, fat: 0, sodium: 2 },
  '커피': { name: '커피', unit: '잔', carbs: 3, calories: 15, glycemicIndex: 0, protein: 0, fat: 0, sodium: 10 },
  '아메리카노': { name: '아메리카노', unit: '잔', carbs: 1, calories: 5, glycemicIndex: 0, protein: 0, fat: 0, sodium: 5 },
  '라떼': { name: '라떼', unit: '잔', carbs: 15, calories: 120, glycemicIndex: 30, protein: 6, fat: 5, sodium: 80 },
  // 신규 추가분
  '국밥': { name: '국밥', unit: '그릇', carbs: 65, calories: 450, glycemicIndex: 65, protein: 25, fat: 15, sodium: 1200 },
  '김밥': { name: '김밥', unit: '줄', carbs: 70, calories: 480, glycemicIndex: 60, protein: 12, fat: 14, sodium: 900 },
  '돈까스': { name: '돈까스', unit: '인분', carbs: 45, calories: 600, glycemicIndex: 65, protein: 28, fat: 35, sodium: 1100 },
  '초밥': { name: '초밥', unit: '인분', carbs: 85, calories: 550, glycemicIndex: 70, protein: 22, fat: 10, sodium: 1300 },
  '마라탕': { name: '마라탕', unit: '인분', carbs: 40, calories: 800, glycemicIndex: 55, protein: 20, fat: 45, sodium: 2500 },
  '떡볶이': { name: '떡볶이', unit: '인분', carbs: 110, calories: 600, glycemicIndex: 85, protein: 15, fat: 8, sodium: 1500 },
  '냉면': { name: '냉면', unit: '그릇', carbs: 85, calories: 480, glycemicIndex: 72, protein: 15, fat: 5, sodium: 1800 },
  '칼국수': { name: '칼국수', unit: '그릇', carbs: 75, calories: 450, glycemicIndex: 70, protein: 15, fat: 6, sodium: 1600 },
  '우동': { name: '우동', unit: '그릇', carbs: 70, calories: 420, glycemicIndex: 75, protein: 12, fat: 4, sodium: 1700 },
  '파스타': { name: '파스타', unit: '인분', carbs: 65, calories: 500, glycemicIndex: 55, protein: 18, fat: 15, sodium: 800 },
  '스테이크': { name: '스테이크', unit: '인분', carbs: 0, calories: 450, glycemicIndex: 0, protein: 45, fat: 30, sodium: 600 },
  '탕수육': { name: '탕수육', unit: '인분', carbs: 45, calories: 550, glycemicIndex: 65, protein: 20, fat: 28, sodium: 800 },
  '볶음밥': { name: '볶음밥', unit: '인분', carbs: 75, calories: 520, glycemicIndex: 70, protein: 12, fat: 18, sodium: 900 },
  '된장국': { name: '된장국', unit: '그릇', carbs: 8, calories: 60, glycemicIndex: 40, protein: 5, fat: 2, sodium: 800 },
  '미역국': { name: '미역국', unit: '그릇', carbs: 5, calories: 80, glycemicIndex: 35, protein: 6, fat: 3, sodium: 700 },
  '김치전': { name: '김치전', unit: '조각', carbs: 30, calories: 250, glycemicIndex: 60, protein: 5, fat: 12, sodium: 600 },
  '만두': { name: '만두', unit: '개', carbs: 8, calories: 50, glycemicIndex: 65, protein: 3, fat: 2, sodium: 120 },
  '계란후라이': { name: '계란후라이', unit: '개', carbs: 1, calories: 90, glycemicIndex: 0, protein: 6, fat: 7, sodium: 65 },
  '달걀말이': { name: '달걀말이', unit: '조각', carbs: 2, calories: 70, glycemicIndex: 0, protein: 5, fat: 5, sodium: 100 },
  '고구마': { name: '고구마', unit: '개', carbs: 30, calories: 130, glycemicIndex: 55, protein: 2, fat: 0, sodium: 15 },
  '감자': { name: '감자', unit: '개', carbs: 25, calories: 110, glycemicIndex: 80, protein: 3, fat: 0, sodium: 10 },
  '옥수수': { name: '옥수수', unit: '개', carbs: 20, calories: 100, glycemicIndex: 55, protein: 3, fat: 1, sodium: 5 },
  '우유': { name: '우유', unit: '컵', carbs: 12, calories: 130, glycemicIndex: 30, protein: 8, fat: 7, sodium: 120 },
  '요거트': { name: '요거트', unit: '컵', carbs: 15, calories: 100, glycemicIndex: 35, protein: 5, fat: 2, sodium: 60 },
  '아이스크림': { name: '아이스크림', unit: '개', carbs: 25, calories: 200, glycemicIndex: 65, protein: 3, fat: 10, sodium: 50 },
  '케이크': { name: '케이크', unit: '조각', carbs: 35, calories: 300, glycemicIndex: 70, protein: 4, fat: 15, sodium: 150 },
  '과자': { name: '과자', unit: '봉지', carbs: 40, calories: 250, glycemicIndex: 75, protein: 2, fat: 12, sodium: 300 },
  '초콜릿': { name: '초콜릿', unit: '조각', carbs: 15, calories: 110, glycemicIndex: 45, protein: 1, fat: 6, sodium: 10 },
  '포도': { name: '포도', unit: '송이', carbs: 45, calories: 180, glycemicIndex: 50, protein: 1, fat: 0, sodium: 5 },
  '수박': { name: '수박', unit: '조각', carbs: 12, calories: 50, glycemicIndex: 72, protein: 1, fat: 0, sodium: 2 },
  '사이다': { name: '사이다', unit: '캔', carbs: 30, calories: 120, glycemicIndex: 65, protein: 0, fat: 0, sodium: 15 },
  '콜라': { name: '콜라', unit: '캔', carbs: 35, calories: 140, glycemicIndex: 65, protein: 0, fat: 0, sodium: 10 },
  '맥주': { name: '맥주', unit: '캔', carbs: 12, calories: 150, glycemicIndex: 85, protein: 1, fat: 0, sodium: 15 },
  '소주': { name: '소주', unit: '병', carbs: 0, calories: 400, glycemicIndex: 0, protein: 0, fat: 0, sodium: 0 },
  '해장국': { name: '해장국', unit: '그릇', carbs: 20, calories: 450, glycemicIndex: 55, protein: 30, fat: 15, sodium: 1200 },
  '황태 해장국': { name: '황태 해장국', unit: '그릇', carbs: 15, calories: 350, glycemicIndex: 50, protein: 25, fat: 10, sodium: 1100 },
  // 롱테일 한식 — 저빈도지만 인식 실패가 잦은 메뉴들
  '돼지고기 짜글이': { name: '돼지고기 짜글이', unit: '인분', carbs: 18, calories: 380, glycemicIndex: 50, protein: 22, fat: 20, sodium: 1300 },
  '짜글이': { name: '짜글이', unit: '인분', carbs: 15, calories: 320, glycemicIndex: 50, protein: 18, fat: 18, sodium: 1200 },
  '꽁치 짜글이': { name: '꽁치 짜글이', unit: '인분', carbs: 12, calories: 300, glycemicIndex: 45, protein: 24, fat: 15, sodium: 1100 },
  '콩나물국': { name: '콩나물국', unit: '그릇', carbs: 6, calories: 70, glycemicIndex: 35, protein: 5, fat: 2, sodium: 750 },
  '콩나물 해장국': { name: '콩나물 해장국', unit: '그릇', carbs: 18, calories: 300, glycemicIndex: 50, protein: 18, fat: 8, sodium: 1100 },
  '뼈 해장국': { name: '뼈 해장국', unit: '그릇', carbs: 22, calories: 520, glycemicIndex: 55, protein: 32, fat: 22, sodium: 1300 },
  '순댓국': { name: '순댓국', unit: '그릇', carbs: 35, calories: 550, glycemicIndex: 60, protein: 28, fat: 22, sodium: 1400 },
  '돼지국밥': { name: '돼지국밥', unit: '그릇', carbs: 60, calories: 580, glycemicIndex: 65, protein: 30, fat: 20, sodium: 1500 },
  '도가니탕': { name: '도가니탕', unit: '그릇', carbs: 18, calories: 400, glycemicIndex: 40, protein: 35, fat: 18, sodium: 900 },
  '알탕': { name: '알탕', unit: '그릇', carbs: 10, calories: 280, glycemicIndex: 40, protein: 22, fat: 14, sodium: 1300 },
};

// --- 별칭(alias) → 표준 DB 키 매핑 ----------------------------------
// ASR 띄어쓰기·된소리 오인식·지역별 이명(異名)을 흡수하기 위한 보조 사전.
// 여기에 추가된 별칭은 substring/자모 기반 매칭에서 모두 동일한 canonical key로 귀결된다.
const FOOD_ALIASES: Record<string, string> = {
  // 황태 해장국 계열 — 황태/북어/동태는 사실상 같은 어종으로 묶어 해석
  '황태해장국': '황태 해장국',
  '황탯국': '황태 해장국',
  '황태국': '황태 해장국',
  '북어해장국': '황태 해장국',
  '북어 해장국': '황태 해장국',
  '동태해장국': '황태 해장국',
  '동태 해장국': '황태 해장국',
  // 돼지고기 짜글이 계열
  '돼지고기짜글이': '돼지고기 짜글이',
  '돼지짜글이': '돼지고기 짜글이',
  '돼지 짜글이': '돼지고기 짜글이',
  '돼지고기 자글이': '돼지고기 짜글이', // 된소리 오인식
  '돼지자글이': '돼지고기 짜글이',
  '자글이': '짜글이',
  '짜글이찌개': '짜글이',
  '짜글이 찌개': '짜글이',
  // 기타
  '꽁치자글이': '꽁치 짜글이',
  '콩나물국밥': '콩나물 해장국',
  '뼈해장국': '뼈 해장국',
  '뼈다귀해장국': '뼈 해장국',
  '뼈다귀 해장국': '뼈 해장국',
  '순대국': '순댓국',
  '순대 국': '순댓국',
};

// =====================================================
// 한글 자모 분해 + 음운 정규화 유틸 (외부 의존성 없음)
// - 된소리(ㄲ/ㄸ/ㅃ/ㅆ/ㅉ)와 거센소리(ㅋ/ㅌ/ㅍ/ㅊ)를 해당 평음으로 흡수해
//   "짜글이"↔"자글이", "황태"↔"황대"/"황다" 수준의 ASR 오인식을 같은 키로 매핑.
// =====================================================
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 된소리·거센소리 → 평음 (음운 정규화)
const TENSE_NORMALIZE: Record<string, string> = {
  'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ',
  'ㄸ': 'ㄷ', 'ㅌ': 'ㄷ',
  'ㅃ': 'ㅂ', 'ㅍ': 'ㅂ',
  'ㅆ': 'ㅅ',
  'ㅉ': 'ㅈ', 'ㅊ': 'ㅈ',
};
const normalizeJamo = (j: string) => TENSE_NORMALIZE[j] ?? j;

function decomposeToJamo(s: string, normalize = true): string[] {
  const out: string[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off = code - 0xAC00;
      const cho = CHO[Math.floor(off / 588)];
      const jung = JUNG[Math.floor((off % 588) / 28)];
      const jongIdx = off % 28;
      out.push(normalize ? normalizeJamo(cho) : cho);
      out.push(jung);
      if (jongIdx > 0) {
        const jong = JONG[jongIdx];
        out.push(normalize ? normalizeJamo(jong) : jong);
      }
    } else if (ch.trim()) {
      // 공백은 자모 비교에서 제거(띄어쓰기 변이 흡수)
      out.push(ch.toLowerCase());
    }
  }
  return out;
}

// 자모 배열 간 Levenshtein 거리
function jamoDistance(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// 공백·조사 제거 + 자모 분해(정규화)
const STRIP_PARTICLES = /(은|는|이|가|을|를|의|에|과|와|도|랑|이랑)$/;
function canonicalizeToken(tok: string): string[] {
  let t = tok.trim();
  t = t.replace(STRIP_PARTICLES, '');
  return decomposeToJamo(t, true);
}

/**
 * 입력 텍스트에서 음식 DB(+별칭)에 대해 상위 후보를 자모 거리 기반으로 돌려준다.
 * substring 매칭이 실패했을 때 백업 경로로, 또는 항상 topCandidates 계산용으로 사용.
 *
 * @returns [{ foodKey, distance, windowText, position }]  — distance 오름차순
 */
function fuzzyFindCandidates(
  text: string,
  limit = 3,
): Array<{ foodKey: string; distance: number; windowText: string; position: number }> {
  const candidates: Array<{ foodKey: string; distance: number; windowText: string; position: number }> = [];
  const allKeys = [...Object.keys(KOREAN_FOOD_DB), ...Object.keys(FOOD_ALIASES)];

  // 슬라이딩 윈도우로 텍스트를 잘라 각 DB 키와 비교
  const textTrimmed = text.replace(/\s+/g, ' ').trim();
  const uniqueWindows = new Set<string>();
  const windows: Array<{ text: string; position: number }> = [];

  // 단어 토큰 + 인접 토큰 쌍(복합 메뉴명 대비: "돼지고기 짜글이")
  const tokens = textTrimmed.split(/\s+/);
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const single = tokens[i];
    if (single && !uniqueWindows.has(single)) {
      uniqueWindows.add(single);
      windows.push({ text: single, position: cursor });
    }
    if (i < tokens.length - 1) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      if (!uniqueWindows.has(pair)) {
        uniqueWindows.add(pair);
        windows.push({ text: pair, position: cursor });
      }
    }
    cursor += single.length + 1;
  }

  for (const key of allKeys) {
    const canonicalKey = FOOD_ALIASES[key] ?? key;
    if (!KOREAN_FOOD_DB[canonicalKey]) continue;
    const keyJamo = canonicalizeToken(key);
    const keyLen = keyJamo.length;
    if (keyLen < 3) continue; // 너무 짧은 키는 노이즈 유발 → 패스

    let best: { dist: number; windowText: string; position: number } | null = null;
    for (const w of windows) {
      const wJamo = canonicalizeToken(w.text);
      // 길이 차이가 너무 크면 계산 생략(최적화)
      if (Math.abs(wJamo.length - keyLen) > Math.max(2, Math.floor(keyLen / 2))) continue;
      const d = jamoDistance(wJamo, keyJamo);
      if (!best || d < best.dist) best = { dist: d, windowText: w.text, position: w.position };
    }

    if (!best) continue;
    // 임계치: 자모 길이의 25% 또는 최소 1
    const threshold = Math.max(1, Math.floor(keyLen * 0.25));
    if (best.dist <= threshold) {
      // 이미 같은 canonical key로 후보 들어갔으면 더 좋은 쪽만 유지
      const existing = candidates.find(c => c.foodKey === canonicalKey);
      if (!existing || existing.distance > best.dist) {
        if (existing) {
          existing.distance = best.dist;
          existing.windowText = best.windowText;
          existing.position = best.position;
        } else {
          candidates.push({ foodKey: canonicalKey, distance: best.dist, windowText: best.windowText, position: best.position });
        }
      }
    }
  }

  return candidates.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

// 수량 표현 파서
const QUANTITY_PATTERNS: Array<{ pattern: RegExp; quantity: number; unit: string }> = [
  { pattern: /반\s*(개|인분|공기|그릇|봉지)?/, quantity: 0.5, unit: '인분' },
  { pattern: /한\s*(개|인분|공기|그릇|봉지)/, quantity: 1, unit: '인분' },
  { pattern: /두\s*(개|인분|공기|그릇|봉지)/, quantity: 2, unit: '인분' },
  { pattern: /세\s*(개|인분|공기|그릇|봉지)/, quantity: 3, unit: '인분' },
  { pattern: /(\d+\.?\d*)\s*(개|인분|공기|그릇|봉지|조각|컵|잔)/, quantity: 1, unit: '인분' },
  { pattern: /조금|약간|살짝/, quantity: 0.3, unit: '인분' },
  { pattern: /많이|듬뿍|가득/, quantity: 1.5, unit: '인분' },
];

function extractQuantity(text: string): { quantity: number; unit: string } {
  for (const { pattern, unit } of QUANTITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // 숫자가 있으면 숫자 추출
      const numMatch = match[0].match(/(\d+\.?\d*)/);
      const quantity = numMatch ? parseFloat(numMatch[1]) : QUANTITY_PATTERNS.find(p => p.pattern === pattern)?.quantity ?? 1;
      const extractedUnit = match[1] || unit;
      const unitMap: Record<string, string> = { '공기': '공기', '그릇': '그릇', '봉지': '봉지', '조각': '조각', '컵': '컵', '잔': '잔', '개': '개', '인분': '인분' };
      return { quantity, unit: unitMap[extractedUnit] || unit };
    }
  }
  return { quantity: 1, unit: '인분' };
}

function findFoodInText(text: string): Array<{ foodKey: string; position: number }> {
  const found: Array<{ foodKey: string; position: number }> = [];
  // DB 원본 키 + 별칭(alias) 키를 모두 후보로 사용하되, alias는 canonical로 환원해 기록
  const aliasPairs: Array<{ surface: string; canonical: string }> = [
    ...Object.keys(KOREAN_FOOD_DB).map(k => ({ surface: k, canonical: k })),
    ...Object.entries(FOOD_ALIASES).map(([surface, canonical]) => ({ surface, canonical })),
  ];

  // 긴 이름 먼저 매칭(지역 greedy) — 복합 메뉴명 우선
  aliasPairs.sort((a, b) => b.surface.length - a.surface.length);

  for (const { surface, canonical } of aliasPairs) {
    const idx = text.indexOf(surface);
    if (idx !== -1) {
      const overlaps = found.some(f => {
        const start1 = f.position;
        const end1 = f.position + f.foodKey.length;
        const start2 = idx;
        const end2 = idx + surface.length;
        return Math.max(start1, start2) < Math.min(end1, end2);
      });
      if (!overlaps) {
        // canonical로 기록(영양정보는 DB의 canonical 엔트리에서 조회)
        found.push({ foodKey: canonical, position: idx });
      }
    }
  }

  return found.sort((a, b) => a.position - b.position);
}

// ======================================================
// 메인 파서 함수
// ======================================================
export async function parseMealText(
  voiceText: string,
): Promise<VoiceParseResult> {
  // 서버사이드 API Route 호출 (API 키를 클라이언트에 노출하지 않음)
  try {
    const res = await apiFetch('/api/parse-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceText }),
    });

    if (res.ok) {
      const data = await res.json();
      // API 키 없음 에러가 아닌 경우 반환
      if (!data.error) {
        return {
          rawText: voiceText,
          ...data,
        };
      }
      console.warn('Parse API returned error:', data.error);
    }
  } catch (error) {
    console.warn('Server parse API failed, falling back to local:', error);
  }

  // --- Local Fallback Parser ---
  let foundFoods = findFoodInText(voiceText);

  // 1차 substring 매칭이 실패했으면 자모 거리 기반 fuzzy 재시도
  // (예: "돼지고기 자글이"→"돼지고기 짜글이", "황제해장국"→"황태 해장국")
  if (foundFoods.length === 0) {
    const fuzzy = fuzzyFindCandidates(voiceText, 3);
    if (fuzzy.length > 0 && fuzzy[0].distance <= 1) {
      // 거리 1 이하면 자신있게 채택
      foundFoods = [{ foodKey: fuzzy[0].foodKey, position: fuzzy[0].position }];
    }
  }
  // 한국어 조사(이/은/가/는/의)와 중간 단어("수치")를 유연하게 처리
  // 예: "혈당이 140", "혈당은 135", "혈당 수치가 110", "혈당 120", "혈당 180이야"
  let glucoseMatch = voiceText.match(/혈당[은이가는의]?\s*(?:수치[가는은이]?\s*)?(\d{2,3})/);
  if (!glucoseMatch) glucoseMatch = voiceText.match(/(\d{2,3})\s*나왔어/);
  const glucoseValue = glucoseMatch ? parseInt(glucoseMatch[1]) : undefined;

  // 측정 타입 감지: 더 구체적인 패턴을 먼저 검사해야 함
  let detectedMeasType: MeasurementType = 'random';
  if (voiceText.includes('공복')) detectedMeasType = 'fasting';
  else if (voiceText.includes('식후 2시간') || voiceText.includes('식후2시간')) detectedMeasType = 'postmeal_2h';
  else if (voiceText.includes('식후 30분') || voiceText.includes('식후30분')) detectedMeasType = 'postmeal_30m';
  else if (voiceText.includes('식후 1시간') || voiceText.includes('식후1시간') || voiceText.includes('식후')) detectedMeasType = 'postmeal_1h';

  // 간단한 시간 맥락 파싱 (아침, 점심, 저녁)
  let detectedTime: string | undefined;
  if (voiceText.includes('아침')) detectedTime = '08:00';
  else if (voiceText.includes('점심')) detectedTime = '12:30';
  else if (voiceText.includes('저녁')) detectedTime = '19:00';

  if (foundFoods.length > 0) {
    const parsedFoods = foundFoods.map(f => {
      const base = KOREAN_FOOD_DB[f.foodKey];
      // 간단한 수량 매칭
      const qtyInfo = extractQuantity(voiceText);
      return {
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: base.name,
        quantity: qtyInfo.quantity,
        unit: qtyInfo.unit,
        carbs: base.carbs,
        calories: base.calories,
        glycemicIndex: base.glycemicIndex,
        protein: base.protein,
        fat: base.fat,
        sodium: base.sodium
      };
    });

    return {
      rawText: voiceText,
      parsedFoods,
      glucoseValue,
      detectedMeasType,
      detectedTime,
      confidenceScore: 0.6,
      needsClarification: false,
    };
  }

  // If even local parser couldn't find foods but found glucose:
  if (glucoseValue) {
    return {
      rawText: voiceText,
      parsedFoods: [],
      glucoseValue,
      detectedMeasType,
      confidenceScore: 0.8,
      needsClarification: false,
    };
  }

  // 음식도 혈당도 못 찾았어도 fuzzy 후보가 있다면 UI에서 chip으로 제시할 수 있도록 반환
  const fuzzyFallback = fuzzyFindCandidates(voiceText, 3);
  const topCandidates = fuzzyFallback.length > 0
    ? fuzzyFallback.map(c => ({
        name: c.foodKey,
        confidence: Math.max(0.2, 1 - c.distance / 4),
        reason: `자모거리 ${c.distance}`,
      }))
    : undefined;

  return {
    rawText: voiceText,
    parsedFoods: [],
    confidenceScore: 0,
    needsClarification: true,
    clarificationQuestion: topCandidates
      ? '혹시 이 중 하나였나요? 아래 후보를 눌러서 골라주세요.'
      : '죄송해요, 조금 더 구체적으로 음식 이름이나 혈당 수치를 말씀해 주시겠어요?',
    topCandidates,
  };
}

/**
 * 음식명으로 로컬 DB(+별칭)에서 영양정보를 조회한다.
 * 서버 응답에 없는 후보(Top-3 chip tap 등)에 사용.
 */
export function lookupFoodByName(name: string): Omit<FoodItem, 'id' | 'quantity'> | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (KOREAN_FOOD_DB[trimmed]) return KOREAN_FOOD_DB[trimmed];
  const aliasTarget = FOOD_ALIASES[trimmed] || FOOD_ALIASES[trimmed.replace(/\s+/g, '')];
  if (aliasTarget && KOREAN_FOOD_DB[aliasTarget]) return KOREAN_FOOD_DB[aliasTarget];
  // 자모 거리 기반 최근접 키 하나 시도
  const fuzzy = fuzzyFindCandidates(trimmed, 1);
  if (fuzzy.length > 0 && fuzzy[0].distance <= 1) {
    return KOREAN_FOOD_DB[fuzzy[0].foodKey] ?? null;
  }
  return null;
}

export type { VoiceParseResult };

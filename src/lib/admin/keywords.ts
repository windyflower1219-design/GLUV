/**
 * GLUV — 관리자 쇼핑 연동 키워드 (공유 모듈)
 *
 * - admin 페이지에서 편집한 키워드를 localStorage에 저장
 * - insights 페이지가 같은 모듈을 import해서 동일한 키워드를 사용
 *
 * 키워드는 영양소 "key" (영문 식별자) 기준으로 매핑되며, insights의 deficiency 룰이
 * 같은 key를 emit하면 admin이 설정한 query가 그대로 쇼핑 링크에 사용됨.
 */

export type NutrientKey =
  | 'protein'        // 단백질
  | 'fiber'          // 식이섬유 / 채소
  | 'lowSugar'       // 저당 간식 (혈당 스파이크 억제용 대체 간식)
  | 'complexCarb'    // 복합 탄수 (정제 탄수 줄이고 통곡물 증가)
  | 'lateNightSnack' // 야식 대용 (저당 단백 위주)
  | 'lowSodium'      // 저염 (나트륨 과다 시)
  | 'omega3'         // 오메가3 (등푸른 생선·견과)
  | 'vitaminD'       // 비타민D
  | 'calcium'        // 칼슘
  | 'magnesium'      // 마그네슘
  | 'iron'           // 철분
  | 'general';       // 일반 (기본 검색어)

export interface KeywordEntry {
  key: NutrientKey;
  label: string;   // 한글 표시명
  query: string;   // 쇼핑 검색어
  emoji?: string;
}

export const DEFAULT_KEYWORDS: KeywordEntry[] = [
  { key: 'protein',        label: '단백질',     query: '닭가슴살 샐러드 도시락',     emoji: '🍗' },
  { key: 'fiber',          label: '식이섬유',   query: '데친 채소 모음 야채 박스',   emoji: '🥦' },
  { key: 'lowSugar',       label: '저당간식',   query: '스테비아 토마토 무가당 견과', emoji: '🍅' },
  { key: 'complexCarb',    label: '복합탄수',   query: '귀리 오트밀 현미밥',         emoji: '🌾' },
  { key: 'lateNightSnack', label: '야식 대용',  query: '저당 그릭요거트 단백질바',   emoji: '🌙' },
  { key: 'lowSodium',      label: '저염',       query: '저염 김치 저염 간장',        emoji: '🧂' },
  { key: 'omega3',         label: '오메가3',    query: '연어 등푸른 생선 호두',      emoji: '🐟' },
  { key: 'vitaminD',       label: '비타민D',    query: '비타민D 영양제 연어',        emoji: '☀️' },
  { key: 'calcium',        label: '칼슘',       query: '멸치 우유 그릭요거트',       emoji: '🦴' },
  { key: 'magnesium',      label: '마그네슘',   query: '시금치 아몬드 케일',         emoji: '🥬' },
  { key: 'iron',           label: '철분',       query: '소고기 시금치 철분제',       emoji: '🩸' },
  { key: 'general',        label: '일반',       query: '저당 다이어트 식단',         emoji: '🛒' },
];

const STORAGE_KEY = 'gluv:adminKeywords:v1';

/** 관리자 키워드 로드 — localStorage 우선, 없으면 기본값. */
export function loadKeywords(): KeywordEntry[] {
  if (typeof window === 'undefined') return DEFAULT_KEYWORDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYWORDS;
    const parsed = JSON.parse(raw) as KeywordEntry[];

    // 기본값과 병합: 새로 추가된 nutrient key가 누락돼도 보충됨
    const map = new Map<NutrientKey, KeywordEntry>();
    DEFAULT_KEYWORDS.forEach(k => map.set(k.key, k));
    if (Array.isArray(parsed)) {
      parsed.forEach(k => {
        if (k && k.key) map.set(k.key, { ...map.get(k.key), ...k } as KeywordEntry);
      });
    }
    // 기본 순서를 유지하기 위해 DEFAULT_KEYWORDS 순서로 재구성
    return DEFAULT_KEYWORDS.map(d => map.get(d.key)!).filter(Boolean);
  } catch {
    return DEFAULT_KEYWORDS;
  }
}

export function saveKeywords(keywords: KeywordEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
  } catch {}
}

/** 특정 영양소의 검색어를 가져온다. 없으면 fallback 또는 일반 검색어. */
export function queryFor(key: NutrientKey, fallback?: string): string {
  const list = loadKeywords();
  const hit = list.find(k => k.key === key);
  if (hit?.query) return hit.query;
  if (fallback) return fallback;
  return list.find(k => k.key === 'general')?.query || '저당 다이어트 식단';
}

/** 라벨도 함께 받고 싶을 때 */
export function entryFor(key: NutrientKey): KeywordEntry {
  const list = loadKeywords();
  return list.find(k => k.key === key)
      || DEFAULT_KEYWORDS.find(k => k.key === key)!;
}

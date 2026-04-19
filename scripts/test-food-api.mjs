// scripts/test-food-api.mjs
// 전국통합식품영양성분정보 공공데이터 API 연동 테스트
//
// 사용법 (PC의 GLUV 루트 폴더에서):
//   node scripts/test-food-api.mjs
//
// .env.local 의 FOOD_API_KEY 를 그대로 사용해서 실제 API 를 호출하고,
// parse-meal 라우트가 읽는 필드(enerc, chocdf, prt, fatce, nat)를 그대로 검증합니다.

import fs from 'node:fs';
import path from 'node:path';

// 1) .env.local 에서 키 로드
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('[FAIL] .env.local 파일을 찾을 수 없습니다. GLUV 루트 폴더에서 실행해주세요.');
  process.exit(1);
}
const envRaw = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const apiKey = env.FOOD_API_KEY;
const baseUrl = env.FOOD_API_BASE_URL || 'https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api';
if (!apiKey) {
  console.error('[FAIL] .env.local 에 FOOD_API_KEY 가 없습니다.');
  process.exit(1);
}
console.log('[INFO] FOOD_API_KEY 길이:', apiKey.length);
console.log('[INFO] BASE_URL:', baseUrl);

// 2) 테스트 대상 음식들 (한국 대표 음식 + 일반 식재료 혼합)
const testFoods = ['사과', '바나나', '우유', '김치', '쌀밥', '닭가슴살', '고구마', '계란'];

let successCount = 0;
let emptyCount = 0;
let errorCount = 0;

for (const foodName of testFoods) {
  const url = `${baseUrl}?serviceKey=${apiKey}&pageNo=1&numOfRows=1&type=json&foodNm=${encodeURIComponent(foodName)}`;
  console.log('\n' + '='.repeat(60));
  console.log('[REQUEST]', foodName);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    console.log('  HTTP status:', res.status);

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // 공공데이터포털 이 가끔 XML 에러(SERVICE_KEY_IS_NOT_REGISTERED_ERROR)로 떨어짐
      console.log('  [PARSE FAIL] 응답이 JSON 이 아닙니다. 앞 200자:');
      console.log('  ' + text.slice(0, 200));
      errorCount++;
      continue;
    }

    const header = json?.response?.header;
    const items = json?.response?.body?.items;
    console.log('  resultCode:', header?.resultCode, '/ resultMsg:', header?.resultMsg);
    console.log('  totalCount:', json?.response?.body?.totalCount);

    // resultCode 03 = NODATA_ERROR → 키는 정상, 그 이름으로 매칭되는 행만 없음. 폴백 분기.
    if (header?.resultCode === '03') {
      console.log('  [EMPTY] DB에 해당 이름으로 등록된 항목 없음. Gemini 추정치로 폴백됩니다.');
      emptyCount++;
      continue;
    }
    // 그 외 non-zero 코드는 진짜 에러 (키 미등록=30, 쿼터 초과=22 등)
    if (header?.resultCode && header.resultCode !== '00' && header.resultCode !== '0') {
      console.log('  [API ERROR] 키 미등록/쿼터 초과 등 실제 에러입니다.');
      errorCount++;
      continue;
    }

    if (!items || items.length === 0) {
      console.log('  [EMPTY] DB에 해당 음식이 없어요. Gemini 추정치로 폴백됩니다.');
      emptyCount++;
      continue;
    }

    const item = items[0];
    const parsed = {
      name: item.foodNm,
      enerc: parseFloat(item.enerc || item.nutr_cont1),    // kcal
      chocdf: parseFloat(item.chocdf || item.nutr_cont2),  // 탄수화물(g)
      prt: parseFloat(item.prt || item.nutr_cont3),        // 단백질(g)
      fatce: parseFloat(item.fatce || item.nutr_cont4),    // 지방(g)
      nat: parseFloat(item.nat || item.nutr_cont6),        // 나트륨(mg)
    };
    console.log('  [OK]', JSON.stringify(parsed));
    successCount++;
  } catch (e) {
    console.log('  [NETWORK ERROR]', e.message);
    errorCount++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('테스트 결과');
console.log('  성공(실제 DB 매칭):', successCount, '/', testFoods.length);
console.log('  DB에 없음(폴백 사용):', emptyCount);
console.log('  에러/네트워크 실패:', errorCount);

if (successCount > 0) {
  console.log('\n[VERIFIED] FOOD_API 연동 정상 동작. parse-meal 라우트에서 enerc/chocdf 필드 활용 가능.');
} else if (emptyCount === testFoods.length) {
  console.log('\n[WARNING] API는 살아있지만 모든 테스트 음식에 대해 빈 결과. foodNm 파라미터 형식을 점검하세요.');
} else {
  console.log('\n[FAIL] API 연동 실패. 키 활성화 대기중이거나 URL/파라미터 오류.');
}

import { NextResponse } from 'next/server';

export async function GET() {
  // Production 환경에서는 디버그 정보를 노출하지 않음 (404 응답)
  // 로컬 개발 환경(npm run dev)에서만 동작합니다.
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.json({
    geminiKeyExists: !!process.env.GEMINI_API_KEY || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    openaiKeyExists: !!process.env.OPENAI_API_KEY || !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    firebaseKeyExists: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    foodApiKeyExists: !!process.env.FOOD_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}

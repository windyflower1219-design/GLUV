import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    geminiKeyExists: !!process.env.GEMINI_API_KEY || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    openaiKeyExists: !!process.env.OPENAI_API_KEY || !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    firebaseKeyExists: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  const results: any = {
    env: process.env.NODE_ENV,
    geminiKeyExists: !!geminiKey,
    geminiKeyLength: geminiKey?.length,
    geminiKeyPrefix: geminiKey?.substring(0, 8),
    firebaseKeyExists: !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    openaiKeyExists: !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
  };

  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });
      const testResult = await model.generateContent('Say "OK"');
      results.geminiTest = 'SUCCESS: ' + testResult.response.text().trim();
    } catch (err: any) {
      results.geminiTest = 'FAILED: ' + (err.message || String(err));
    }
  }

  return NextResponse.json(results);
}

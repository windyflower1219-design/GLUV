import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  const results: any = {
    env: process.env.NODE_ENV,
    geminiKeyExists: !!geminiKey,
    geminiKeyLength: geminiKey?.length,
    geminiKeyPrefix: geminiKey?.substring(0, 8),
  };

  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      
      // 1. 모델 리스트 조회 테스트
      try {
        // SDK 버전에 따라 listModels 위치가 다를 수 있음
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`);
        const data = await response.json();
        results.availableModels = data.models?.map((m: any) => m.name) || [];
      } catch (listErr: any) {
        results.listModelsError = listErr.message;
      }

      // 2. 직접 호출 테스트 (실제 사용 모델과 일치: parse-meal/insights는 gemma-3-27b-it 사용)
      const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' }, { apiVersion: 'v1beta' });
      const testResult = await model.generateContent('Say "OK"');
      results.geminiTest = 'SUCCESS: ' + testResult.response.text().trim();
    } catch (err: any) {
      results.geminiTest = 'FAILED: ' + (err.message || String(err));
    }
  }

  return NextResponse.json(results);
}

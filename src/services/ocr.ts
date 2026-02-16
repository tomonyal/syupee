import * as FileSystem from 'expo-file-system/legacy';
import { AZURE_CONFIG } from './config';
import { OCRResult } from '../types';

/**
 * Azure AI Vision を使ってレシート画像からテキストを抽出する
 */
export async function recognizeReceipt(imageUri: string): Promise<OCRResult> {
  const { endpoint, apiKey } = AZURE_CONFIG;

  if (!endpoint || !apiKey) {
    throw new Error('Azure Vision APIの設定が不足しています');
  }

  // 画像をBase64に変換
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const imageBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Azure Computer Vision - Read API
  const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze`;

  const submitResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: imageBuffer,
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Azure OCR送信エラー: ${submitResponse.status} - ${error}`);
  }

  // 結果のURLを取得
  const operationLocation = submitResponse.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('Azure OCR: Operation-Locationが見つかりません');
  }

  // ポーリングで結果を待つ
  let result: any = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);

    const pollResponse = await fetch(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    result = await pollResponse.json();

    if (result.status === 'succeeded') break;
    if (result.status === 'failed') {
      throw new Error('Azure OCR: 処理に失敗しました');
    }
  }

  if (!result || result.status !== 'succeeded') {
    throw new Error('Azure OCR: タイムアウト');
  }

  // テキストを抽出
  const lines: string[] = [];
  let totalConfidence = 0;
  let wordCount = 0;

  for (const readResult of result.analyzeResult.readResults) {
    for (const line of readResult.lines) {
      lines.push(line.text);
      for (const word of line.words) {
        totalConfidence += word.confidence;
        wordCount++;
      }
    }
  }

  return {
    rawText: lines.join('\n'),
    confidence: wordCount > 0 ? totalConfidence / wordCount : 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

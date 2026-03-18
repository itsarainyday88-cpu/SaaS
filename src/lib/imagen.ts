import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from './supabase';

/**
 * Generates an image using Gemini Imagen 3 (Nano Banana Pro) via REST API.
 * Saves the image to public/generated-images and returns the public URL.
 */
export async function generateAndSaveImage(prompt: string, excludedPaths: string[] = [], workspaceId?: string): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.IMAGEN_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is missing');
        // Return null to frontend, frontend should handle "Image Gen Failed"
        return null;
    }

    // Clean up prompt (remove potential markdown artifacts if passed)
    let cleanPrompt = prompt.replace(/> \*\*Nano Banana Prompt:\*\*/g, '').trim();

    // POLICY CHECK: Should we skip AI generation for real-world assets? (Tag must be present for check)
    const { getImagePolicy } = await import('@/lib/image-policy');
    const policy = getImagePolicy(cleanPrompt, excludedPaths);

    // CLEAN UP: Extract only the description string from [IMAGE_GENERATE: <description>] if it exists
    const imageGenerateMatch = cleanPrompt.match(/\[IMAGE_GENERATE:\s*([^\]]+)\]/i);
    if (imageGenerateMatch && imageGenerateMatch[1]) {
        cleanPrompt = imageGenerateMatch[1].trim();
    }

    // [🚨 Coding-Level Text Blocking] 
    // 프롬프트 내에 'text', 'korean text', 'letters' 등 텍스트 생성을 유도하는 키워드가 있으면 강제 삭제
    cleanPrompt = cleanPrompt.replace(/(display(s)?\s+)?(the\s+)?(korean\s+)?text\s+(['"]?.*['"]?)/gi, '');
    cleanPrompt = cleanPrompt.replace(/with\s+(a\s+)?(neon\s+)?sign\s+that\s+displays.*/gi, '');
    cleanPrompt = cleanPrompt.replace(/text|letter|signage|word/gi, '');

    // Also remove the standalone [FORCE_GENERATE] tag if it still exists
    cleanPrompt = cleanPrompt.replace(/\[FORCE_GENERATE\]/gi, '').trim();

    if (!policy.shouldGenerate) {
        console.log(`[Policy] Skipping AI generation. Reason: ${policy.reason}`);
        return policy.selectedImagePath || null;
    }


    // FORCE KOREAN CONTEXT INJECTION (Software Level Override)
    // 에이전트가 깜빡해도 무조건 한국인, 한국 비즈니스 배경이 나오도록 강제 주입
    const visuals = "Photographic style. High quality. NO TEXT. Korean ethnicity people only. Modern Seoul Korean Workspace interior. Asian students with black hair. High-end Korean environment. ";

    const finalPrompt = visuals + cleanPrompt + " :: Do not include any text, signs, or watermarks. NO Western features, NO Caucasian, NO non-Asian.";

    console.log(`[Imagen] Generating image for: "${finalPrompt.substring(0, 50)}..."`);

    async function callImagenApi(promptToUse: string, modelName: string): Promise<string | null> {
        let url = '';
        let requestBody: any = {};

        if (modelName.startsWith('imagen')) {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
            requestBody = {
                instances: [{ prompt: promptToUse }],
                parameters: { sampleCount: 1, outputOptions: { mimeType: "image/png" } }
            };
        } else {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            requestBody = {
                contents: [{ parts: [{ text: promptToUse }] }],
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
                return data.predictions[0].bytesBase64Encoded;
            }

            const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
            if (part && part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }

            return null;

        } catch (e: any) {
            return null;
        }
    }

    try {
        const modelOrder = [
            'imagen-4.0-ultra-generate-001',
            'imagen-4.0-generate-001',
            'imagen-4.0-fast-generate-001',
            'gemini-3-pro-image-preview',
            'gemini-3.1-flash-image-preview'
        ];

        let base64Data = null;
        for (const modelId of modelOrder) {
            base64Data = await callImagenApi(finalPrompt, modelId);
            if (base64Data) break;
        }

        if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const hash = crypto.createHash('md5').update(cleanPrompt + Date.now().toString()).digest('hex').substring(0, 8);
            
            // 🛡️ [마이그레이션] workspace_id 별 버킷 접두사 분배 처리
            const prefix = workspaceId ? `${workspaceId}_` : '';
            const filename = `${prefix}${Date.now()}-${hash}.png`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('images')
                .getPublicUrl(filename);

            return data.publicUrl;
        } else {
            // 🛡️ [스마트 폴백] 모든 엔진 고장 시, 해당 워크스페이스(고객사)가 기존에 생성해둔 사진을 랜덤으로 재활용
            if (workspaceId) {
                try {
                    const { data: files } = await supabase.storage.from('images').list('', { limit: 100 });
                    if (files && files.length > 0) {
                        const workspaceFiles = files.filter(f => f.name.startsWith(`${workspaceId}_`));
                        if (workspaceFiles.length > 0) {
                            const randomFile = workspaceFiles[Math.floor(Math.random() * workspaceFiles.length)];
                            const { data } = supabase.storage.from('images').getPublicUrl(randomFile.name);
                            console.log(`[Imagen] Fallback to previous image: ${randomFile.name}`);
                            return data.publicUrl;
                        }
                    }
                } catch { /* 백업 에러 처리 */ }
            }
            const { getFallbackImage } = await import('@/lib/image-policy');
            return getFallbackImage(cleanPrompt, excludedPaths);
        }
    } catch (error: any) {
        if (workspaceId) {
            try {
                const { data: files } = await supabase.storage.from('images').list('', { limit: 100 });
                if (files && files.length > 0) {
                    const workspaceFiles = files.filter(f => f.name.startsWith(`${workspaceId}_`));
                    if (workspaceFiles.length > 0) {
                        const randomFile = workspaceFiles[Math.floor(Math.random() * workspaceFiles.length)];
                        return supabase.storage.from('images').getPublicUrl(randomFile.name).data.publicUrl;
                    }
                }
            } catch {}
        }
        const { getFallbackImage } = await import('@/lib/image-policy');
        return getFallbackImage(cleanPrompt, excludedPaths);
    }
}

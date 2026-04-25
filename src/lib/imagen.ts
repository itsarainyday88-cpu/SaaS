import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from './supabase';

/**
 * Generates an image using Gemini Imagen 3 (Nano Banana Pro) via REST API.
 * Saves the image to public/generated-images and returns the public URL.
 */
export async function generateAndSaveImage(prompt: string, excludedPaths: string[] = []): Promise<string | null> {
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
    const visuals = "Photographic style. High quality. NO TEXT. Korean ethnicity people only. Modern Seoul Korean Workspace (Hagwon) interior. Asian students with black hair. High-end Korean education environment. ";

    const finalPrompt = visuals + cleanPrompt + " :: Do not include any text, signs, or watermarks. NO Western features, NO Caucasian, NO non-Asian, NO European style library.";

    console.log(`[Imagen] Generating image for: "${finalPrompt.substring(0, 50)}..."`);

    async function callImagenApi(promptToUse: string, modelName: string): Promise<string | null> {
        // [Logic Branch]
        // In AI Studio, direct image generation models might need different URL structures depending on their type.
        // Assuming gemini-* models use generateContent and imagen-* models use predict (standard vertex/studio behavior)
        let url = '';
        let requestBody: any = {};

        if (modelName.startsWith('imagen')) {
            // Standard Imagen API format (Often uses different endpoint or payload)
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
            requestBody = {
                instances: [{ prompt: promptToUse }],
                parameters: { sampleCount: 1, outputOptions: { mimeType: "image/png" } }
            };
        } else {
            // Gemini format (e.g., gemini-3.1-flash-image-preview)
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
                const errorText = await response.text();
                console.error(`[Imagen] API Error (${modelName}):`, response.status, errorText);
                return null;
            }

            const data = await response.json();

            // 1. Check for Imagen standard response format
            if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
                return data.predictions[0].bytesBase64Encoded;
            }

            // 2. Extract Base64 from Gemini/Imagen response format
            // Most recent models return inlineData inside candidates[0].content.parts
            const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
            if (part && part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }

            console.error(`[Imagen] No image data in response (${modelName})`);
            return null;

        } catch (e: any) {
            console.error(`[Imagen] Call Failed (${modelName}):`, e.message);
            return null;
        }
    }

    try {
        // [UPDATE] Prioritize Imagen 4 and specialized latest models
        const modelOrder = [
            'imagen-4.0-ultra-generate-001',
            'imagen-4.0-generate-001',
            'imagen-4.0-fast-generate-001',
            'gemini-3-pro-image-preview',
            'gemini-3.1-flash-image-preview',
            'gemini-2.5-flash-image'
        ];

        let base64Data = null;
        for (const modelId of modelOrder) {
            console.log(`[Imagen] Trying engine: ${modelId}...`);
            base64Data = await callImagenApi(finalPrompt, modelId);
            if (base64Data) break;
        }

        // If successful, save file to Supabase Storage
        if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const hash = crypto.createHash('md5').update(cleanPrompt + Date.now().toString()).digest('hex').substring(0, 8);
            const filename = `${Date.now()}-${hash}.png`;

            // 1. Supabase Storage 'images' 버킷에 업로드
            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('[Imagen] Supabase Storage upload failed:', uploadError.message);
                throw uploadError;
            }

            // 2. 외부에서 접근 가능한 Public URL 추출
            const { data } = supabase.storage
                .from('images')
                .getPublicUrl(filename);

            console.log(`[Imagen] Saved to Supabase Storage: ${data.publicUrl}`);
            return data.publicUrl;
        } else {
            console.log('[Imagen] All engines failed. Returning fallback from Policy Engine.');
            const { getFallbackImage } = await import('@/lib/image-policy');
            return getFallbackImage(cleanPrompt, excludedPaths);
        }
    } catch (error: any) {
        console.error('[Imagen] Critical Error:', error.message);
        const { getFallbackImage } = await import('@/lib/image-policy');
        return getFallbackImage(cleanPrompt, excludedPaths);
    }
}

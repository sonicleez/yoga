/**
 * IMAGE GENERATOR — Multi-Provider Support
 * 
 * Provider 1: Google AI Direct (generativelanguage.googleapis.com)
 *   - Model: gemini-3.1-flash-image-preview
 *   - Auth: API key in URL param
 *   - Response: inline base64 image
 * 
 * Provider 2: Vertex Key (vertex-key.com)
 *   - Models: gemini-image-1k/2k/4k, gemini-3.1-flash-image-*
 *   - Auth: Bearer token (vai-...)
 *   - Endpoint: /api/v1/images/generations
 *   - Response: url or b64_json
 *   - Also: /api/v1/chat/completions for AI analysis
 */

// ============================================================
// API ROUTING (via proxy)
// Dev: Vite proxy handles /api/* → external APIs
// Prod: Vercel serverless functions handle /api/* → external APIs
// ============================================================

const GOOGLE_AI_BASE = '/api/google-ai/v1beta/models';
const VERTEX_KEY_BASE = '/api/vertex-key/api/v1';
const GOMMO_BASE = '/api/gommo';

// ============================================================
// PROVIDER DEFINITIONS
// ============================================================

export const PROVIDERS = {
    'google-ai': {
        name: 'Google AI Direct',
        description: 'Google Generative AI API trực tiếp',
        keyPrefix: 'AIza',
        keyPlaceholder: 'AIzaSy...',
        models: {
            'gemini-3.1-flash-image-preview': {
                name: 'Gemini 3.1 Flash Image Preview',
                resolution: 'Auto',
                price: 'Free tier / Pay-as-you-go',
            },
        },
    },
    'vertex-key': {
        name: 'Vertex Key',
        description: 'Vertex Key API Gateway (vertex-key.com)',
        keyPrefix: 'vai-',
        keyPlaceholder: 'vai-your-api-key-here',
        models: {
            'gemini-image-1k': {
                name: 'Gemini Image Preview 1K',
                resolution: '1408×768',
                price: '$0.36/req',
            },
            'gemini-image-2k': {
                name: 'Gemini Image Preview 2K ⭐',
                resolution: '2816×1536',
                price: '$0.45/req',
                recommended: true,
            },
            'gemini-image-4k': {
                name: 'Gemini Image Preview 4K',
                resolution: '5632×3072',
                price: '$0.50/req',
            },
            'gemini-2.5-flash-image': {
                name: 'Gemini 2.5 Flash Image',
                resolution: '1024×1024',
                price: '$0.25/req',
                fast: true,
            },
            'gemini-3.1-flash-image-1k': {
                name: 'Gemini 3.1 Flash Image 1K ⚡',
                resolution: '1408×768',
                price: '$0.40/req',
                fast: true,
            },
            'gemini-3.1-flash-image-2k': {
                name: 'Gemini 3.1 Flash Image 2K ⚡',
                resolution: '2816×1536',
                price: '$0.55/req',
                fast: true,
            },
        },
    },
    'gommo': {
        name: 'Gommo AI (Google Nano)',
        description: 'Gommo API cho Google Nano Banana, Z-Image, Kling',
        keyPrefix: '',
        keyPlaceholder: 'domain.net|access_token',
        models: {
            'google_nano_banana_pro': {
                name: 'Google Nano Banana Pro ⭐',
                resolution: '1K',
                price: '1 credit',
                recommended: true,
            },
            'google_nano_banana_2': {
                name: 'Google Nano Banana 2',
                resolution: '1K',
                price: '1 credit',
            },
            'z-image': {
                name: 'Z-Image',
                resolution: '1K',
                price: '1 credit',
            },
            'kling-o1': {
                name: 'Kling O1',
                resolution: '1K',
                price: '1 credit',
            },
        },
    },
};

// Vertex Key analysis models (for AI-enhanced prompts)
export const ANALYSIS_MODELS = {
    'flash/claude-sonnet-4-6': {
        name: 'Claude Sonnet 4.6 ⚡',
        provider: 'Anthropic',
        price: '$3/$15 per 1M',
    },
    'gem/gemini-3.1-pro-preview': {
        name: 'Gemini 3.1 Pro ⭐',
        provider: 'Google',
        price: '$3/$18 per 1M',
    },
    'gem/gemini-3-flash-nothinking': {
        name: 'Gemini 3 Flash (Fast)',
        provider: 'Google',
        price: '$1/$6 per 1M',
        cheap: true,
    },
};

// ============================================================
// MAIN: Generate Image (routes to correct provider)
// ============================================================

/**
 * @param {string} prompt 
 * @param {string} apiKey
 * @param {Object} options - { provider, model, aspectRatio, imageSize, referenceImages }
 * @returns {Promise<{base64: string|null, blobUrl: string, imageUrl: string|null}>}
 */
export async function generateImage(prompt, apiKey, options = {}) {
    const provider = options.provider || detectProvider(apiKey);
    console.log(`🖼️ [ImageGen] generateImage() → Provider: ${provider}, Model: ${options.model || 'default'}`);
    console.log(`🖼️ [ImageGen] Prompt (${prompt.length} chars): "${prompt.substring(0, 100)}..."`);
    if (options.referenceImages?.length) {
        console.log(`🖼️ [ImageGen] Character reference images: ${options.referenceImages.length} provided`);
    }
    if (options.environmentImages?.length) {
        console.log(`🏞️ [ImageGen] Environment reference images: ${options.environmentImages.length} provided`);
    }

    if (provider === 'vertex-key') {
        return generateImageVertexKey(prompt, apiKey, options);
    } else if (provider === 'gommo') {
        return generateImageGommo(prompt, apiKey, options);
    }
    return generateImageGoogleAI(prompt, apiKey, options);
}

/**
 * Verify API key for a provider
 */
export async function verifyApiKey(apiKey, provider = null) {
    const prov = provider || detectProvider(apiKey);

    if (prov === 'gommo') {
        console.log('🔍 [Verify] Gommo API Key...');
        let domain = '10xyoutube.net';
        let token = apiKey;
        if (apiKey.includes('|')) {
            const parts = apiKey.split('|');
            domain = parts[0];
            token = parts.slice(1).join('|');
        }

        const body = new URLSearchParams();
        body.append('access_token', token);
        body.append('domain', domain);

        try {
            const res = await fetch(`${GOMMO_BASE}/api/apps/go-mmo/ai/me`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const data = await res.json();

            if (!res.ok || data.error || !data.userInfo) {
                let errStr = data.message || data.error || 'Failed to authenticate';
                return { valid: false, message: `Gommo Error: ${errStr}` };
            }

            const aiC = data.balancesInfo?.credits_ai ?? 0;
            return { valid: true, message: `Success! Balance: ${aiC.toLocaleString()} AI credits` };
        } catch (err) {
            return { valid: false, message: `Request Error: ${err.message}` };
        }
    }

    // For Vertex Key and Google AI, no direct balance check endpoint implemented yet
    if (prov === 'vertex-key') {
        return { valid: true, message: 'Google/Vertex APIs do not support direct balance check yet. Assume valid.' };
    }

    return { valid: true, message: 'API key format valid. Try generating.' };
}

/**
 * Auto-detect provider from API key format
 */
function detectProvider(apiKey) {
    if (apiKey.includes('|')) return 'gommo';
    if (apiKey.startsWith('vai-')) return 'vertex-key';
    return 'google-ai';
}

// ============================================================
// PROVIDER 1: Google AI Direct
// ============================================================

async function generateImageGoogleAI(prompt, apiKey, options = {}) {
    const {
        model = 'gemini-3.1-flash-image-preview',
        aspectRatio = '16:9',
        imageSize = '2K',
        referenceImages = [],
        environmentImages = [],
    } = options;

    console.group(`🌐 [GoogleAI] generateImageGoogleAI()`);
    console.log(`📋 Model: ${model} | AR: ${aspectRatio} | Size: ${imageSize}`);
    console.log(`📎 Character refs: ${referenceImages.length} | Env refs: ${environmentImages.length}`);
    console.time('⏱️ GoogleAI API call');

    const API_BASE = GOOGLE_AI_BASE;

    // Build parts — character references first, then env, then prompt
    const parts = [];

    // Add character reference images
    for (const refImg of referenceImages) {
        parts.push({ text: 'Character reference image — keep this character appearance exactly consistent:' });
        parts.push({
            inline_data: { mime_type: 'image/png', data: refImg },
        });
    }

    // Add environment reference images
    for (const envImg of environmentImages) {
        parts.push({ text: 'Environment/background reference image — MUST reproduce this exact same environment, lighting, colors, floor, and background elements:' });
        parts.push({
            inline_data: { mime_type: 'image/png', data: envImg },
        });
    }

    // Build final prompt with environment consistency instruction
    let finalPrompt = prompt;
    if (environmentImages.length > 0) {
        finalPrompt = `CRITICAL REQUIREMENT: The environment, background, lighting, floor/mat, and all surroundings MUST exactly match the provided environment reference image(s). Only the character's pose should change — the setting must remain identical. \n\n${prompt}`;
    }
    parts.push({ text: finalPrompt });

    const body = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ['IMAGE'],
        },
    };

    if (aspectRatio || imageSize) {
        body.generationConfig.imageConfig = {};
        if (aspectRatio) body.generationConfig.imageConfig.aspectRatio = aspectRatio;
        if (imageSize) body.generationConfig.imageConfig.imageSize = imageSize;
    }

    const url = `${API_BASE}/${model}:generateContent?key=${apiKey.substring(0, 8)}...`;
    console.log(`🔗 [GoogleAI] URL: ${url}`);

    const response = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    console.log(`📡 [GoogleAI] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`❌ [GoogleAI] Error response:`, error);
        console.timeEnd('⏱️ GoogleAI API call');
        console.groupEnd();
        
        // Detect common proxy/Vercel errors
        if (response.status === 413) {
            throw new Error('Request payload too large. Try removing some reference images or reducing image sizes.');
        }
        if (response.status === 502 || response.status === 504) {
            throw new Error(`Proxy timeout (${response.status}). The image generation took too long. Try again or use a faster model.`);
        }
        throw new Error(error?.error?.message || `Google AI error: ${response.status}`);
    }

    const data = await response.json();
    const candidates = data.candidates || [];
    if (candidates.length === 0) {
        console.error('❌ [GoogleAI] No candidates in response');
        console.timeEnd('⏱️ GoogleAI API call');
        console.groupEnd();
        throw new Error('No image generated');
    }

    const partsOut = candidates[0].content?.parts || [];
    const imagePart = partsOut.find(p => p.inlineData);
    if (!imagePart) {
        const textPart = partsOut.find(p => p.text);
        console.error('❌ [GoogleAI] No image part found, text response:', textPart?.text);
        console.timeEnd('⏱️ GoogleAI API call');
        console.groupEnd();
        throw new Error(textPart?.text || 'No image in response');
    }

    const base64 = imagePart.inlineData.data;
    console.log(`✅ [GoogleAI] Image received: ${Math.round(base64.length / 1024)}KB base64`);
    console.timeEnd('⏱️ GoogleAI API call');
    console.groupEnd();
    return { base64, blobUrl: base64ToBlobUrl(base64), imageUrl: null };
}

// ============================================================
// PROVIDER 2: Vertex Key
// ============================================================

async function generateImageVertexKey(prompt, apiKey, options = {}) {
    const {
        model = 'gemini-image-2k',
        referenceImages = [],
        environmentImages = [],
    } = options;

    console.group(`🔑 [VertexKey] generateImageVertexKey()`);
    console.log(`📋 Model: ${model}`);
    console.log(`📋 Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);
    console.log(`📎 Character refs: ${referenceImages.length} | Env refs: ${environmentImages.length}`);
    console.time('⏱️ VertexKey API call');

    const VERTEX_BASE = VERTEX_KEY_BASE;

    // Build messages — use chat completions (not /images/generations which hangs/502s)
    const messages = [];

    // Add character reference images if provided (for character consistency)
    if (referenceImages.length > 0) {
        const refContent = [
            { type: 'text', text: 'Use this character reference for visual consistency in the generated image:' },
        ];
        for (const ref of referenceImages) {
            refContent.push({
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${ref}` },
            });
        }
        messages.push({ role: 'user', content: refContent });
        messages.push({ role: 'assistant', content: 'I will use this character as reference for the generated image.' });
    }

    // Add environment reference images if provided (for background consistency)
    if (environmentImages.length > 0) {
        const envContent = [
            { type: 'text', text: 'Environment/background reference. You MUST reproduce this EXACT same environment — same room, floor, mat, lighting, colors, and all background elements. Only the character pose changes, the setting stays identical:' },
        ];
        for (const envImg of environmentImages) {
            envContent.push({
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${envImg}` },
            });
        }
        messages.push({ role: 'user', content: envContent });
        messages.push({ role: 'assistant', content: 'I will reproduce this exact environment, keeping every background element, lighting condition, floor/mat, and surrounding detail identical. Only the character pose will change.' });
    }

    // Main image prompt — add environment consistency constraint if env images present
    const envConstraint = environmentImages.length > 0
        ? 'IMPORTANT: Keep the environment/background EXACTLY the same as the reference — same room, mat, floor, lighting, colors. Only the character pose changes. '
        : '';
    messages.push({
        role: 'user',
        content: `${envConstraint}Generate an image: ${prompt}`,
    });

    const body = {
        model,
        messages,
        max_tokens: 4096,
    };

    const url = `${VERTEX_BASE}/chat/completions`;
    console.log(`🔗 [VertexKey] URL: ${url} (chat completions endpoint)`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    console.log(`📡 [VertexKey] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('❌ [VertexKey] Error response:', error);
        console.timeEnd('⏱️ VertexKey API call');
        console.groupEnd();
        
        if (response.status === 413) {
            throw new Error('Request payload too large. Try removing some reference images.');
        }
        if (response.status === 502 || response.status === 504) {
            throw new Error(`Proxy timeout (${response.status}). Image generation took too long. Try again.`);
        }
        throw new Error(error?.error?.message || `Vertex Key error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log(`📦 [VertexKey] Response text (${text.length} chars): "${text.substring(0, 150)}..."`);

    // Method 1: Gemini image models return markdown image URLs like ![...](https://...)
    const imageUrlMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (imageUrlMatch) {
        const imageUrl = imageUrlMatch[1];
        console.log(`🔗 [VertexKey] Found markdown image URL: ${imageUrl.substring(0, 80)}...`);
        try {
            const imgRes = await fetch(imageUrl);
            const imgBlob = await imgRes.blob();
            const base64 = await blobToBase64(imgBlob);
            console.log(`✅ [VertexKey] Downloaded & converted: ${Math.round(base64.length / 1024)}KB`);
            console.timeEnd('⏱️ VertexKey API call');
            console.groupEnd();
            return { base64, blobUrl: URL.createObjectURL(imgBlob), imageUrl };
        } catch (dlErr) {
            console.warn(`⚠️ [VertexKey] Download failed, using URL directly:`, dlErr.message);
            console.timeEnd('⏱️ VertexKey API call');
            console.groupEnd();
            return { base64: null, blobUrl: imageUrl, imageUrl };
        }
    }

    // Method 2: Check for bare URL (no markdown format)
    const bareUrlMatch = text.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'<>]*)/i);
    if (bareUrlMatch) {
        const imageUrl = bareUrlMatch[1];
        console.log(`🔗 [VertexKey] Found bare image URL: ${imageUrl.substring(0, 80)}...`);
        try {
            const imgRes = await fetch(imageUrl);
            const imgBlob = await imgRes.blob();
            const base64 = await blobToBase64(imgBlob);
            console.log(`✅ [VertexKey] Downloaded: ${Math.round(base64.length / 1024)}KB`);
            console.timeEnd('⏱️ VertexKey API call');
            console.groupEnd();
            return { base64, blobUrl: URL.createObjectURL(imgBlob), imageUrl };
        } catch {
            console.timeEnd('⏱️ VertexKey API call');
            console.groupEnd();
            return { base64: null, blobUrl: imageUrl, imageUrl };
        }
    }

    // Method 3: Check for inline base64 data
    const base64Match = text.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) {
        const base64 = base64Match[1];
        console.log(`✅ [VertexKey] Found inline base64: ${Math.round(base64.length / 1024)}KB`);
        console.timeEnd('⏱️ VertexKey API call');
        console.groupEnd();
        return { base64, blobUrl: base64ToBlobUrl(base64), imageUrl: null };
    }

    // Method 4: Check OpenAI-style response format
    if (data.data?.[0]?.b64_json) {
        const base64 = data.data[0].b64_json;
        console.log(`✅ [VertexKey] Got b64_json: ${Math.round(base64.length / 1024)}KB`);
        console.timeEnd('⏱️ VertexKey API call');
        console.groupEnd();
        return { base64, blobUrl: base64ToBlobUrl(base64), imageUrl: null };
    }
    if (data.data?.[0]?.url) {
        const imageUrl = data.data[0].url;
        console.timeEnd('⏱️ VertexKey API call');
        console.groupEnd();
        return { base64: null, blobUrl: imageUrl, imageUrl };
    }

    console.error('❌ [VertexKey] No image found. Full response:', text.substring(0, 300));
    console.timeEnd('⏱️ VertexKey API call');
    console.groupEnd();
    throw new Error(`No image in response. Model returned: ${text.substring(0, 150)}`);
}

// ============================================================
// PROVIDER 3: Gommo AI
// ============================================================

async function generateImageGommo(prompt, apiKey, options = {}) {
    const {
        model = 'google_nano_banana_pro',
        aspectRatio = '16:9',
        referenceImages = [],
        environmentImages = [],
    } = options;

    console.group(`🍌 [Gommo] generateImageGommo()`);
    console.log(`📋 Model: ${model}`);
    console.time('⏱️ Gommo API call');

    // Parse apiKey string which may contain domain (domain.net|access_token)
    let domain = '10xyoutube.net';
    let token = apiKey;
    if (apiKey.includes('|')) {
        const parts = apiKey.split('|');
        domain = parts[0];
        token = parts.slice(1).join('|');
    }

    // Map aspect ratio 16:9 -> 16_9 (doc: ratio=9_16|16_9|1_1)
    const ratioMap = {
        '16:9': '16_9',
        '9:16': '9_16',
        '1:1': '1_1'
    };
    const mappedRatio = ratioMap[aspectRatio] || '16_9';

    // Build payload — strictly per API doc "Create Image"
    const body = new URLSearchParams();
    body.append('access_token', token);
    body.append('domain', domain);
    body.append('action_type', 'create');
    body.append('model', model);
    body.append('prompt', prompt);
    body.append('ratio', mappedRatio);
    body.append('project_id', 'YogaKids');
    // Note: 'resolution' is NOT in Create Image doc, only in Create Video

    // Upload & attach reference images as subjects
    // Strategy: Upload → URL strings array → (fallback) base64 data URI → (fallback) no subjects
    let subjectUrls = [];   // uploaded URLs for Strategy 1
    let base64Refs = [];    // base64 data URIs for Strategy 2 fallback
    if ((referenceImages && referenceImages.length > 0) || (environmentImages && environmentImages.length > 0)) {
        const allRefs = [...referenceImages, ...environmentImages];
        try {
            for (let i = 0; i < allRefs.length; i++) {
                let base64Raw = allRefs[i];
                // Strip data URI prefix if present — Gommo Upload expects raw base64
                if (base64Raw.startsWith('data:')) {
                    base64Raw = base64Raw.split(',')[1];
                }

                const sizeKB = Math.round((base64Raw.length * 0.75) / 1024);
                console.log(`📤 [Gommo] Processing ref image ${i + 1}/${allRefs.length} (${sizeKB}KB)...`);

                // Skip tiny/invalid images (< 1KB is likely broken)
                if (sizeKB < 1) {
                    console.warn(`⚠️ [Gommo] Ref image ${i + 1} too small (${sizeKB}KB), skipping`);
                    continue;
                }

                // Keep base64 data URI for Strategy 2 fallback
                base64Refs.push(`data:image/png;base64,${base64Raw}`);

                // Upload image to get URL for Strategy 1
                const uploadBody = new URLSearchParams();
                uploadBody.append('access_token', token);
                uploadBody.append('domain', domain);
                uploadBody.append('data', base64Raw);
                uploadBody.append('project_id', 'YogaKids');
                uploadBody.append('file_name', `ref_${Date.now()}_${i}.jpg`);
                uploadBody.append('size', String(Math.round(base64Raw.length * 0.75)));

                const uploadRes = await fetch(`${GOMMO_BASE}/ai/image-upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: uploadBody.toString()
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok || uploadData.error || !uploadData.imageInfo?.url) {
                    console.warn(`⚠️ [Gommo] Upload ref ${i + 1} failed:`, uploadData.message || uploadData.error);
                    continue;
                }

                console.log(`✅ [Gommo] Ref ${i + 1} uploaded → ${uploadData.imageInfo.url}`);
                subjectUrls.push(uploadData.imageInfo.url);
            }
        } catch (err) {
            console.warn('⚠️ [Gommo] Subject upload error:', err.message);
        }
    }

    // Attach subjects as array of URL strings (NOT objects with {url:...})
    if (subjectUrls.length > 0) {
        body.append('subjects', JSON.stringify(subjectUrls));
        console.log(`📎 [Gommo] Strategy 1: Attached ${subjectUrls.length} subject URL(s): ${JSON.stringify(subjectUrls)}`);
    }

    // Helper: call Create Image then poll for result
    async function createAndPoll(requestBody) {
        const createRes = await fetch(`${GOMMO_BASE}/ai/generateImage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: requestBody.toString(),
        });

        const data = await createRes.json();
        if (!createRes.ok || data.error) {
            throw new Error(data.message || data.error || `Gommo API create failure: ${createRes.status}`);
        }

        const idBase = data.imageInfo?.id_base;
        if (!idBase) throw new Error('No id_base returned from Gommo');

        // Check if image is already done (some models return SUCCESS immediately)
        if (data.imageInfo.status === 'SUCCESS' && data.imageInfo.url) {
            console.log(`✅ [Gommo] Image ready immediately: ${idBase}`);
            return data.imageInfo.url;
        }

        console.log(`✅ [Gommo] Job created: ${idBase}, polling...`);

        // Poll Check Image Status endpoint
        const maxRetries = 60;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const checkBody = new URLSearchParams();
            checkBody.append('access_token', token);
            checkBody.append('domain', domain);
            checkBody.append('id_base', idBase);

            const checkRes = await fetch(`${GOMMO_BASE}/ai/image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: checkBody.toString(),
            });

            const checkData = await checkRes.json();
            // Response may or may not be wrapped in imageInfo
            const s = checkData.imageInfo || checkData;

            if (s.status === 'SUCCESS' && s.url) {
                return s.url;
            } else if (s.status === 'ERROR') {
                throw new Error(s.error || s.message || s.reason || 'Gommo image generation failed');
            }

            console.log(`[Gommo] Poll ${attempt}/${maxRetries}… status: ${s.status}`);
            await sleep(3000);
        }

        throw new Error('Timeout waiting for Gommo image');
    }

    // Multi-strategy execution:
    // Strategy 1: URL strings in subjects (from upload)
    // Strategy 2: base64 data URI in subjects (skip upload)
    // Strategy 3: no subjects (final fallback)
    try {
        let imageUrl;
        try {
            // Strategy 1: try with uploaded URL subjects
            imageUrl = await createAndPoll(body);
        } catch (firstErr) {
            const isSubjectError = /phân tích|subjects|thành phần|parse/i.test(firstErr.message);

            if (isSubjectError && base64Refs.length > 0) {
                // Strategy 2: try with base64 data URI subjects
                console.warn(`⚠️ [Gommo] Strategy 1 (URL subjects) failed: "${firstErr.message}"`);
                console.log(`🔄 [Gommo] Strategy 2: Trying with base64 data URI subjects...`);
                body.delete('subjects');
                body.append('subjects', JSON.stringify(base64Refs));

                try {
                    imageUrl = await createAndPoll(body);
                } catch (secondErr) {
                    const isSubjectError2 = /phân tích|subjects|thành phần|parse/i.test(secondErr.message);
                    if (isSubjectError2) {
                        // Strategy 3: no subjects at all
                        console.warn(`⚠️ [Gommo] Strategy 2 (base64 subjects) also failed: "${secondErr.message}"`);
                        console.log(`🔄 [Gommo] Strategy 3: Generating WITHOUT subjects (no character reference)...`);
                        body.delete('subjects');
                        imageUrl = await createAndPoll(body);
                    } else {
                        throw secondErr;
                    }
                }
            } else if (isSubjectError && subjectUrls.length > 0) {
                // Strategy 3: no subjects
                console.warn(`⚠️ [Gommo] Subject error: "${firstErr.message}". Retrying WITHOUT subjects...`);
                body.delete('subjects');
                imageUrl = await createAndPoll(body);
            } else {
                throw firstErr;
            }
        }

        console.log(`🔗 [Gommo] Image URL: ${imageUrl.substring(0, 80)}...`);

        // Download image to base64 for IndexedDB storage
        const imgRes = await fetch(imageUrl);
        const imgBlob = await imgRes.blob();

        let base64 = null;
        try {
            base64 = await blobToBase64(imgBlob);
            console.log(`✅ [Gommo] Downloaded & converted: ${Math.round(base64.length / 1024)}KB`);
        } catch (e) {
            console.warn('⚠️ [Gommo] base64 conversion failed, using URL directly', e);
        }

        console.timeEnd('⏱️ Gommo API call');
        console.groupEnd();
        return { base64, blobUrl: URL.createObjectURL(imgBlob), imageUrl };

    } catch (err) {
        console.error('❌ [Gommo] Error:', err);
        console.timeEnd('⏱️ Gommo API call');
        console.groupEnd();
        throw err;
    }
}

// ============================================================
// VERTEX KEY: Chat Completions (AI Analysis)
// ============================================================

/**
 * Use Vertex Key chat models for script analysis / prompt enhancement.
 */
export async function chatCompletion(systemPrompt, userPrompt, apiKey, options = {}) {
    const {
        model = 'gem/gemini-3-flash-nothinking',
        maxTokens = 2048,
        temperature = 0.7,
    } = options;

    console.group(`💬[ChatCompletion] model: ${model}`);
    console.log(`📋 System prompt(${systemPrompt.length} chars): "${systemPrompt.substring(0, 80)}..."`);
    console.log(`📋 User prompt(${userPrompt.length} chars): "${userPrompt.substring(0, 80)}..."`);
    console.log(`⚙️ maxTokens: ${maxTokens}, temperature: ${temperature}`);
    console.time('⏱️ ChatCompletion API call');

    const url = `${VERTEX_KEY_BASE}/chat/completions`;
    const body = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    console.log(`📡[ChatCompletion] Response status: ${response.status}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('❌ [ChatCompletion] Error:', error);
        console.timeEnd('⏱️ ChatCompletion API call');
        console.groupEnd();
        throw new Error(error?.error?.message || `Chat error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`✅[ChatCompletion] Response(${content.length} chars): "${content.substring(0, 100)}..."`);
    console.timeEnd('⏱️ ChatCompletion API call');
    console.groupEnd();
    return content;
}

// ============================================================
// SCENE IMAGE GENERATION
// ============================================================

/**
 * Generate start + end frame images for a scene.
 */
export async function generateSceneImages(framePrompt, apiKey, options = {}) {
    console.group(`🎬[SceneImages] Scene #${framePrompt.sceneIndex}: "${framePrompt.sceneName}"`);
    console.time(`⏱️ Scene "${framePrompt.sceneName}" total`);

    let startResult = undefined;
    let endResult = undefined;

    // Override with scene-specific reference image if available
    const effectiveOptions = { ...options };
    if (framePrompt.customReferenceImage && (!options.targetFrame || options.targetFrame === 'start')) {
        effectiveOptions.referenceImages = [framePrompt.customReferenceImage];
        console.log(`📎[SceneImages] Using CUSTOM reference image for this scene`);
    }

    // Always forward environmentImages
    if (options.environmentImages?.length > 0) {
        console.log(`🏞️[SceneImages] Forwarding ${options.environmentImages.length} environment images`);
    }

    if (!effectiveOptions.targetFrame || effectiveOptions.targetFrame === 'start') {
        // 1. Generate start frame using original character image from options
        console.log(`🟢[SceneImages] Generating START frame...`);
        console.log(`📎[SceneImages] Reference images from options: ${effectiveOptions.referenceImages?.length || 0}`);
        startResult = await generateImage(
            framePrompt.startFrame.prompt,
            apiKey,
            effectiveOptions
        );
        console.log(`✅[SceneImages] START frame done — base64: ${startResult.base64 ? Math.round(startResult.base64.length / 1024) + 'KB' : 'null'}, blobUrl: ${startResult.blobUrl ? 'yes' : 'no'}`);

        if (!options.targetFrame) {
            // Rate limit delay
            console.log(`⏳[SceneImages] Rate limit delay 1500ms...`);
            await sleep(1500);
        }
    }

    if (!options.targetFrame || options.targetFrame === 'end') {
        // 2. Generate end frame using the start frame as reference
        console.log(`🔴[SceneImages] Generating END frame...`);
        const endOptions = { ...options };

        // ALWAYS forward environment images for END frame (environment consistency)
        if (options.environmentImages?.length > 0) {
            endOptions.environmentImages = options.environmentImages;
            console.log(`🏞️[SceneImages] Environment images forwarded to END frame: ${options.environmentImages.length}`);
        }

        if (options.targetFrame === 'end') {
            // we are generating only END. Use the options.referenceImages (which should be prepared by caller)
            // Environment images already set above
        } else {
            if (startResult?.base64) {
                endOptions.referenceImages = [startResult.base64];
                console.log(`📎[SceneImages] Using START frame as reference for END frame(${Math.round(startResult.base64.length / 1024)}KB)`);
            } else {
                endOptions.referenceImages = [];
                console.warn(`⚠️[SceneImages] No base64 from START frame, END frame has no reference`);
            }
        }

        endResult = await generateImage(
            framePrompt.endFrame.prompt,
            apiKey,
            endOptions
        );
        console.log(`✅[SceneImages] END frame done — base64: ${endResult.base64 ? Math.round(endResult.base64.length / 1024) + 'KB' : 'null'}, blobUrl: ${endResult.blobUrl ? 'yes' : 'no'} `);
    }

    console.timeEnd(`⏱️ Scene "${framePrompt.sceneName}" total`);
    console.groupEnd();

    const result = {};
    if (startResult !== undefined) result.start = startResult;
    if (endResult !== undefined) result.end = endResult;
    return result;
}

// ============================================================
// UTILITIES
// ============================================================

export function base64ToBlobUrl(base64, mimeType = 'image/png') {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

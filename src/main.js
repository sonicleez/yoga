/**
 * YOGAKIDS — Main App Entry Point
 * Wires all modules together with UI event handlers
 */

import { parseScript, formatSceneLabel, getScriptStats, analyzeScene } from './modules/scriptParser.js';
import { generateAllFramePrompts, generateFramePrompts, STYLE_PRESETS, DEFAULT_SETTINGS } from './modules/promptGenerator.js';
import { generateImage, base64ToBlobUrl, generateSceneImages, PROVIDERS, verifyApiKey } from './modules/imageGenerator.js';
import { enqueue, enqueueAll, cancelAll, clearAll, isQueueProcessing, setCallbacks, getQueueStatus } from './modules/imageQueue.js';
import { getState, setState, onStateChange, restoreAllState, clearAllState, clearProjectState, getActiveApiKey, setApiKey } from './modules/state.js';

// ============================================================
// SAMPLE SCRIPT
// ============================================================

const SAMPLE_SCRIPT = `Intro

Welcome to this gentle bedtime yoga session.
Tonight we'll move slowly through relaxing poses to help your body unwind.
Let your breath become calm and steady.
There's no need to rush—just move softly and listen to your body.
Find a comfortable space, and let's begin.

1. Easy Pose

Sit comfortably with a tall but relaxed spine.
Take a slow deep breath in, and gently breathe out.
Stay still here for a few calm breaths.

2. Gentle Neck Stretch

Slowly tilt your head to one side.
Relax your shoulders and breathe slowly.
After a few breaths, switch to the other side.

3. Cat Cow

Place your hands and knees on the mat.
Inhale as you gently arch your back.
Exhale as you round your spine and relax your neck.

4. Child's Pose

Lower your hips toward your heels.
Rest your forehead down and stretch your arms forward.
Take slow and calming breaths.

5. Standing Forward Fold

Stand tall, then slowly fold forward.
Let your head and neck relax.
Stay here and breathe gently.

6. Half Lift

Lift halfway up with a long, straight back.
Keep your gaze softly toward the mat.
Breathe slowly and stay steady.

7. Low Lunge

Step one foot forward into a gentle lunge.
Lower your hips and open your chest slightly.
Take a few slow breaths, then switch sides.

8. Gentle Lizard Pose

Place both hands inside your front foot.
Let your hips soften and relax downward.
Breathe slowly and stay calm.

9. Seated Forward Fold

Sit down and extend both legs forward.
Fold gently toward your legs.
Relax and breathe slowly.

10. Butterfly Pose

Bring the soles of your feet together.
Sit tall and relax your knees downward.
Take slow, comfortable breaths.

11. Supine Twist

Lie on your back and gently drop your knees to one side.
Keep your shoulders relaxed on the mat.
Breathe slowly, then switch sides.

12. Knees to Chest

Hug your knees toward your chest.
Feel your lower back gently relax.
Breathe deeply and softly.

13. Happy Baby

Hold your feet with your hands.
Open your knees wide and relax your back.
Take slow, peaceful breaths.

14. Legs Up the Wall

Extend your legs up against the wall.
Rest your arms comfortably by your sides.
Let your breath become slow and calm.

15. Savasana

Lie comfortably on your back.
Close your eyes and relax your whole body.
Take a slow breath in… and a long breath out.

Outro

Your body is now calm and relaxed.
Stay here for a moment and enjoy the peaceful feeling.
Allow your breath to stay slow and gentle.
Thank you for practicing tonight.
Sleep well and have a peaceful night.`;

// ============================================================
// DOM ELEMENTS
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.group('🚀 [App] DOMContentLoaded — Initializing YogaKids');

    // Image modal close handlers
    $('#image-modal-close')?.addEventListener('click', () => {
        $('#image-modal').style.display = 'none';
    });
    $('#image-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#image-modal')) {
            $('#image-modal').style.display = 'none';
        }
    });

    // 1. Restore all persisted state first (localStorage + IndexedDB)
    await restoreAllState();

    // 2. Init UI modules (they read from restored state)
    initSettings();
    initNavigation();
    initScriptPanel();
    initCharacterPanel();
    initPromptPanel();
    initGalleryPanel();

    // 3. Rebuild UI from restored state
    rebuildFromState();

    console.log('✅ [App] All modules initialized');
    console.groupEnd();
    showToast('🧘 YogaKids ready!', 'info');
});

/**
 * Rebuild the entire UI from persisted state after a page refresh.
 */
function rebuildFromState() {
    const state = getState();
    console.group('🔄 [Restore] Rebuilding UI from state');

    // Restore API key input for current provider
    const currentKey = getActiveApiKey();
    if (currentKey) {
        $('#api-key').value = currentKey;
    }

    // Restore character description
    if (state.characterDescription) {
        const el = $('#character-desc');
        if (el) el.value = state.characterDescription;
    }

    // Restore environment
    if (state.environment) {
        const el = $('#environment-desc');
        if (el) el.value = state.environment;
    }

    // Restore aspect ratio
    if (state.aspectRatio) {
        const el = $('#aspect-ratio');
        if (el) el.value = state.aspectRatio;
    }

    // Restore parsed script → rebuild scene list
    if (state.parsedScript && state.parsedScript.scenes?.length > 0) {
        console.log(`  📝 Restoring ${state.parsedScript.scenes.length} scenes`);
        renderSceneList(state.parsedScript);
        const stats = getScriptStats(state.parsedScript);
        $('#stat-scenes').textContent = stats.totalScenes;
        $('#stat-prompts').textContent = stats.totalScenes * 2;
        $('#scene-count-badge').textContent = `${stats.totalScenes} scenes`;
        $('#btn-to-character').disabled = false;
    }

    // Restore frame prompts → rebuild prompt list
    if (state.framePrompts?.length > 0) {
        console.log(`  🎨 Restoring ${state.framePrompts.length} frame prompts`);
        buildPromptList();
    }

    // Restore generated images → rebuild gallery
    const imageCount = Object.keys(state.generatedImages || {}).length;
    if (imageCount > 0 && state.framePrompts?.length > 0) {
        console.log(`  🖼️ Restoring ${imageCount} generated image sets`);
        buildGallery();
        $('#stat-images').textContent = imageCount * 2;
        $('#btn-download-all').disabled = false;
    }

    // Restore reference image previews
    if (state.referenceImages?.length > 0) {
        console.log(`  📎 Restoring ${state.referenceImages.length} reference images`);
        renderRefPreviews();
    }

    // Restore environment image previews
    if (state.environmentImages?.length > 0) {
        console.log(`  🏞️ Restoring ${state.environmentImages.length} environment images`);
        renderEnvRefPreviews();
    }

    // Restore step
    if (state.currentStep > 0) {
        console.log(`  📍 Restoring step ${state.currentStep}`);
        goToStep(state.currentStep);
    }

    // Restore style preset selection
    if (state.stylePreset) {
        $$('.style-option').forEach(s => {
            s.classList.toggle('selected', s.dataset.style === state.stylePreset);
        });
    }

    console.groupEnd();
}

// ============================================================
// NAVIGATION & STEPS
// ============================================================

function initNavigation() {
    // Step nav buttons
    $$('.nav-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.step);
            goToStep(step);
        });
    });

    // Next/Prev buttons
    $$('[data-next]').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.next);
            if (step === 3) buildPromptList(); // Generate prompts before going to prompt review
            if (step === 4) buildGallery();    // Build gallery before going to gallery
            goToStep(step);
        });
    });

    $$('[data-prev]').forEach(btn => {
        btn.addEventListener('click', () => {
            goToStep(parseInt(btn.dataset.prev));
        });
    });

    // New project button
    $('#btn-new-project').addEventListener('click', () => {
        if (confirm('Bắt đầu dự án mới? (Sẽ xóa kịch bản, ảnh và nhân vật nhưng giữ lại API key và cài đặt)')) {
            clearProjectState();
            location.reload();
        }
    });

    // Reset button
    $('#btn-reset').addEventListener('click', () => {
        if (confirm('Reset toàn bộ dữ liệu? (Bao gồm cả API key và cài đặt)')) {
            clearAllState();
            location.reload();
        }
    });

    // Load ZIP button
    $('#btn-load-zip').addEventListener('click', () => {
        $('#upload-zip-input').click();
    });

    $('#upload-zip-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadZipState(e.target.files[0]);
        }
    });
}

function goToStep(step) {
    const stepNames = ['Settings', 'Script Input', 'Character Setup', 'Prompt Review', 'Gallery'];
    console.log(`📍 [Nav] goToStep(${step}) → "${stepNames[step] || 'Unknown'}"`);

    const state = getState();
    setState('currentStep', step);

    // Update panels
    $$('.step-panel').forEach(p => p.classList.remove('active'));
    $(`.step-panel[data-panel="${step}"]`).classList.add('active');

    // Update nav
    $$('.nav-step').forEach((n, i) => {
        n.classList.remove('active');
        if (i < step) n.classList.add('completed');
        if (i === step) n.classList.add('active');
    });

    // Progress bar
    const pct = ((step + 1) / 5) * 100;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-label').textContent = `Step ${step + 1} of 5`;
}

// ============================================================
// STEP 0: SETTINGS
// ============================================================

function initSettings() {
    const state = getState();

    // ---- Provider tabs ----
    updateProviderUI(state.provider);

    $$('.provider-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const provider = tab.dataset.provider;
            setState('provider', provider);
            updateProviderUI(provider);
            // Load the saved API key for this provider
            const apiKeyInput = $('#api-key');
            apiKeyInput.value = getState().apiKeys[provider] || '';
        });
    });

    // ---- API key ----
    const apiKeyInput = $('#api-key');
    apiKeyInput.value = getActiveApiKey();
    apiKeyInput.addEventListener('input', (e) => {
        const key = e.target.value;
        const currentProvider = getState().provider;
        setApiKey(currentProvider, key);

        // Auto-detect provider from key format
        if (key.startsWith('vai-') && currentProvider !== 'vertex-key') {
            setApiKey('vertex-key', key);
            setState('provider', 'vertex-key');
            updateProviderUI('vertex-key');
        } else if (key.startsWith('AIza') && currentProvider !== 'google-ai') {
            setApiKey('google-ai', key);
            setState('provider', 'google-ai');
            updateProviderUI('google-ai');
        } else if (key.includes('|') && currentProvider !== 'gommo') {
            setApiKey('gommo', key);
            setState('provider', 'gommo');
            updateProviderUI('gommo');
        }
    });

    // Toggle key visibility
    $('#toggle-key').addEventListener('click', () => {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    // Check key
    const btnVerify = $('#btn-verify-key');
    const statusText = $('#key-status');
    if (btnVerify) {
        btnVerify.addEventListener('click', async () => {
            const currentKey = getActiveApiKey();
            const currentProvider = getState().provider;
            if (!currentKey) {
                showToast('Vui lòng nhập API Key trước khi kiểm tra!', 'warning');
                return;
            }

            btnVerify.disabled = true;
            btnVerify.textContent = '⏳ Đang kiểm tra...';
            statusText.style.display = 'block';
            statusText.style.color = 'var(--text-secondary)';
            statusText.textContent = 'Đang kết nối API...';

            try {
                const result = await verifyApiKey(currentKey, currentProvider);
                if (result.valid) {
                    statusText.style.color = '#10b981'; // success green
                    statusText.textContent = `✅ ${result.message}`;
                    showToast('Xác thực API Key thành công!', 'success');
                } else {
                    statusText.style.color = '#ef4444'; // error red
                    statusText.textContent = `❌ ${result.message}`;
                    showToast('Lỗi API Key!', 'error');
                }
            } catch (err) {
                statusText.style.color = '#ef4444';
                statusText.textContent = `❌ Có lỗi xảy ra: ${err.message}`;
            } finally {
                btnVerify.disabled = false;
                btnVerify.textContent = '✅ Kiểm tra';
            }
        });
    }

    // ---- Model select ----
    $('#image-model').addEventListener('change', (e) => {
        setState('imageModel', e.target.value);
    });

    // ---- Style presets ----
    const styleGrid = $('#style-grid');
    Object.entries(STYLE_PRESETS).forEach(([key, preset]) => {
        const btn = document.createElement('button');
        btn.className = `style-option ${key === state.stylePreset ? 'selected' : ''}`;
        btn.dataset.style = key;
        btn.innerHTML = `
      <span class="style-option-name">${preset.name}</span>
      <span class="style-option-desc">${preset.description}</span>
    `;
        btn.addEventListener('click', () => {
            $$('.style-option').forEach(s => s.classList.remove('selected'));
            btn.classList.add('selected');
            setState('stylePreset', key);
        });
        styleGrid.appendChild(btn);
    });

    // Aspect ratio
    $('#aspect-ratio').addEventListener('change', (e) => setState('aspectRatio', e.target.value));
}

/**
 * Update the provider UI: tabs, placeholder, model list.
 */
function updateProviderUI(provider) {
    // Toggle tab active
    $$('.provider-tab').forEach(t => t.classList.remove('active'));
    const activeTab = $(`.provider-tab[data-provider="${provider}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Update key placeholder
    const providerDef = PROVIDERS[provider];
    if (providerDef) {
        $('#api-key').placeholder = providerDef.keyPlaceholder;
        const hintMap = {
            'google-ai': 'Google AI API key (AIzaSy...). Lưu trên trình duyệt.',
            'vertex-key': 'Vertex Key API key (vai-...). Lưu trên trình duyệt.',
            'gommo': 'Gommo AI key: domain.net|access_token. Lưu trên trình duyệt.',
        };
        $('#key-hint').textContent = hintMap[provider] || 'Lưu trên trình duyệt.';
    }

    // Populate model dropdown
    const modelSelect = $('#image-model');
    modelSelect.innerHTML = '';
    if (providerDef?.models) {
        const savedModel = getState().imageModel || '';
        Object.entries(providerDef.models).forEach(([modelId, info]) => {
            const opt = document.createElement('option');
            opt.value = modelId;
            opt.textContent = `${info.name} — ${info.resolution} — ${info.price}`;
            if (info.recommended && !savedModel) opt.selected = true;
            if (savedModel === modelId) opt.selected = true;
            modelSelect.appendChild(opt);
        });
        // Update state with current selection
        setState('imageModel', modelSelect.value);
    }
}

// ============================================================
// STEP 1: SCRIPT INPUT
// ============================================================

function initScriptPanel() {
    // Sample script button
    $('#btn-sample-script').addEventListener('click', () => {
        $('#script-input').value = SAMPLE_SCRIPT;
        showToast('📋 Đã load script mẫu!', 'info');
    });

    // Parse button
    $('#btn-parse').addEventListener('click', () => {
        console.group('📝 [App] Parse Script button clicked');
        const raw = $('#script-input').value.trim();
        if (!raw) {
            console.warn('⚠️ [App] No script input');
            console.groupEnd();
            showToast('⚠️ Hãy nhập script trước!', 'error');
            return;
        }
        console.log(`📄 [App] Raw script: ${raw.length} chars`);

        const parsed = parseScript(raw);
        setState('parsedScript', parsed);
        renderSceneList(parsed);

        const stats = getScriptStats(parsed);
        console.log('📊 [App] Script stats:', stats);
        showToast(`✅ Đã phân tích ${stats.totalScenes} scenes (${stats.poseCount} poses)`, 'success');

        // Update sidebar stats
        $('#stat-scenes').textContent = stats.totalScenes;
        $('#stat-prompts').textContent = stats.totalScenes * 2;

        // Enable next button
        $('#btn-to-character').disabled = false;
        $('#scene-count-badge').textContent = `${stats.totalScenes} scenes`;
        console.groupEnd();
    });
}

function renderSceneList(parsed) {
    const container = $('#scene-list');
    container.innerHTML = '';

    parsed.scenes.forEach(scene => {
        const analysis = analyzeScene(scene);
        const card = document.createElement('div');
        card.className = `scene-card type-${scene.type}`;

        const numLabel = scene.type === 'intro' ? '🎬' : scene.type === 'outro' ? '🎬' : scene.number;

        card.innerHTML = `
      <span class="scene-number">${numLabel}</span>
      <div class="scene-info">
        <div class="scene-name">${scene.name}</div>
        <div class="scene-meta">${scene.lineCount} lines · ${scene.type}</div>
      </div>
      <span class="scene-view">📷 ${analysis.suggestedView}</span>
    `;
        container.appendChild(card);
    });
}

// ============================================================
// STEP 2: CHARACTER SETUP
// ============================================================

function initCharacterPanel() {
    const state = getState();

    // Character description
    const charDesc = $('#character-desc');
    charDesc.value = state.characterDescription;
    charDesc.addEventListener('input', (e) => {
        setState('characterDescription', e.target.value);
    });

    // Environment
    const envDesc = $('#environment-desc');
    envDesc.value = state.environment;
    envDesc.addEventListener('input', (e) => {
        setState('environment', e.target.value);
    });

    // File upload zone
    const uploadZone = $('#upload-zone');
    const fileInput = $('#ref-upload');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Generate prompts button
    $('#btn-generate-prompts').addEventListener('click', () => {
        generatePrompts();
    });

    // === Environment image upload zone ===
    const envUploadZone = $('#env-upload-zone');
    const envFileInput = $('#env-ref-upload');

    envUploadZone.addEventListener('click', () => envFileInput.click());
    envUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        envUploadZone.classList.add('dragover');
    });
    envUploadZone.addEventListener('dragleave', () => {
        envUploadZone.classList.remove('dragover');
    });
    envUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        envUploadZone.classList.remove('dragover');
        handleEnvFiles(e.dataTransfer.files);
    });
    envFileInput.addEventListener('change', (e) => {
        handleEnvFiles(e.target.files);
    });
}

function handleFiles(files) {
    const state = getState();
    const refs = [...state.referenceImages];

    for (const file of files) {
        if (refs.length >= 3) {
            showToast('⚠️ Tối đa 3 ảnh reference!', 'error');
            break;
        }
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1]; // Remove data:... prefix
            refs.push(base64);
            setState('referenceImages', refs);
            renderRefPreviews();
        };
        reader.readAsDataURL(file);
    }
}

function renderRefPreviews() {
    const container = $('#ref-previews');
    const refs = getState().referenceImages;
    container.innerHTML = '';

    refs.forEach((base64, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'ref-thumb';
        thumb.innerHTML = `
      <img src="data:image/png;base64,${base64}" alt="Reference ${i + 1}">
      <button class="ref-thumb-remove" data-index="${i}">✕</button>
    `;
        thumb.querySelector('.ref-thumb-remove').addEventListener('click', () => {
            const newRefs = [...getState().referenceImages];
            newRefs.splice(i, 1);
            setState('referenceImages', newRefs);
            renderRefPreviews();
        });
        container.appendChild(thumb);
    });
}

// === Environment image upload handling ===

function handleEnvFiles(files) {
    const state = getState();
    const refs = [...(state.environmentImages || [])];

    for (const file of files) {
        if (refs.length >= 3) {
            showToast('⚠️ Tối đa 3 ảnh environment!', 'error');
            break;
        }
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            refs.push(base64);
            setState('environmentImages', refs);
            renderEnvRefPreviews();
            showToast('🏞️ Đã thêm ảnh environment!', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function renderEnvRefPreviews() {
    const container = $('#env-ref-previews');
    const refs = getState().environmentImages || [];
    container.innerHTML = '';

    refs.forEach((base64, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'ref-thumb';
        thumb.innerHTML = `
      <img src="data:image/png;base64,${base64}" alt="Env Reference ${i + 1}">
      <button class="ref-thumb-remove" data-index="${i}">✕</button>
    `;
        thumb.querySelector('.ref-thumb-remove').addEventListener('click', () => {
            const newRefs = [...(getState().environmentImages || [])];
            newRefs.splice(i, 1);
            setState('environmentImages', newRefs);
            renderEnvRefPreviews();
        });
        container.appendChild(thumb);
    });
}

// ============================================================
// STEP 3: PROMPT GENERATION & REVIEW
// ============================================================

function initPromptPanel() {
    $('#btn-copy-all-veo')?.addEventListener('click', () => {
        const state = getState();
        if (!state.framePrompts || state.framePrompts.length === 0) {
            showToast('⚠️ Chưa có prompts để copy!', 'error');
            return;
        }

        const veoPrompts = state.framePrompts
            .map(fp => fp.videoPrompt)
            .filter(Boolean)
            .join('\n\n');

        if (!veoPrompts) {
            showToast('⚠️ Không tìm thấy Veo video prompts!', 'error');
            return;
        }

        navigator.clipboard.writeText(veoPrompts).then(() => {
            showToast('📋 Đã copy tất cả Veo Prompts!', 'success');
        }).catch(err => {
            console.error('Failed to copy', err);
            showToast('❌ Lỗi copy to clipboard!', 'error');
        });
    });
}


function generatePrompts() {
    console.group('🎨 [App] generatePrompts()');
    const state = getState();
    if (!state.parsedScript) {
        console.warn('⚠️ [App] No parsed script available');
        console.groupEnd();
        showToast('⚠️ Chưa có script! Quay lại bước 2.', 'error');
        return;
    }

    const settings = {
        characterDescription: state.characterDescription,
        environment: state.environment,
        stylePreset: state.stylePreset,
        aspectRatio: state.aspectRatio,
        imageSize: state.imageSize,
    };
    console.log('⚙️ [App] Prompt settings:', settings);

    const prompts = generateAllFramePrompts(state.parsedScript, settings);
    setState('framePrompts', prompts);
    console.log(`✅ [App] Generated ${prompts.length} scene prompts (${prompts.length * 2} total frames)`);
    console.groupEnd();
    showToast(`🎨 Đã tạo ${prompts.length * 2} prompts (${prompts.length} start + ${prompts.length} end)`, 'success');
}

function buildPromptList() {
    const state = getState();
    if (state.framePrompts.length === 0) generatePrompts();

    const container = $('#prompt-list');
    const prompts = getState().framePrompts;

    if (prompts.length === 0) return;
    container.innerHTML = '';

    prompts.forEach((fp, idx) => {
        const card = document.createElement('div');
        card.className = 'prompt-card';

        const numLabel = fp.sceneType === 'intro' ? '🎬' : fp.sceneType === 'outro' ? '🎬' : fp.poseNumber;

        card.innerHTML = `
      <div class="prompt-card-header">
        <div class="prompt-card-title">
          <span class="scene-number">${numLabel}</span>
          <span>${fp.sceneName}</span>
          <span class="badge">${fp.sceneType}</span>
        </div>
        <span class="prompt-card-toggle">▼</span>
      </div>
      <div class="prompt-card-body">
        <div class="frame-group">
          <div class="frame-label start">🟢 Start Frame</div>
          <div class="frame-prompt-text">${escapeHtml(fp.startFrame.prompt)}</div>
        </div>
        <div class="frame-group">
          <div class="frame-label end">🔴 End Frame</div>
          <div class="frame-prompt-text">${escapeHtml(fp.endFrame.prompt)}</div>
        </div>
        <div class="frame-group video-prompt">
          <div class="frame-label" style="color: #9b59b6;">🎬 Veo 3 Video Prompt</div>
          <div class="frame-prompt-text" style="font-style: italic;">${escapeHtml(fp.videoPrompt || '')}</div>
        </div>
        ${fp.transition ? `<div class="transition-label">⏩ Transition: ${escapeHtml(fp.transition)}</div>` : ''}
      </div>
    `;

        // Toggle expand
        card.querySelector('.prompt-card-header').addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        // Auto-expand first 2
        if (idx < 2) card.classList.add('expanded');

        container.appendChild(card);
    });
}

// ============================================================
// STEP 4: GALLERY
// ============================================================

function initGalleryPanel() {
    // Setup queue callbacks
    setCallbacks({
        onQueueStart: (total) => {
            console.log(`🚀 [App/Queue] Queue started — ${total} scenes to generate`);
            const progressEl = $('#generate-progress');
            const progressFill = $('#gen-progress-fill');
            const progressText = $('#gen-progress-text');
            progressEl.style.display = 'flex';
            progressFill.style.width = '0%';
            progressText.textContent = `0/${total} — Đang chuẩn bị...`;
            $('#btn-generate-all').disabled = true;
            $('#btn-generate-all').style.display = 'none';
            // Show cancel button
            showCancelButton(true);
            setState('isGenerating', true);
            window._genTimers = window._genTimers || {};
            window._genStartTimes = window._genStartTimes || {};
            window._genElapsedTimes = window._genElapsedTimes || {};
        },
        onProgress: (completed, total, currentItem) => {
            const progressFill = $('#gen-progress-fill');
            const progressText = $('#gen-progress-text');
            progressFill.style.width = `${(completed / total) * 100}%`;
            progressText.textContent = `${completed}/${total} — 🎨 ${currentItem.sceneName}`;

            // Initialize timer for current item
            if (!window._genTimers) window._genTimers = {};
            if (!window._genStartTimes) window._genStartTimes = {};
            if (window._genTimers[currentItem.sceneIndex]) {
                clearInterval(window._genTimers[currentItem.sceneIndex]);
            }
            const startTime = Date.now();
            window._genStartTimes[currentItem.sceneIndex] = startTime;
            window._genTimers[currentItem.sceneIndex] = setInterval(() => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const startTimerEl = $(`#frame-start-timer-${currentItem.sceneIndex}`);
                const endTimerEl = $(`#frame-end-timer-${currentItem.sceneIndex}`);
                if (startTimerEl) startTimerEl.textContent = `${elapsed}s`;
                if (endTimerEl) endTimerEl.textContent = `${elapsed}s`;
            }, 100);
        },
        onItemComplete: (item, result) => {
            console.log(`✅ [App/Queue] Item complete: "${item.sceneName}" (scene #${item.sceneIndex})`);
            if (window._genTimers?.[item.sceneIndex]) {
                clearInterval(window._genTimers[item.sceneIndex]);
            }
            // Calculate and store elapsed time
            let elapsedSec = null;
            if (window._genStartTimes?.[item.sceneIndex]) {
                elapsedSec = ((Date.now() - window._genStartTimes[item.sceneIndex]) / 1000).toFixed(1);
                if (!window._genElapsedTimes) window._genElapsedTimes = {};
                window._genElapsedTimes[item.sceneIndex] = elapsedSec;
            }
            // Update gallery UI with elapsed time
            updateGalleryFrame(item.sceneIndex, result, elapsedSec);
            // Save to state properly merging
            const state = getState();
            const images = { ...state.generatedImages };

            const existing = images[item.sceneIndex] || {};
            const merged = { ...existing };
            if (result.start !== undefined) merged.start = result.start;
            if (result.end !== undefined) merged.end = result.end;
            images[item.sceneIndex] = merged;

            setState('generatedImages', images);
            // Update stats
            const status = getQueueStatus();
            $('#stat-images').textContent = status.done * 2;
        },
        onItemError: (item, error) => {
            console.error(`❌ [App/Queue] Item error: "${item.sceneName}" — ${error.message}`);
            if (window._genTimers?.[item.sceneIndex]) {
                clearInterval(window._genTimers[item.sceneIndex]);
            }
            showToast(`❌ ${item.sceneName}: ${error.message}`, 'error');
            // Show error state in gallery
            const startEl = $(`#frame-start-${item.sceneIndex}`);
            const endEl = $(`#frame-end-${item.sceneIndex}`);
            if (startEl) startEl.innerHTML = `<div class="gallery-frame-placeholder error">❌ Lỗi</div>`;
            if (endEl) endEl.innerHTML = `<div class="gallery-frame-placeholder error">❌ Lỗi</div>`;
        },
        onQueueComplete: (stats) => {
            console.log(`🏁 [App/Queue] Queue complete — done: ${stats.done}, error: ${stats.error}, cancelled: ${stats.cancelled}`);
            const progressFill = $('#gen-progress-fill');
            const progressText = $('#gen-progress-text');
            progressFill.style.width = '100%';

            if (stats.cancelled > 0) {
                progressText.textContent = `Đã hủy! ✅ ${stats.done} thành công, ${stats.cancelled} bị hủy`;
                showToast(`⚠️ Đã hủy. ${stats.done} ảnh đã generate.`, 'info');
            } else if (stats.error > 0) {
                progressText.textContent = `Hoàn thành! ✅ ${stats.done} thành công, ${stats.error} lỗi`;
                showToast(`⚠️ ${stats.done * 2} ảnh OK, ${stats.error} scenes lỗi.`, 'info');
            } else {
                progressText.textContent = `${stats.done}/${stats.done} Hoàn thành! ✅`;
                showToast(`🎉 Đã generate ${stats.done * 2} ảnh thành công!`, 'success');
            }

            setState('isGenerating', false);
            $('#btn-generate-all').disabled = false;
            $('#btn-generate-all').style.display = '';
            $('#btn-download-all').disabled = false;
            showCancelButton(false);
            // Re-enable all regen buttons
            // Re-enable all regen buttons
            $$('.btn-regen').forEach(btn => { btn.disabled = false; });
            $$('.btn-edit-start').forEach(btn => { btn.disabled = false; });
            $$('.btn-edit-end').forEach(btn => { btn.disabled = false; });
        },
    });

    $('#btn-generate-all').addEventListener('click', () => {
        generateAllImages();
    });

    $('#btn-download-all').addEventListener('click', () => {
        downloadAllAsZip();
    });

    // Delegated click for zoomable images
    $('#gallery-grid').addEventListener('click', (e) => {
        if (e.target.classList.contains('zoomable-image')) {
            const modal = $('#image-modal');
            const modalImg = $('#image-modal-img');
            if (modal && modalImg) {
                modalImg.src = e.target.src;
                modal.style.display = 'flex';
            }
        }
    });
}

function buildGallery() {
    const state = getState();
    const prompts = state.framePrompts;
    if (prompts.length === 0) return;

    const container = $('#gallery-grid');
    container.innerHTML = '';

    prompts.forEach((fp) => {
        const existing = state.generatedImages[fp.sceneIndex];
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.id = `gallery-item-${fp.sceneIndex}`;

        const numLabel = fp.sceneType === 'intro' ? '🎬' : fp.sceneType === 'outro' ? '🎬' : fp.poseNumber;

        item.innerHTML = `
      <div class="gallery-item-header">
        <div class="gallery-item-title">
          <span class="scene-number">${numLabel}</span>
          ${fp.sceneName}
        </div>
        <span class="badge">${fp.metadata.view}</span>
      </div>
      <div class="gallery-frames">
        <div class="gallery-frame" id="frame-start-${fp.sceneIndex}">
          ${existing?.start
                ? `<span class="gallery-frame-label start">Start</span><img src="${existing.start.blobUrl}" alt="Start frame" class="zoomable-image" style="cursor: zoom-in;">`
                : `<div class="gallery-frame-placeholder"><span class="gallery-frame-label start">Start</span>🟢</div>`
            }
        </div>
        <div class="gallery-frame" id="frame-end-${fp.sceneIndex}">
          ${existing?.end
                ? `<span class="gallery-frame-label end">End</span><img src="${existing.end.blobUrl}" alt="End frame" class="zoomable-image" style="cursor: zoom-in;">`
                : `<div class="gallery-frame-placeholder"><span class="gallery-frame-label end">End</span>🔴</div>`
            }
        </div>
      </div>
      <div class="gallery-item-actions">
        <button class="btn btn-sm btn-outline btn-regen" data-scene="${fp.sceneIndex}">🔄 Re-gen (2 ảnh)</button>
        <button class="btn btn-sm btn-outline btn-edit-start" data-scene="${fp.sceneIndex}">✏️ Sửa Start</button>
        <button class="btn btn-sm btn-outline btn-edit-end" data-scene="${fp.sceneIndex}">✏️ Sửa End</button>
        <button class="btn btn-sm btn-outline btn-ref" data-scene="${fp.sceneIndex}" title="Chọn ảnh tham khảo riêng cho scene này (ghi đè ảnh ở bước 3)">
          ${fp.customReferenceImage ? '✅ Đã chọn mỏ neo' : '🔗 Mỏ neo tham khảo'}
        </button>
        <input type="file" id="ref-upload-${fp.sceneIndex}" accept="image/*" style="display: none;">
      </div>
    `;

        // Re-generate single scene
        item.querySelector('.btn-regen').addEventListener('click', () => {
            generateSingleScene(fp.sceneIndex);
        });

        // Edit single scene START
        item.querySelector('.btn-edit-start').addEventListener('click', () => {
            const editPrompt = window.prompt("Nhập nội dung cần sửa cho khung Start:");
            if (editPrompt && editPrompt.trim()) {
                editSceneWithAI(fp.sceneIndex, editPrompt, 'start');
            }
        });

        // Edit single scene END
        item.querySelector('.btn-edit-end').addEventListener('click', () => {
            const editPrompt = window.prompt("Nhập nội dung cần sửa cho khung End:");
            if (editPrompt && editPrompt.trim()) {
                editSceneWithAI(fp.sceneIndex, editPrompt, 'end');
            }
        });

        // Custom Reference Image setup
        const refBtn = item.querySelector('.btn-ref');
        const refInput = item.querySelector(`#ref-upload-${fp.sceneIndex}`);
        if (refBtn && refInput) {
            refBtn.addEventListener('click', () => refInput.click());
            refInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result.split(',')[1];
                    const currentState = getState();
                    const updatedPrompts = [...currentState.framePrompts];
                    const index = updatedPrompts.findIndex(p => p.sceneIndex === fp.sceneIndex);
                    if (index !== -1) {
                        updatedPrompts[index].customReferenceImage = base64;
                        setState('framePrompts', updatedPrompts);
                    }
                    refBtn.textContent = '✅ Đã chọn mỏ neo';
                    refBtn.style.color = 'var(--accent-success)';
                    refBtn.style.borderColor = 'var(--accent-success)';
                    showToast(`✅ Đã thiết lập mỏ neo cho Scene ${fp.sceneIndex}`, 'success');
                };
                reader.readAsDataURL(file);
            });
        }

        container.appendChild(item);
    });
}

function generateAllImages() {
    const state = getState();
    if (!getActiveApiKey()) {
        showToast('⚠️ Chưa nhập API key! Quay lại Settings.', 'error');
        return;
    }
    if (state.framePrompts.length === 0) {
        showToast('⚠️ Chưa có prompts!', 'error');
        return;
    }

    // Prevent spam: check if already generating
    if (isQueueProcessing()) {
        showToast('⏳ Đang generate, vui lòng đợi...', 'info');
        return;
    }

    // Filter out scenes that already have successfully generated images
    const existingImages = state.generatedImages || {};
    const pendingPrompts = state.framePrompts.filter(fp => {
        const img = existingImages[fp.sceneIndex];
        // Skip if both start AND end frames exist
        return !(img && img.start && img.end);
    });

    if (pendingPrompts.length === 0) {
        showToast('✅ Tất cả scenes đã được generate!', 'success');
        return;
    }

    const skippedCount = state.framePrompts.length - pendingPrompts.length;

    console.group('🖼️ [App] generateAllImages()');
    console.log(`⚙️ [App] Provider: ${state.provider} | Model: ${state.imageModel} | AR: ${state.aspectRatio}`);
    console.log(`📎 [App] Reference images: ${state.referenceImages?.length || 0}`);
    console.log(`⏭️ [App] Skipping ${skippedCount} already-generated scenes`);
    console.log(`🎯 [App] Scenes to generate: ${pendingPrompts.length} (${pendingPrompts.length * 2} images)`);
    console.groupEnd();

    if (skippedCount > 0) {
        showToast(`⏭️ Bỏ qua ${skippedCount} scenes đã có, tiếp tục ${pendingPrompts.length} scenes còn lại`, 'info');
    }

    // Disable all regen buttons while generating all
    $$('.btn-regen').forEach(btn => { btn.disabled = true; });
    $$('.btn-edit-start').forEach(btn => { btn.disabled = true; });
    $$('.btn-edit-end').forEach(btn => { btn.disabled = true; });

    // Only show loading on frames that DON'T have images yet
    pendingPrompts.forEach(fp => {
        const startEl = $(`#frame-start-${fp.sceneIndex}`);
        const endEl = $(`#frame-end-${fp.sceneIndex}`);
        if (startEl) startEl.innerHTML = `<div class="gallery-frame-placeholder pending">⏳ Đang chờ</div>`;
        if (endEl) endEl.innerHTML = `<div class="gallery-frame-placeholder pending">⏳ Đang chờ</div>`;
    });

    // Enqueue only pending scenes — queue will process them sequentially
    enqueueAll(pendingPrompts, {
        apiKey: getActiveApiKey(),
        provider: state.provider,
        model: state.imageModel,
        aspectRatio: state.aspectRatio,
        referenceImages: state.referenceImages,
        environmentImages: state.environmentImages || [],
    });
}

function generateSingleScene(sceneIndex) {
    const state = getState();
    if (!getActiveApiKey()) {
        showToast('⚠️ Chưa nhập API key!', 'error');
        return;
    }

    // Prevent spam: check if this scene or queue is already processing
    if (isQueueProcessing()) {
        showToast('⏳ Đang generate, scene sẽ được xếp hàng...', 'info');
    }

    const fp = state.framePrompts.find(f => f.sceneIndex === sceneIndex);
    if (!fp) return;

    console.group(`🔄 [App] generateSingleScene(${sceneIndex}) → "${fp.sceneName}"`);
    console.log(`⚙️ [App] Provider: ${state.provider} | Model: ${state.imageModel}`);
    console.log(`📎 [App] Reference images: ${state.referenceImages?.length || 0}`);
    console.groupEnd();

    // Show loading state
    const startEl = $(`#frame-start-${sceneIndex}`);
    const endEl = $(`#frame-end-${sceneIndex}`);
    if (startEl) startEl.innerHTML = `<div class="gallery-frame-loading"><div class="spinner"></div><div class="timer" id="frame-start-timer-${sceneIndex}" style="margin-top: 8px; font-family: monospace; font-size: 12px; color: #a855f7;">0.0s</div></div>`;
    if (endEl) endEl.innerHTML = `<div class="gallery-frame-loading"><div class="spinner"></div><div class="timer" id="frame-end-timer-${sceneIndex}" style="margin-top: 8px; font-family: monospace; font-size: 12px; color: #a855f7;">0.0s</div></div>`;

    // Disable the regen button for this scene
    const regenBtn = $(`#gallery-item-${sceneIndex} .btn-regen`);
    const editStartBtn = $(`#gallery-item-${sceneIndex} .btn-edit-start`);
    const editEndBtn = $(`#gallery-item-${sceneIndex} .btn-edit-end`);
    if (regenBtn) regenBtn.disabled = true;
    if (editStartBtn) editStartBtn.disabled = true;
    if (editEndBtn) editEndBtn.disabled = true;

    // Enqueue — it will be processed sequentially
    enqueue(sceneIndex, fp.sceneName, fp, {
        apiKey: getActiveApiKey(),
        provider: state.provider,
        model: state.imageModel,
        aspectRatio: state.aspectRatio,
        referenceImages: state.referenceImages,
        environmentImages: state.environmentImages || [],
    });
}

function editSceneWithAI(sceneIndex, editPrompt, targetFrame) {
    const state = getState();
    if (!getActiveApiKey()) {
        showToast('⚠️ Chưa nhập API key!', 'error');
        return;
    }

    if (isQueueProcessing()) {
        showToast('⏳ Đang generate, scene sẽ được xếp hàng...', 'info');
    }

    const fp = state.framePrompts.find(f => f.sceneIndex === sceneIndex);
    if (!fp) return;

    console.group(`✏️ [App] editSceneWithAI(${sceneIndex}, ${targetFrame}) → "${fp.sceneName}"`);
    console.log(`💬 [App] Edit instruction: ${editPrompt}`);
    console.groupEnd();

    // Show loading state ONLY for the target frame
    const frameEl = targetFrame === 'start' ? $(`#frame-start-${sceneIndex}`) : $(`#frame-end-${sceneIndex}`);
    if (frameEl) {
        frameEl.innerHTML = `<div class="gallery-frame-loading"><div class="spinner"></div><div class="timer" id="frame-${targetFrame}-timer-${sceneIndex}" style="margin-top: 8px; font-family: monospace; font-size: 12px; color: #a855f7;">0.0s</div></div>`;
    }

    // Disable the buttons for this scene
    const regenBtn = $(`#gallery-item-${sceneIndex} .btn-regen`);
    const editStartBtn = $(`#gallery-item-${sceneIndex} .btn-edit-start`);
    const editEndBtn = $(`#gallery-item-${sceneIndex} .btn-edit-end`);
    if (regenBtn) regenBtn.disabled = true;
    if (editStartBtn) editStartBtn.disabled = true;
    if (editEndBtn) editEndBtn.disabled = true;

    // Create a modified framePrompt
    const modifiedFp = JSON.parse(JSON.stringify(fp));
    modifiedFp.sceneName = modifiedFp.sceneName + ` (✏️ Sửa ${targetFrame})`;
    // Append edit instruction so AI fixes the image based on prompt
    if (targetFrame === 'start') {
        modifiedFp.startFrame.prompt = `[LƯU Ý SỬA LỖI/YÊU CẦU: ${editPrompt}] ` + modifiedFp.startFrame.prompt;
    } else {
        modifiedFp.endFrame.prompt = `[LƯU Ý SỬA LỖI/YÊU CẦU: ${editPrompt}] ` + modifiedFp.endFrame.prompt;
    }

    const options = {
        apiKey: getActiveApiKey(),
        provider: state.provider,
        model: state.imageModel,
        aspectRatio: state.aspectRatio,
        referenceImages: state.referenceImages,
        environmentImages: state.environmentImages || [],
        targetFrame: targetFrame
    };

    if (targetFrame === 'end') {
        const existingImages = state.generatedImages || {};
        const existingStart = existingImages[sceneIndex]?.start;
        if (existingStart?.base64) {
            options.referenceImages = [existingStart.base64];
        }
    }

    enqueue(sceneIndex, modifiedFp.sceneName, modifiedFp, options);
}

function updateGalleryFrame(sceneIndex, result, elapsedSec = null) {
    const startEl = $(`#frame-start-${sceneIndex}`);
    const endEl = $(`#frame-end-${sceneIndex}`);
    const timerBadge = elapsedSec ? `<span class="gallery-frame-timer">⏱ ${elapsedSec}s</span>` : '';
    if (result.start && startEl) {
        startEl.innerHTML = `<span class="gallery-frame-label start">Start</span>${timerBadge}<img src="${result.start.blobUrl}" alt="Start" class="zoomable-image" style="cursor: zoom-in;">`;
    }
    if (result.end && endEl) {
        endEl.innerHTML = `<span class="gallery-frame-label end">End</span>${timerBadge}<img src="${result.end.blobUrl}" alt="End" class="zoomable-image" style="cursor: zoom-in;">`;
    }
}

async function downloadAllAsZip() {
    const state = getState();
    const images = state.generatedImages;
    const prompts = state.framePrompts;

    if (Object.keys(images).length === 0 && (!state.parsedScript || state.parsedScript.scenes.length === 0)) {
        showToast('⚠️ Chưa có dữ liệu để download!', 'error');
        return;
    }

    showToast('📦 Đang tạo ZIP...', 'info');

    try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // 1. Export state.json
        const exportState = { ...state };
        delete exportState.isGenerating;

        const cleanImages = {};
        for (const [idx, scene] of Object.entries(exportState.generatedImages || {})) {
            // Include base64 so state.json has the raw image data to restore from
            cleanImages[idx] = {
                start: scene.start ? { base64: scene.start.base64, imageUrl: scene.start.imageUrl || null } : null,
                end: scene.end ? { base64: scene.end.base64, imageUrl: scene.end.imageUrl || null } : null,
            };
        }
        exportState.generatedImages = cleanImages;

        zip.file('state.json', JSON.stringify(exportState));

        // 2. Export images physically for user convenience outside app
        let fileIndex = 1;
        for (const fp of prompts) {
            const imgData = images[fp.sceneIndex];
            if (!imgData) continue;

            const safeName = fp.sceneName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            const prefix = String(fileIndex++).padStart(3, '0');

            if (imgData.start?.base64) {
                zip.file(`${prefix}_${safeName}_start.png`, imgData.start.base64, { base64: true });
            }
            if (imgData.end?.base64) {
                zip.file(`${prefix}_${safeName}_end.png`, imgData.end.base64, { base64: true });
            }
            if (fp.videoPrompt) {
                zip.file(`${prefix}_${safeName}_veo3_prompt.txt`, fp.videoPrompt);
            }
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `yogakids_project_${ts}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ ZIP downloaded!', 'success');
    } catch (err) {
        showToast(`❌ ZIP error: ${err.message}`, 'error');
    }
}

async function loadZipState(file) {
    if (!file) return;
    showToast('📂 Đang đọc file ZIP...', 'info');

    try {
        const JSZip = (await import('jszip')).default;
        const zip = await new JSZip().loadAsync(file);

        const stateFile = zip.file('state.json');
        if (!stateFile) {
            showToast('❌ File ZIP không đúng định dạng (thiếu state.json)', 'error');
            return;
        }

        const stateData = await stateFile.async("string");
        const uploadedState = JSON.parse(stateData);

        // Recreate blob URLs for generated images
        if (uploadedState.generatedImages) {
            for (const idx of Object.keys(uploadedState.generatedImages)) {
                const scene = uploadedState.generatedImages[idx];
                if (scene.start?.base64) {
                    scene.start.blobUrl = base64ToBlobUrl(scene.start.base64);
                }
                if (scene.end?.base64) {
                    scene.end.blobUrl = base64ToBlobUrl(scene.end.base64);
                }
            }
        }

        clearAllState();

        for (const [key, value] of Object.entries(uploadedState)) {
            if (key === 'isGenerating') continue;
            setState(key, value);
        }

        showToast('✅ Đã load project thành công!', 'success');
        rebuildFromState();

    } catch (e) {
        console.error('ZIP Load error:', e);
        showToast(`❌ Lỗi khi load ZIP: ${e.message}`, 'error');
    } finally {
        $('#upload-zip-input').value = '';
    }
}

// ============================================================
// RESTORE STATE
// ============================================================

function restoreState() {
    const state = getState();
    if (state.apiKey) {
        $('#api-key').value = state.apiKey;
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'info') {
    const container = $('#toasts');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// CANCEL BUTTON
// ============================================================

function showCancelButton(show) {
    let cancelBtn = $('#btn-cancel-generate');

    if (show) {
        if (!cancelBtn) {
            // Create cancel button dynamically next to generate button
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel-generate';
            cancelBtn.className = 'btn btn-danger';
            cancelBtn.innerHTML = '⏹️ Hủy Generate';
            cancelBtn.addEventListener('click', () => {
                cancelAll();
                showToast('⏹️ Đang hủy...', 'info');
            });
            // Insert after generate button
            const genBtn = $('#btn-generate-all');
            genBtn.parentNode.insertBefore(cancelBtn, genBtn.nextSibling);
        }
        cancelBtn.style.display = '';
    } else {
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
    }
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

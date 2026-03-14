/**
 * STATE — Persistent reactive state management
 * 
 * - Settings (API key, provider, model, style, etc.) → localStorage
 * - Parsed script, frame prompts, character → localStorage  
 * - Generated images (base64) → IndexedDB (can be very large)
 */

const DB_NAME = 'yogakids_db';
const DB_VERSION = 1;
const DB_STORE = 'images';
const LS_PREFIX = 'yk_';

// Keys that should be persisted to localStorage
const PERSIST_KEYS = [
    'currentStep', 'apiKeys', 'provider', 'imageModel', 'stylePreset',
    'aspectRatio', 'characterDescription', 'environment',
    'parsedScript', 'framePrompts', 'referenceImages', 'environmentImages',
];

const listeners = new Map();

const state = {
    currentStep: 0,
    apiKeys: {
        'google-ai': '',
        'vertex-key': '',
        'gommo': '',
    },
    provider: 'google-ai',
    imageModel: '',
    stylePreset: '3d-cartoon',
    aspectRatio: '16:9',
    characterDescription: 'a cute 3D cartoon girl with long purple braided hair in a high bun, wearing a white sleeveless crop top with gold accents and white yoga leggings with gold trim, barefoot',
    environment: 'on a purple yoga mat, clean white background, minimal scene',
    parsedScript: null,
    framePrompts: [],
    referenceImages: [],  // base64 strings (character reference)
    environmentImages: [], // base64 strings (environment/background reference)
    generatedImages: {},  // { sceneIndex: { start: {base64, blobUrl}, end: {base64, blobUrl} } }
    isGenerating: false,
};

// ============================================================
// PUBLIC API
// ============================================================

export function getState() {
    return state;
}

/**
 * Get the active API key for the currently selected provider.
 */
export function getActiveApiKey() {
    return state.apiKeys[state.provider] || '';
}

/**
 * Set the API key for a specific provider.
 */
export function setApiKey(provider, key) {
    state.apiKeys[provider] = key;
    // Persist whole apiKeys object
    try {
        localStorage.setItem(LS_PREFIX + 'apiKeys', JSON.stringify(state.apiKeys));
    } catch (e) {
        console.warn('[State] Failed to persist apiKeys:', e.message);
    }
}

export function setState(key, value) {
    state[key] = value;
    notifyListeners(key);

    // Auto-persist to localStorage
    if (PERSIST_KEYS.includes(key)) {
        try {
            localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn(`[State] Failed to persist ${key}:`, e.message);
        }
    }

    // If saving images, persist to IndexedDB
    if (key === 'generatedImages') {
        saveImagesToIDB(value);
    }
}

export function onStateChange(key, callback) {
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(callback);
}

// ============================================================
// RESTORE ALL STATE
// ============================================================

/**
 * Restore all persisted state from localStorage + IndexedDB.
 * Call this once on app init.
 * @returns {Promise<void>}
 */
export async function restoreAllState() {
    console.group('💾 [State] Restoring persisted state');

    // 1. Restore from localStorage
    for (const key of PERSIST_KEYS) {
        try {
            const raw = localStorage.getItem(LS_PREFIX + key);
            if (raw !== null) {
                state[key] = JSON.parse(raw);
                console.log(`  ✅ ${key}: restored`);
            }
        } catch (e) {
            console.warn(`  ⚠️ ${key}: failed to parse`, e.message);
        }
    }

    // Also check legacy keys (from before this refactor)
    const legacyMap = {
        'yogakids_api_key': 'apiKey',
        'yogakids_provider': 'provider',
        'yogakids_model': 'imageModel',
        'yogakids_style': 'stylePreset',
    };
    for (const [oldKey, newKey] of Object.entries(legacyMap)) {
        const v = localStorage.getItem(oldKey);
        if (v && !localStorage.getItem(LS_PREFIX + newKey)) {
            state[newKey] = v;
            localStorage.setItem(LS_PREFIX + newKey, JSON.stringify(v));
            console.log(`  🔄 Migrated legacy ${oldKey} → ${newKey}`);
        }
    }

    // Migrate legacy single apiKey → apiKeys object
    const legacyApiKey = localStorage.getItem(LS_PREFIX + 'apiKey');
    if (legacyApiKey) {
        try {
            const key = JSON.parse(legacyApiKey);
            if (key && typeof key === 'string') {
                // Guess which provider this key belongs to
                if (key.includes('|')) {
                    state.apiKeys['gommo'] = key;
                } else if (key.startsWith('vai-')) {
                    state.apiKeys['vertex-key'] = key;
                } else {
                    state.apiKeys['google-ai'] = key;
                }
                // Persist new format and remove old
                localStorage.setItem(LS_PREFIX + 'apiKeys', JSON.stringify(state.apiKeys));
                localStorage.removeItem(LS_PREFIX + 'apiKey');
                console.log('  🔄 Migrated single apiKey → apiKeys');
            }
        } catch { /* ignore */ }
    }

    // 2. Restore images from IndexedDB
    try {
        const images = await loadImagesFromIDB();
        if (images && Object.keys(images).length > 0) {
            // Recreate blob URLs from base64
            for (const idx of Object.keys(images)) {
                const scene = images[idx];
                if (scene.start?.base64) {
                    scene.start.blobUrl = base64ToBlobUrl(scene.start.base64);
                }
                if (scene.end?.base64) {
                    scene.end.blobUrl = base64ToBlobUrl(scene.end.base64);
                }
            }
            state.generatedImages = images;
            console.log(`  🖼️ Restored ${Object.keys(images).length} generated image sets from IndexedDB`);
        }
    } catch (e) {
        console.warn('  ⚠️ Failed to restore images from IndexedDB:', e.message);
    }

    console.groupEnd();
}

/**
 * Clear all persisted state.
 */
export function clearAllState() {
    for (const key of PERSIST_KEYS) {
        localStorage.removeItem(LS_PREFIX + key);
    }
    // Also clear legacy keys
    localStorage.removeItem('yogakids_api_key');
    localStorage.removeItem('yogakids_provider');
    localStorage.removeItem('yogakids_model');
    localStorage.removeItem('yogakids_style');

    clearIDB();
}

/**
 * Clear only project-specific state (script, images, character, etc.)
 * but keep settings (API keys, provider, style, aspect ratio).
 */
export function clearProjectState() {
    const projectKeys = ['parsedScript', 'framePrompts', 'referenceImages', 'environmentImages', 'characterDescription', 'environment'];
    for (const key of projectKeys) {
        localStorage.removeItem(LS_PREFIX + key);
    }

    // Set step to 1 (Script input) for new project
    localStorage.setItem(LS_PREFIX + 'currentStep', JSON.stringify(1));

    clearIDB();
}

// ============================================================
// INDEXEDDB — Image Storage
// ============================================================

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveImagesToIDB(images) {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);

        // Save each scene's image data (base64 only, not blobUrl which is ephemeral)
        const serializable = {};
        for (const [idx, scene] of Object.entries(images)) {
            serializable[idx] = {
                start: scene.start ? { base64: scene.start.base64, imageUrl: scene.start.imageUrl || null } : null,
                end: scene.end ? { base64: scene.end.base64, imageUrl: scene.end.imageUrl || null } : null,
            };
        }

        store.put(serializable, 'generatedImages');
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('[State] Failed to save images to IDB:', e.message);
    }
}

async function loadImagesFromIDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        return new Promise((resolve, reject) => {
            const req = store.get('generatedImages');
            req.onsuccess = () => resolve(req.result || {});
            req.onerror = () => reject(req.error);
        });
    } catch {
        return {};
    }
}

async function clearIDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).clear();
    } catch { /* ignore */ }
}

// ============================================================
// UTILITIES
// ============================================================

function base64ToBlobUrl(base64, mimeType = 'image/png') {
    try {
        const byteChars = atob(base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNums);
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

function notifyListeners(key) {
    const cbs = listeners.get(key) || [];
    cbs.forEach(cb => cb(state[key], state));
}

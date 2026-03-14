/**
 * ============================================================
 * PROMPT GENERATOR v2 — Start/End Frame Architecture
 * ============================================================
 * 
 * THAY ĐỔI LỚN so với v1:
 * - Mỗi pose output 2 prompt: START FRAME + END FRAME
 * - Start = tư thế chuẩn bị / bắt đầu chuyển động
 * - End   = tư thế hoàn thành / giữ (hold position)
 * - Dùng cho video: interpolate giữa 2 frame → animation mượt
 * 
 * Output hiện tại bao gồm startFrame, endFrame và videoPrompt (dành cho Veo 3 hoặc AI Video Generator khác)
 * 
 * OUTPUT PER SCENE:
 * {
 *   sceneName: "Cat Cow",
 *   startFrame: { ... },
 *   endFrame: { ... },
 *   videoPrompt: "A 3D cartoon girl on a purple yoga mat. Action: The character starts by... Then, seamlessly... and holds..."
 * }
 * 
 * TẠI SAO CẦN 2 FRAME?
 * ┌────────────────┐        ┌────────────────┐
 * │  START FRAME   │───────▶│   END FRAME    │
 * │                │  video │                │
 * │  Tư thế bắt   │  tween │  Tư thế hoàn   │
 * │  đầu / chuẩn  │        │  thành / giữ   │
 * │  bị           │        │                │
 * └────────────────┘        └────────────────┘
 * 
 * Ví dụ: "Standing Forward Fold"
 *   Start: Đứng thẳng (Mountain Pose)
 *   End:   Gập người về phía trước, đầu cúi xuống
 */

import { analyzeScene } from './scriptParser.js';

// ============================================================
// STYLE PRESETS
// ============================================================

export const STYLE_PRESETS = {
    '3d-cartoon': {
        name: '3D Cartoon (Pixar-like)',
        description: 'Phong cách 3D hoạt hình như Pixar/Disney',
        stylePrompt: '3D rendered cartoon character, Pixar animation style, soft studio lighting, smooth textures, vibrant colors, clean white background',
    },
    'watercolor': {
        name: 'Watercolor Illustration',
        description: 'Phong cách vẽ màu nước nhẹ nhàng',
        stylePrompt: 'beautiful watercolor illustration, soft pastel colors, delicate brush strokes, gentle gradients, dreamy atmosphere, white paper background',
    },
    'flat-vector': {
        name: 'Flat Vector',
        description: 'Phong cách vector phẳng hiện đại',
        stylePrompt: 'modern flat vector illustration, clean geometric shapes, bold colors, minimalist design, simple background',
    },
    'anime': {
        name: 'Anime/Manga',
        description: 'Phong cách anime Nhật Bản',
        stylePrompt: 'anime illustration style, detailed character, soft shading, cel shading, Japanese animation aesthetic, clean background',
    },
    'realistic-3d': {
        name: 'Realistic 3D',
        description: 'Phong cách 3D chân thực',
        stylePrompt: '3D rendered character, photorealistic lighting, subsurface scattering, high quality textures, studio photography lighting, clean white background',
    },
};

// ============================================================
// POSE KNOWLEDGE BASE — START/END FRAME PAIRS
// ============================================================

/**
 * Mỗi pose có:
 * - start: Tư thế bắt đầu / chuẩn bị
 * - end:   Tư thế hoàn thành / giữ (hold)
 * - transition: Mô tả chuyển động (để tham khảo)
 * - view: Góc camera tốt nhất
 */
const POSE_FRAMES_DB = {

    'easy pose': {
        start: {
            body: 'kneeling on the yoga mat, about to sit down, hands on thighs, back straight',
            eyes: 'eyes open, looking forward',
            expression: 'gentle smile, attentive',
        },
        end: {
            body: 'sitting cross-legged (Sukhasana) on the mat, hands resting gently on knees with palms down, spine tall and elongated, shoulders relaxed',
            eyes: 'eyes gently closed',
            expression: 'calm and serene smile, completely at peace',
        },
        transition: 'settling down into cross-legged seated position',
        view: 'front',
    },

    'downward facing dog': {
        start: {
            body: 'on all fours in tabletop position, hands shoulder-width apart, knees hip-width apart, toes tucked under',
            eyes: 'looking down at the mat',
            expression: 'focused and ready',
        },
        end: {
            body: 'in an inverted V-shape (Downward Dog), hips pressed high up and back, arms and legs straight, heels reaching toward the mat, head relaxed between arms',
            eyes: 'looking toward the toes or navel',
            expression: 'calm and stretched',
        },
        transition: 'lifting hips up and back, straightening arms and legs into an inverted V-shape',
        view: 'side',
    },

    'tree pose': {
        start: {
            body: 'standing tall in Mountain Pose (Tadasana), weight shifting slightly onto the left leg, arms at sides',
            eyes: 'looking straight ahead at a focal point',
            expression: 'focused and balanced',
        },
        end: {
            body: 'standing on one leg, the sole of the right foot resting on the inner left thigh (Tree Pose), knee pointing out to the side, hands pressed together at heart center or raised overhead like branches',
            eyes: 'looking straight ahead unblinking',
            expression: 'peaceful, balanced, and proud',
        },
        transition: 'lifting one foot and placing it on the inner thigh of the opposite standing leg, bringing hands together',
        view: 'front',
    },

    'warrior 1': {
        start: {
            body: 'standing at the front of the mat in Mountain Pose, ready to step one foot back',
            eyes: 'looking straight ahead',
            expression: 'confident and ready',
        },
        end: {
            body: 'in a high lunge with the front knee bent at 90 degrees, back leg extended straight with foot flat and angled slightly outward, hips facing forward, arms reaching straight up overhead, chest lifted',
            eyes: 'looking straight ahead or slightly up',
            expression: 'strong, fierce, and focused',
        },
        transition: 'stepping one foot back, bending the front knee, and sweeping both arms up to the sky',
        view: 'three-quarter',
    },

    'warrior 2': {
        start: {
            body: 'standing in Warrior 1, arms reaching up, facing forward',
            eyes: 'looking forward',
            expression: 'strong and steady',
        },
        end: {
            body: 'hips and chest open to the side, front knee bent at 90 degrees over the ankle, back leg straight, arms extended out parallel to the floor forming a straight line, gaze over the front fingertips',
            eyes: 'looking fiercely over the front hand',
            expression: 'powerful, grounded, and steady',
        },
        transition: 'opening hips, chest, and arms to the side while keeping the front knee bent',
        view: 'side',
    },

    'cobra pose': {
        start: {
            body: 'lying flat on the stomach (prone), hands placed flat on the mat under the shoulders, elbows tucked close to the ribs, legs extended back',
            eyes: 'looking down at the mat',
            expression: 'calm and relaxed',
        },
        end: {
            body: 'chest, head, and shoulders lifted off the mat (Cobra Pose), elbows slightly bent and tucked in, pelvis resting on the mat, tops of the feet pressing down, neck long',
            eyes: 'looking forward and slightly up',
            expression: 'gentle smile, feeling the back stretch',
        },
        transition: 'pressing into the hands to gently curl the chest and head upward away from the mat',
        view: 'side',
    },

    'bridge pose': {
        start: {
            body: 'lying flat on back, knees bent, feet flat on the mat hip-width apart and close to the glutes, arms resting by sides',
            eyes: 'eyes looking up at the ceiling',
            expression: 'calm and centered',
        },
        end: {
            body: 'hips lifted high off the mat, thighs parallel to the floor, chest lifted toward the chin, arms pressing down into the mat or hands clasped together under the back',
            eyes: 'eyes looking up or gently closed',
            expression: 'strong, feeling open and energized',
        },
        transition: 'pressing into the feet and lifting the hips and lower back off the floor',
        view: 'three-quarter-above',
    },

    'gentle neck stretch': {
        start: {
            body: 'sitting cross-legged on the mat, spine tall, head centered and straight, both shoulders level and relaxed',
            eyes: 'eyes softly closed',
            expression: 'calm and centered',
        },
        end: {
            body: 'sitting cross-legged, head tilted gently to the right side, right ear moving toward right shoulder, left arm relaxed by side, shoulders staying level',
            eyes: 'eyes closed',
            expression: 'relaxed and peaceful, feeling the stretch',
        },
        transition: 'slowly tilting head to one side',
        view: 'front',
    },

    'cat cow': {
        start: {
            body: 'on all fours in tabletop position, hands directly under shoulders, knees under hips, spine neutral and flat like a table, toes tucked',
            eyes: 'eyes looking down at the mat',
            expression: 'neutral and focused',
        },
        end: {
            body: 'on all fours, spine rounded upward into a high arch (Cat Pose), chin tucked toward chest, belly pulled in, shoulders broad, tailbone tucked under',
            eyes: 'eyes looking at belly/navel',
            expression: 'calm concentration, gentle engagement',
        },
        transition: 'flowing between cow pose (back arched down) and cat pose (back rounded up)',
        view: 'side',
    },

    "child's pose": {
        start: {
            body: 'kneeling upright on the mat, sitting on heels, arms by sides, back straight tall',
            eyes: 'eyes softly closed',
            expression: 'calm and ready to rest',
        },
        end: {
            body: 'kneeling with hips resting back on heels, torso folded forward over thighs, forehead resting on the mat, arms extended straight forward on the mat with palms down',
            eyes: 'eyes closed',
            expression: 'deeply relaxed, surrendered, peaceful',
        },
        transition: 'folding forward from kneeling to rest on the mat',
        view: 'side',
    },

    'standing forward fold': {
        start: {
            body: 'standing tall in Mountain Pose (Tadasana), feet hip-width apart, arms relaxed by sides, spine long and straight, weight evenly distributed',
            eyes: 'eyes looking forward',
            expression: 'calm and tall, grounded',
        },
        end: {
            body: 'standing with feet hip-width apart, torso folded forward at the hips, upper body hanging down relaxed, head heavy, arms dangling toward the floor or fingertips touching the mat',
            eyes: 'eyes closed',
            expression: 'completely relaxed, letting go',
        },
        transition: 'slowly hinging at hips to fold forward with straight back',
        view: 'side',
    },

    'half lift': {
        start: {
            body: 'standing in forward fold, torso hanging down, hands near the floor, head relaxed',
            eyes: 'eyes looking down',
            expression: 'relaxed',
        },
        end: {
            body: 'standing with flat back parallel to the floor (halfway lifted), hands placed on shins, arms straight, spine long and extended like a table, neck in line with spine',
            eyes: 'eyes gazing softly at the mat a few feet ahead',
            expression: 'focused and steady, engaged',
        },
        transition: 'lifting torso halfway up with a long spine',
        view: 'side',
    },

    'low lunge': {
        start: {
            body: 'standing in forward fold at the front of the mat, both hands on the mat beside feet, ready to step one foot back',
            eyes: 'eyes looking at the mat',
            expression: 'focused preparation',
        },
        end: {
            body: 'right foot forward between hands in a deep lunge, left knee lowered to the mat, hips sinking forward and down, torso upright, arms reaching up overhead with palms together, chest lifted and open',
            eyes: 'eyes looking forward or slightly upward',
            expression: 'confident, open, and strong yet calm',
        },
        transition: 'stepping one foot forward and sinking into a lunge with arms raised',
        view: 'side',
    },

    'gentle lizard pose': {
        start: {
            body: 'in low lunge position, right foot forward, both hands on the mat on either side of the front foot, back knee on the mat',
            eyes: 'eyes looking down at the mat',
            expression: 'calm and focused',
        },
        end: {
            body: 'in a deep lunge, both forearms or both hands placed on the mat INSIDE the right front foot, hips sinking low and heavy, back left leg extended long, chest slightly open to the side',
            eyes: 'eyes looking down softly',
            expression: 'relaxed surrender, feeling the deep hip stretch',
        },
        transition: 'walking both hands to the inside of the front foot and sinking deeper',
        view: 'side',
    },

    'seated forward fold': {
        start: {
            body: 'sitting upright on the mat with both legs extended straight forward (Staff Pose / Dandasana), feet flexed, hands by hips, spine tall',
            eyes: 'eyes looking forward',
            expression: 'alert and upright',
        },
        end: {
            body: 'sitting with both legs straight forward, torso folded forward over the legs, chest moving toward thighs, hands reaching toward or holding feet/ankles, head relaxed toward knees',
            eyes: 'eyes closed',
            expression: 'calm surrender, releasing tension',
        },
        transition: 'hinging at hips to fold forward over straight legs',
        view: 'side',
    },

    'butterfly pose': {
        start: {
            body: 'sitting upright on the mat, legs extended forward, about to bring feet together, hands by sides',
            eyes: 'eyes open, looking down at legs',
            expression: 'attentive and calm',
        },
        end: {
            body: 'sitting tall with soles of feet pressed together close to pelvis, knees falling open outward like butterfly wings, hands gently holding feet or ankles, spine long',
            eyes: 'eyes gently closed',
            expression: 'peaceful and content, soft smile',
        },
        transition: 'drawing feet together and letting knees relax open',
        view: 'front',
    },

    'supine twist': {
        start: {
            body: 'lying flat on back on the mat, both knees bent with feet flat on the mat, arms spread out to sides in a T-shape',
            eyes: 'eyes closed',
            expression: 'relaxed and ready to twist',
        },
        end: {
            body: 'lying on back, both bent knees dropped gently to the left side toward the mat, right shoulder staying grounded on the mat, head turned to the right, arms spread in T-shape',
            eyes: 'eyes closed',
            expression: 'deeply relaxed, feeling a gentle spinal twist',
        },
        transition: 'letting both knees drop to one side while keeping shoulders grounded',
        view: 'three-quarter-above',
    },

    'knees to chest': {
        start: {
            body: 'lying flat on back on the mat, legs extended straight, arms by sides, relaxed',
            eyes: 'eyes closed',
            expression: 'relaxed and still',
        },
        end: {
            body: 'lying on back, both knees drawn in and hugged tightly to chest, arms wrapped around shins, chin slightly tucked, lower back pressing gently into the mat',
            eyes: 'eyes closed',
            expression: 'cozy, comfortable, self-soothing',
        },
        transition: 'drawing knees up and hugging them into chest',
        view: 'side',
    },

    'happy baby': {
        start: {
            body: 'lying on back, knees bent, feet flat on the mat, arms by sides',
            eyes: 'eyes closed',
            expression: 'relaxed and ready',
        },
        end: {
            body: 'lying on back, knees bent and drawn toward armpits, soles of feet facing the ceiling, hands grabbing the outside edges of feet, knees wide apart, gently rocking side to side',
            eyes: 'eyes closed with a playful smile',
            expression: 'playful, happy, childlike joy',
        },
        transition: 'lifting feet up and grasping them with hands, opening knees wide',
        view: 'three-quarter-above',
    },

    'legs up the wall': {
        start: {
            body: 'sitting sideways next to a wall on the mat, about to swing legs up',
            eyes: 'eyes open',
            expression: 'preparing to transition',
        },
        end: {
            body: 'lying on back with buttocks close to the wall, both legs extended straight up resting against the wall, arms relaxed by sides with palms up, whole body forming an L-shape',
            eyes: 'eyes closed',
            expression: 'very calm, restorative, completely at rest',
        },
        transition: 'swinging legs up against the wall while lying back',
        view: 'side',
    },

    'savasana': {
        start: {
            body: 'lying on back, gently adjusting position, arms moving to sides, legs straightening out',
            eyes: 'eyes still open, blinking slowly',
            expression: 'settling in, preparing to fully relax',
        },
        end: {
            body: 'lying completely flat on back, legs slightly apart and relaxed outward, arms resting a few inches from body with palms facing up, fingers naturally curled, whole body melted into the mat, jaw relaxed',
            eyes: 'eyes completely closed',
            expression: 'completely peaceful, deeply relaxed, almost asleep',
        },
        transition: 'letting go of all muscle tension, body sinking into the mat',
        view: 'three-quarter-above',
    },
};

// Intro/Outro frame definitions
const SPECIAL_FRAMES = {
    intro: {
        start: {
            body: 'standing at the front edge of the yoga mat, feet together in Mountain Pose, hands at sides, looking forward with a warm welcoming expression',
            eyes: 'eyes open, warm gaze',
            expression: 'friendly welcoming smile',
        },
        end: {
            body: 'standing tall on the mat, hands pressed together at heart center in prayer position (Namaste), slight respectful bow of the head',
            eyes: 'eyes gently closed',
            expression: 'warm, inviting, peaceful smile',
        },
        view: 'front',
    },
    outro: {
        start: {
            body: 'sitting cross-legged on the mat, slowly bringing hands together at heart center',
            eyes: 'eyes softly closing',
            expression: 'grateful and serene',
        },
        end: {
            body: 'sitting cross-legged on the mat, hands pressed together at heart center in prayer position (Namaste), gentle bow of the head, radiating gratitude',
            eyes: 'eyes closed',
            expression: 'deeply grateful, peaceful, content smile',
        },
        view: 'front',
    },
};

// ============================================================
// DEFAULT SETTINGS
// ============================================================

export const DEFAULT_SETTINGS = {
    characterDescription: 'a cute 3D cartoon girl with long purple braided hair in a high bun, wearing a white sleeveless crop top with gold accents and white yoga leggings with gold trim, barefoot',
    environment: 'on a purple yoga mat, clean white background, minimal scene',
    stylePreset: '3d-cartoon',
    aspectRatio: '16:9',
    imageSize: '2K',
    usePoseDatabase: true,
};

// ============================================================
// MAIN: GENERATE START/END FRAME PROMPTS
// ============================================================

/**
 * Generate START + END frame prompts cho 1 scene.
 * 
 * @param {Object} scene - Scene từ scriptParser
 * @param {Object} settings - Prompt settings
 * @returns {Object} { sceneName, startFrame, endFrame, transition, metadata }
 */
export function generateFramePrompts(scene, settings = {}) {
    console.group(`🎨 [PromptGen] Scene #${scene.index}: "${scene.name}" (${scene.type})`);

    const config = { ...DEFAULT_SETTINGS, ...settings };
    const stylePreset = STYLE_PRESETS[config.stylePreset] || STYLE_PRESETS['3d-cartoon'];
    console.log(`🎭 [PromptGen] Style: ${config.stylePreset} | View: ${config.aspectRatio} | Size: ${config.imageSize}`);

    const analysis = analyzeScene(scene);
    console.log(`🔍 [PromptGen] Analysis:`, { standing: analysis.isStanding, sitting: analysis.isSitting, lying: analysis.isLying, suggestedView: analysis.suggestedView, bodyParts: analysis.bodyParts });

    // Get frame data from DB
    const frames = getFrameData(scene, config);

    // Build START frame prompt
    const startFrame = buildFramePrompt({
        frameType: 'start',
        frameData: frames.start,
        scene,
        config,
        stylePreset,
        analysis,
        view: frames.view,
    });
    console.log(`🟢 [PromptGen] START prompt (${startFrame.prompt.length} chars): "${startFrame.prompt.substring(0, 80)}..."`);

    // Build END frame prompt
    const endFrame = buildFramePrompt({
        frameType: 'end',
        frameData: frames.end,
        scene,
        config,
        stylePreset,
        analysis,
        view: frames.view,
    });
    // Build VIDEO / VEO 3 prompt
    const videoPrompt = buildVideoPrompt({
        frames: frames,
        scene
    });
    console.log(`🎬 [PromptGen] VIDEO prompt (${videoPrompt.length} chars): "${videoPrompt.substring(0, 80)}..."`);

    console.groupEnd();

    return {
        sceneIndex: scene.index,
        sceneName: scene.name,
        sceneType: scene.type,
        poseNumber: scene.number,
        startFrame,
        endFrame,
        videoPrompt,
        transition: frames.transition || '',
        metadata: {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize,
            stylePreset: config.stylePreset,
            view: frames.view,
        },
    };
}

/**
 * Generate frame prompts cho TẤT CẢ scenes.
 */
export function generateAllFramePrompts(parsedScript, settings = {}) {
    console.group(`🎨 [PromptGen] generateAllFramePrompts — ${parsedScript.scenes.length} scenes`);
    console.time('⏱️ generateAllFramePrompts duration');

    const results = parsedScript.scenes.map(scene =>
        generateFramePrompts(scene, settings)
    );

    console.log(`✅ [PromptGen] Generated ${results.length} scene prompts (${results.length * 2} total frames)`);
    console.timeEnd('⏱️ generateAllFramePrompts duration');
    console.groupEnd();

    return results;
}

// ============================================================
// FRAME BUILDERS
// ============================================================

/**
 * Build Veo 3 Video Prompt (Action prompt for video generation)
 */
function buildVideoPrompt({ frames, scene }) {
    // Veo 3 Image-to-Video feature (with both start and end frames) requires the text prompt
    // to focus primarily on the transition, action, and camera movement. 
    // It should NOT overly describe the character or environment as the initial/final images provide that context.
    const prompt = [
        `A slow, smooth, and seamless video transition from the start frame to the end frame.`,
        `Action: The character naturally and gracefully completes the ${scene.name} yoga movement by ${frames.transition}.`,
        `The animation is physically accurate, relaxing, and fluid.`,
        `The camera remains steady.`
    ].join(' ');

    return prompt;
}

/**
 * Build 1 frame prompt (start hoặc end)
 */
function buildFramePrompt({ frameType, frameData, scene, config, stylePreset, analysis, view }) {
    // Build environment layer with consistency emphasis
    let environmentLayer = config.environment;
    if (environmentLayer) {
        environmentLayer = `${environmentLayer}. The environment, background, floor/mat, and lighting must remain exactly consistent across all frames`;
    }

    const layers = {
        character: config.characterDescription,
        pose: `${scene.name} yoga pose — ${frameType === 'start' ? 'starting position' : 'final hold position'}, ${frameData.body}`,
        expression: `${frameData.eyes}, ${frameData.expression}`,
        environment: environmentLayer,
        style: stylePreset.stylePrompt,
        composition: getCompositionForView(view),
    };

    const prompt = [
        layers.character,
        layers.pose,
        layers.expression,
        layers.environment,
        layers.style,
        layers.composition,
    ].filter(Boolean).join('. ') + '.';

    return {
        type: frameType,
        prompt,
        layers,
        poseDescription: frameData.body,
    };
}

/**
 * Get frame data (start/end) từ DB hoặc fallback
 */
function getFrameData(scene, config) {
    // Special scenes (intro/outro)
    if (scene.type === 'intro') {
        console.log(`📌 [PromptGen] Using SPECIAL_FRAMES.intro`);
        return { ...SPECIAL_FRAMES.intro, transition: 'welcoming gesture' };
    }
    if (scene.type === 'outro') {
        console.log(`📌 [PromptGen] Using SPECIAL_FRAMES.outro`);
        return { ...SPECIAL_FRAMES.outro, transition: 'closing gratitude' };
    }

    // Tìm trong pose DB
    const poseName = scene.name.toLowerCase().trim();
    if (config.usePoseDatabase) {
        const poseData = findPoseInDB(poseName);
        if (poseData) {
            console.log(`✅ [PromptGen] DB HIT for "${poseName}" → found in POSE_FRAMES_DB`);
            return poseData;
        }
        console.warn(`⚠️ [PromptGen] DB MISS for "${poseName}" → using fallback`);
    }

    // Fallback: tự tạo từ script text
    return buildFallbackFrames(scene);
}

/**
 * Fallback: tạo start/end frames từ script lines khi pose không có trong DB
 */
function buildFallbackFrames(scene) {
    const lines = scene.lines.filter(l => l.trim().length > 0);

    // Start = first line instruction, End = main descriptive line
    const startDesc = lines.length > 0
        ? lines[0]
        : `preparing for ${scene.name}`;
    const endDesc = lines.length > 1
        ? lines.slice(0, 2).join(', ')
        : startDesc;

    return {
        start: {
            body: `preparing for ${scene.name}, ${startDesc.toLowerCase()}`,
            eyes: 'eyes open, focused',
            expression: 'calm and attentive',
        },
        end: {
            body: `holding ${scene.name} pose, ${endDesc.toLowerCase()}`,
            eyes: 'eyes gently closed',
            expression: 'calm and peaceful',
        },
        transition: `moving into ${scene.name}`,
        view: 'three-quarter',
    };
}

/**
 * Get composition string from view type
 */
function getCompositionForView(view) {
    const viewMap = {
        'front': 'front view, full body shot, centered composition',
        'side': 'side profile view, full body shot, clean composition',
        'three-quarter': 'three-quarter view, full body shot, dynamic angle',
        'three-quarter-above': 'three-quarter view from slightly above, full body visible, clear composition',
    };
    return viewMap[view] || viewMap['three-quarter'];
}

/**
 * Find pose in DB (fuzzy matching)
 */
function findPoseInDB(poseName) {
    if (POSE_FRAMES_DB[poseName]) return POSE_FRAMES_DB[poseName];
    for (const [key, value] of Object.entries(POSE_FRAMES_DB)) {
        if (poseName.includes(key) || key.includes(poseName)) return value;
    }
    return null;
}

// ============================================================
// EDITING UTILITIES
// ============================================================

/**
 * Override 1 layer trong start hoặc end frame
 */
export function overrideFrameLayer(framePrompts, frameType, layerName, newValue) {
    const frame = frameType === 'start' ? framePrompts.startFrame : framePrompts.endFrame;
    const newLayers = { ...frame.layers, [layerName]: newValue };
    const newPrompt = Object.values(newLayers).filter(Boolean).join('. ') + '.';

    const updatedFrame = { ...frame, prompt: newPrompt, layers: newLayers };
    return {
        ...framePrompts,
        [frameType === 'start' ? 'startFrame' : 'endFrame']: updatedFrame,
    };
}

/**
 * Set custom prompt cho 1 frame (bypass layers)
 */
export function setCustomFramePrompt(framePrompts, frameType, customPrompt) {
    const key = frameType === 'start' ? 'startFrame' : 'endFrame';
    return {
        ...framePrompts,
        [key]: { ...framePrompts[key], prompt: customPrompt, isCustom: true },
    };
}

// Keep backward compatibility
export { POSE_FRAMES_DB, SPECIAL_FRAMES };

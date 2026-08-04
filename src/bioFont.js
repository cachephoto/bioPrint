// ============================================================
// bioFont.js - Bitmap Font Renderer for bioPrint UI
// Renders all UI text using bitmap sprite fonts
// ============================================================

const FONT_BASE_PATH = '/fonts/bitmap/';
const DEFAULT_FONT = 'tecno';
const FALLBACK_FONTS = ['tecno', 'habit', 'armada'];

// Font cache
const fontCache = {};
let currentFontName = DEFAULT_FONT;
let fontReady = false;
let fontReadyCallbacks = [];

/**
 * Load a bitmap font (JSON metadata + PNG atlas)
 */
async function loadBitmapFont(fontName) {
    if (fontCache[fontName]) return fontCache[fontName];

    // Check if font is in a subfolder or root
    let jsonPath, pngPath;
    const subfolderPath = `${FONT_BASE_PATH}${fontName}/${fontName}.json`;
    jsonPath = subfolderPath;
    pngPath = `${FONT_BASE_PATH}${fontName}/${fontName}.png`;

    try {
        const response = await fetch(jsonPath);
        if (!response.ok) throw new Error(`Font JSON not found: ${jsonPath}`);
        const metadata = await response.json();

        const atlas = new Image();
        atlas.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
            atlas.onload = resolve;
            atlas.onerror = reject;
            atlas.src = pngPath;
        });

        // Build glyph lookup map
        const glyphMap = {};
        metadata.glyphs.forEach((g, index) => {
            glyphMap[g.chr] = { ...g, index };
        });

        const font = {
            name: fontName,
            atlas,
            metadata,
            glyphMap,
            cols: metadata.cols,
            rows: metadata.rows,
            tileW: metadata.tile_w,
            tileH: metadata.tile_h,
            baseline: metadata.baseline,
            lineGap: metadata.line_gap || 0,
            spaceW: metadata.space_w || metadata.tile_w
        };

        fontCache[fontName] = font;
        return font;
    } catch (e) {
        console.warn(`bioFont: Could not load font "${fontName}":`, e.message);
        return null;
    }
}

/**
 * Render text to a canvas using bitmap font
 */
function renderBitmapText(text, options = {}) {
    const {
        fontName = currentFontName,
        scale = 1,
        color = null, // null = use original colors, or CSS color string
        maxWidth = null,
        lineHeight = null
    } = options;

    const font = fontCache[fontName];
    if (!font) return null;

    const { atlas, glyphMap, cols, tileW, tileH, spaceW, lineGap } = font;
    const effectiveLineHeight = lineHeight || (tileH + lineGap);

    // Split text into lines (handle \n and word wrap)
    let lines = text.split('\n');

    // Word wrap if maxWidth specified
    if (maxWidth) {
        const wrappedLines = [];
        lines.forEach(line => {
            let currentLine = '';
            let currentWidth = 0;
            const words = line.split(' ');

            words.forEach((word, i) => {
                const wordWidth = measureWord(word, font) * scale;
                const spaceWidth = spaceW * scale;

                if (currentWidth + wordWidth > maxWidth && currentLine) {
                    wrappedLines.push(currentLine);
                    currentLine = word;
                    currentWidth = wordWidth;
                } else {
                    currentLine += (i > 0 ? ' ' : '') + word;
                    currentWidth += (i > 0 ? spaceWidth : 0) + wordWidth;
                }
            });
            if (currentLine) wrappedLines.push(currentLine);
        });
        lines = wrappedLines;
    }

    // Calculate total dimensions
    let maxLineWidth = 0;
    lines.forEach(line => {
        const w = measureLine(line, font) * scale;
        if (w > maxLineWidth) maxLineWidth = w;
    });

    const totalHeight = lines.length * effectiveLineHeight * scale;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(maxLineWidth) || 1;
    canvas.height = Math.ceil(totalHeight) || 1;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = false;

    // Render each line
    lines.forEach((line, lineIdx) => {
        let x = 0;
        const y = lineIdx * effectiveLineHeight * scale;

        for (let i = 0; i < line.length; i++) {
            const chr = line[i];

            if (chr === ' ') {
                x += spaceW * scale;
                continue;
            }

            const glyph = glyphMap[chr];
            if (!glyph) {
                x += spaceW * scale;
                continue;
            }

            // Calculate source position in atlas
            const srcCol = glyph.index % cols;
            const srcRow = Math.floor(glyph.index / cols);
            const srcX = srcCol * tileW;
            const srcY = srcRow * tileH;

            // Draw glyph
            ctx.drawImage(
                atlas,
                srcX, srcY, tileW, tileH,
                Math.round(x + (glyph.lsb || 0) * scale), Math.round(y),
                tileW * scale, tileH * scale
            );

            x += (glyph.adv || tileW) * scale;
        }
    });

    // Apply color tint if specified
    if (color) {
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    return canvas;
}

function measureWord(word, font) {
    let width = 0;
    for (let i = 0; i < word.length; i++) {
        const glyph = font.glyphMap[word[i]];
        width += glyph ? (glyph.adv || font.tileW) : font.spaceW;
    }
    return width;
}

function measureLine(line, font) {
    let width = 0;
    for (let i = 0; i < line.length; i++) {
        const chr = line[i];
        if (chr === ' ') {
            width += font.spaceW;
        } else {
            const glyph = font.glyphMap[chr];
            width += glyph ? (glyph.adv || font.tileW) : font.spaceW;
        }
    }
    return width;
}

/**
 * Replace a DOM element's text with bitmap-rendered canvas
 */
function replaceWithBitmapText(element, options = {}) {
    if (!fontReady || !element) return;
    if (element.dataset.bioFontApplied === 'true') return;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return;

    const text = element.textContent || element.innerText;
    if (!text || !text.trim()) return;

    const computedStyle = window.getComputedStyle(element);
    const fontSize = parseFloat(computedStyle.fontSize);
    const scale = Math.max(1, Math.round(fontSize / fontCache[currentFontName]?.tileH || 1));
    const color = options.color || computedStyle.color;

    const canvas = renderBitmapText(text, {
        scale,
        color,
        maxWidth: element.offsetWidth || null,
        ...options
    });

    if (!canvas) return;

    canvas.style.display = 'inline-block';
    canvas.style.verticalAlign = 'middle';
    canvas.style.imageRendering = 'pixelated';
    canvas.classList.add('bio-font-canvas');
    canvas.dataset.originalText = text;

    element.dataset.bioFontApplied = 'true';
    element.style.fontSize = '0';
    element.style.overflow = 'hidden';
    element.insertBefore(canvas, element.firstChild);
}

/**
 * Apply bitmap font to all matching elements in the DOM
 */
function applyBitmapFontToUI() {
    if (!fontReady) return;

    // Target all text-bearing UI elements
    const selectors = [
        '#bio-menu .bio-menu-title',
        '#bio-menu .bio-menu-tab',
        '#bio-menu .bio-menu-item-cmd',
        '#bio-menu .bio-menu-item-desc',
        '#bio-menu .bio-menu-category-title',
        '#bio-menu .bio-menu-model-name',
        '#bio-menu .bio-menu-model-file',
        '#terminal-output div',
        '.terminal-command',
        '.terminal-success',
        '.terminal-error',
        '#controls button',
        '.autocomplete-item-cmd',
        '.autocomplete-item-desc',
        '.bio-font-target'
    ];

    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            replaceWithBitmapText(el);
        });
    });
}

/**
 * Create a bitmap text element directly (for dynamic content)
 */
function createBitmapTextElement(text, options = {}) {
    const canvas = renderBitmapText(text, { scale: options.scale || 1, color: options.color || '#ffffff', ...options });
    if (!canvas) return null;
    canvas.style.imageRendering = 'pixelated';
    canvas.classList.add('bio-font-canvas');
    canvas.dataset.originalText = text;
    return canvas;
}

/**
 * Initialize the bitmap font system
 */
async function initBioFont(fontName) {
    currentFontName = fontName || DEFAULT_FONT;

    const font = await loadBitmapFont(currentFontName);
    if (!font) {
        // Try fallbacks
        for (const fb of FALLBACK_FONTS) {
            const f = await loadBitmapFont(fb);
            if (f) {
                currentFontName = fb;
                break;
            }
        }
    }

    if (fontCache[currentFontName]) {
        fontReady = true;
        fontReadyCallbacks.forEach(cb => cb());
        fontReadyCallbacks = [];

        // Inject global CSS for bitmap font rendering
        injectBioFontCSS();

        // Initial application
        setTimeout(() => applyBitmapFontToUI(), 200);

        // Observe DOM changes to apply font to new elements
        observeDOMChanges();

        console.log(`bioFont: "${currentFontName}" loaded and active`);
    } else {
        console.error('bioFont: No font could be loaded');
    }
}

function onFontReady(callback) {
    if (fontReady) {
        callback();
    } else {
        fontReadyCallbacks.push(callback);
    }
}

function injectBioFontCSS() {
    if (document.getElementById('bio-font-css')) return;
    const style = document.createElement('style');
    style.id = 'bio-font-css';
    style.textContent = `
        .bio-font-canvas {
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            pointer-events: none;
        }
        /* Override fonts for all UI to use monospace as fallback while bitmap loads */
        #bio-menu, #terminal-console, #controls, .bio-font-target,
        #bio-menu *, #terminal-console *, #controls * {
            font-family: monospace !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * MutationObserver to apply bitmap font to dynamically added elements
 */
function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(m => {
            if (m.addedNodes.length > 0) shouldUpdate = true;
        });
        if (shouldUpdate) {
            // Debounce
            clearTimeout(observeDOMChanges._timer);
            observeDOMChanges._timer = setTimeout(() => applyBitmapFontToUI(), 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Change the active font at runtime
 */
async function changeBioFont(fontName) {
    const font = await loadBitmapFont(fontName);
    if (font) {
        currentFontName = fontName;
        // Remove all existing bitmap renders so they get re-rendered
        document.querySelectorAll('.bio-font-canvas').forEach(c => {
            const parent = c.parentElement;
            if (parent) {
                parent.dataset.bioFontApplied = 'false';
                parent.style.fontSize = '';
                c.remove();
            }
        });
        applyBitmapFontToUI();
        console.log(`bioFont: Switched to "${fontName}"`);
    } else {
        console.warn(`bioFont: Font "${fontName}" not available`);
    }
}

/**
 * Get list of available fonts (by scanning known fonts)
 */
function getAvailableFonts() {
    return [
        'tecno', 'tecno_large', 'tecno_thin', 'tecno_small',
        'habit', 'habit_large', 'habit_mono', 'habit_narrow', 'habit_small',
        'armada', 'armada_black', 'armada_narrow', 'armada_small',
        'virtue', 'virtue_large', 'virtue_mono', 'virtue_narrow',
        'faraway', 'faraway_black', 'faraway_mono', 'faraway_large',
        'pomme', 'pomme_mono', 'pomme_thin',
        'amaze', 'amaze_small',
        'beaver', 'beaver_mono',
        'burger', 'burger_large',
        'corvette', 'dagger', 'deus',
        'chirp', 'chirp_large',
        'chomp', 'chrono',
        'cloak', 'embalm', 'exam', 'exam_sans',
        'foresight', 'grandfather', 'groundhog',
        'huevo', 'huevo_wide',
        'maple', 'medallion', 'mint',
        'oaknut', 'oboe', 'owlet', 'owlet_large', 'ozone',
        'pickle', 'quip', 'quip_large', 'quip_mono',
        'railgun', 'rivet', 'scarab', 'scoop',
        'slapduck', 'snuggle', 'snuggle_large',
        'spellbook', 'spellbook_large', 'spellbook_small',
        'summit', 'summit_large', 'summit_thin',
        'udon', 'afterlife', 'banter', 'banter_large', 'capy'
    ];
}

// Expose globally
window.initBioFont = initBioFont;
window.changeBioFont = changeBioFont;
window.renderBitmapText = renderBitmapText;
window.createBitmapTextElement = createBitmapTextElement;
window.applyBitmapFontToUI = applyBitmapFontToUI;
window.getAvailableFonts = getAvailableFonts;

export {
    initBioFont,
    changeBioFont,
    renderBitmapText,
    createBitmapTextElement,
    applyBitmapFontToUI,
    getAvailableFonts,
    onFontReady,
    loadBitmapFont
};

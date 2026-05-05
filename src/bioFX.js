import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

let composer;
let colorPass;
let bloomPass;
let glitchPass;

// Shader personalizado para el efecto de color
const ColorShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'color': { value: new THREE.Color(1, 0, 0) },
        'intensity': { value: 0.5 },
        'blendType': { value: 0 } // 0: normal, 1: multiply, 2: screen, 3: overlay
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 color;
        uniform float intensity;
        uniform int blendType;
        varying vec2 vUv;

        vec4 blendMultiply(vec4 base, vec4 blend) {
            return base * blend;
        }

        vec4 blendScreen(vec4 base, vec4 blend) {
            return 1.0 - (1.0 - base) * (1.0 - blend);
        }

        vec4 blendOverlay(vec4 base, vec4 blend) {
            vec4 result;
            for(int i = 0; i < 3; i++) {
                if(base[i] < 0.5) {
                    result[i] = 2.0 * base[i] * blend[i];
                } else {
                    result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - blend[i]);
                }
            }
            result.a = base.a;
            return result;
        }

        void main() {
            vec4 originalColor = texture2D(tDiffuse, vUv);
            vec4 overlayColor = vec4(color, 1.0);
            vec4 blendedColor;
            
            if(blendType == 1) {
                blendedColor = blendMultiply(originalColor, overlayColor);
            } else if(blendType == 2) {
                blendedColor = blendScreen(originalColor, overlayColor);
            } else if(blendType == 3) {
                blendedColor = blendOverlay(originalColor, overlayColor);
            } else {
                blendedColor = mix(originalColor, overlayColor, intensity);
            }
            
            gl_FragColor = mix(originalColor, blendedColor, intensity);
        }
    `
};

// 🔥 Shader personalizado para efectos glitch tradicionales
const GlitchShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'intensity': { value: 0.0 },
        'rgbShift': { value: 0.005 },
        'scanlines': { value: 0.5 },
        'pixelation': { value: 1.0 },
        'digitalNoise': { value: 0.2 },
        'blockSize': { value: 16.0 },
        'distortion': { value: 0.1 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        uniform float rgbShift;
        uniform float scanlines;
        uniform float pixelation;
        uniform float digitalNoise;
        uniform float blockSize;
        uniform float distortion;
        varying vec2 vUv;

        // Función de ruido
        float random(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Función de ruido 2D más compleja
        float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
            vec2 uv = vUv;
            
            // Solo aplicar efectos si la intensidad es mayor a 0
            if (intensity <= 0.0) {
                gl_FragColor = texture2D(tDiffuse, uv);
                return;
            }
            
            // 🔥 REFRACCIÓN EN BLOQUES (Bloques que se desplazan)
            vec2 blockSize = vec2(16.0, 16.0); // Tamaño fijo de bloques para refracción
            vec2 blockID = floor(uv * blockSize);
            vec2 blockUV = fract(uv * blockSize);
            
            // Crear desplazamiento aleatorio por bloque
            float blockRandom = random(blockID + floor(time * 2.0));
            vec2 blockOffset = vec2(0.0);
            
            if (blockRandom > 0.8) {
                // Desplazar algunos bloques horizontalmente
                blockOffset.x = (random(blockID + 1.0) - 0.5) * 0.1 * intensity;
            }
            if (blockRandom > 0.85) {
                // Desplazar algunos bloques verticalmente  
                blockOffset.y = (random(blockID + 2.0) - 0.5) * 0.05 * intensity;
            }
            
            // Aplicar desplazamiento de bloque
            uv += blockOffset;
            
            // 🔥 DISTORSIÓN HORIZONTAL (Scanlines clásicas)
            float distortionAmount = sin(uv.y * 800.0 + time * 10.0) * distortion * intensity;
            uv.x += distortionAmount;
            
            // 🔥 REFRACCIÓN ADICIONAL EN BLOQUES
            vec2 refractionBlockID = floor(uv * 20.0); // Bloques más pequeños para refracción
            float refractionNoise = noise(refractionBlockID + time * 0.3);
            if (refractionNoise > 0.75) {
                // Refractar la luz en este bloque
                vec2 refractionOffset = vec2(
                    (random(refractionBlockID) - 0.5) * 0.08 * intensity,
                    (random(refractionBlockID + 1.0) - 0.5) * 0.08 * intensity
                );
                uv += refractionOffset;
            }
            
            // 🔥 DESPLAZAMIENTO RGB (Chromatic aberration)
            float rgbShiftAmount = rgbShift * intensity;
            vec4 r = texture2D(tDiffuse, uv + vec2(rgbShiftAmount, 0.0));
            vec4 g = texture2D(tDiffuse, uv);
            vec4 b = texture2D(tDiffuse, uv - vec2(rgbShiftAmount, 0.0));
            
            vec4 color = vec4(r.r, g.g, b.b, g.a);
            
            // 🔥 TINTE ROJO TOTAL MULTIPLICADO
            vec3 redMultiplier = vec3(1.0 + intensity * 0.5, 0.3, 0.3); // Rojo intenso, verde/azul reducidos
            color.rgb *= redMultiplier; // Multiplicar por el rojo
            
            // 🔥 SCANLINES TRADICIONALES
            float scanlineEffect = sin(uv.y * 800.0) * 0.04;
            color.rgb += scanlineEffect * scanlines * intensity;
            
            // 🔥 RUIDO DIGITAL ALEATORIO
            float digitalNoiseValue = random(uv + time * 0.1) * digitalNoise * intensity;
            color.rgb += digitalNoiseValue;
            
            // 🔥 INTENSIFICACIÓN ROJA EN BLOQUES REFRACTADOS
            vec2 redIntensityBlockID = floor(vUv * 12.0); // Bloques para intensificar rojo
            float redIntensityNoise = random(redIntensityBlockID + floor(time * 1.5));
            if (redIntensityNoise > 0.8) {
                // Intensificar el rojo en este bloque
                color.r *= 1.2 + intensity * 0.3;
                color.g *= 0.5;
                color.b *= 0.4;
            }
            
            // 🔥 EFECTO DE TEAR/DESPLAZAMIENTO VERTICAL
            float tearChance = random(vec2(floor(time * 2.0)));
            if (tearChance > 0.9) {
                float tearOffset = (random(vec2(time)) - 0.5) * 0.3 * intensity;
                color = texture2D(tDiffuse, vec2(uv.x + tearOffset, uv.y));
            }
            
            // Asegurar que el efecto es más visible cuando la intensidad es alta
            color = mix(texture2D(tDiffuse, vUv), color, intensity);
            
            gl_FragColor = color;
        }
    `
};

export function initBioFX(renderer, scene, camera) {
    composer = new EffectComposer(renderer);
    
    // Paso de renderizado básico
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Paso del efecto bloom
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.0,    // intensity
        0.4,    // radius
        0.85    // threshold
    );
    composer.addPass(bloomPass);

    // Paso del efecto de color
    colorPass = new ShaderPass(ColorShader);
    composer.addPass(colorPass);

    // 🔥 Paso del efecto glitch tradicional
    glitchPass = new ShaderPass(GlitchShader);
    glitchPass.renderToScreen = true;
    composer.addPass(glitchPass);
}

export function setColorEffect(color, intensity, blendType = 0) {
    if (colorPass) {
        colorPass.uniforms.color.value.setHex(color);
        colorPass.uniforms.intensity.value = intensity;
        colorPass.uniforms.blendType.value = blendType;
    }
}

export function setBloomEffect(intensity, radius = 0.4, threshold = 0.85) {
    if (bloomPass) {
        bloomPass.strength = intensity;
        bloomPass.radius = radius;
        bloomPass.threshold = threshold;
    }
}

// 🔥 Funciones para controlar el efecto glitch tradicional
export function setGlitchEffect(intensity, time = 0) {
    if (glitchPass) {
        glitchPass.uniforms.intensity.value = intensity;
        glitchPass.uniforms.time.value = time;
    }
}

export function updateGlitchTime(time) {
    if (glitchPass) {
        glitchPass.uniforms.time.value = time;
    }
}

export function setGlitchParameters(params = {}) {
    if (glitchPass) {
        if (params.rgbShift !== undefined) glitchPass.uniforms.rgbShift.value = params.rgbShift;
        if (params.scanlines !== undefined) glitchPass.uniforms.scanlines.value = params.scanlines;
        if (params.pixelation !== undefined) glitchPass.uniforms.pixelation.value = params.pixelation;
        if (params.digitalNoise !== undefined) glitchPass.uniforms.digitalNoise.value = params.digitalNoise;
        if (params.blockSize !== undefined) glitchPass.uniforms.blockSize.value = params.blockSize;
        if (params.distortion !== undefined) glitchPass.uniforms.distortion.value = params.distortion;
    }
}

export function disableGlitch() {
    if (glitchPass) {
        glitchPass.uniforms.intensity.value = 0.0;
    }
}

export function render() {
    if (composer) {
        composer.render();
    }
} 
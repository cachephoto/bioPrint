import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

let composer;
let colorPass;
let bloomPass;

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
    colorPass.renderToScreen = true;
    composer.addPass(colorPass);
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

export function render() {
    if (composer) {
        composer.render();
    }
} 
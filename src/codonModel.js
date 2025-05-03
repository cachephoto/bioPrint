import * as THREE from 'three';

// Constantes para el modelo de codón
const CODON_PARAMS = {
    radius: 0.8,         // Radio para moléculas
    height: 2.5,         // Altura del modelo
    segments: 16,        // Segmentos para mejor calidad
    baseSize: 0.4,       // Tamaño de las bases
    linkRadius: 0.05,    // Radio de los enlaces
    pulseSpeed: 0.1,     // Velocidad de pulso
    pulseIntensity: 1.1,
    rotationSpeed: 0.02, // Velocidad de rotación
    zOffset: 3.0,        // Offset en Z
    helixRadius: 1.0,    // Radio de la hélice
    helixTurns: 2,       // Número de vueltas
    helixSpeed: 0.2,     // Velocidad de rotación de la hélice
    cycleSpeed: 0.5,     // Velocidad de ciclo de las bases
    colors: {
        dna: 0x999999,   // Gris medio para ADN
        rna: 0x666666,   // Gris oscuro para ARN
        G: 0x9999aa,     // Gris azulado para Guanina
        A: 0x8888aa,     // Gris azulado claro para Adenina
        T: 0xaa9999,     // Gris rosado para Timina
        C: 0x99aa99      // Gris verdoso para Citosina
    }
};

// Formas específicas para cada base
const BASE_SHAPES = {
    G: 'octahedron',    // Octaedro para Guanina
    A: 'tetrahedron',   // Tetraedro para Adenina
    T: 'cube',          // Cubo para Timina
    C: 'dodecahedron',  // Dodecaedro para Citosina
    U: 'icosahedron'    // Icosaedro para Uracilo
};

class CodonModel {
    constructor(boundingBox) {
        this.boundingBox = boundingBox;
        this.group = new THREE.Group();
        this.createModel();
        this.isRotating = true;
        this.rotationSpeed = CODON_PARAMS.rotationSpeed;
        this.time = 0;
        this.cycleTime = 0;
    }

    createModel() {
        // Calcular número de bases basado en el tamaño del panel
        const aspectRatio = this.boundingBox.x / this.boundingBox.y;
        const baseCount = Math.max(6, Math.min(12, Math.floor(8 * aspectRatio)));
        
        // Crear secuencias de longitud adaptativa
        const dnaPattern = ['G', 'C', 'A', 'T'];
        const rnaPattern = ['C', 'G', 'A', 'A']; // Cambiado U por A
        
        const dnaSequence = [];
        const rnaSequence = [];
        for (let i = 0; i < baseCount; i++) {
            dnaSequence.push(dnaPattern[i % dnaPattern.length]);
            rnaSequence.push(rnaPattern[i % rnaPattern.length]);
        }

        // Guardar las secuencias para el ciclo
        this.dnaSequence = dnaSequence;
        this.rnaSequence = rnaSequence;

        // Crear las hebras en espiral
        const dnaStrand = this.createHelixStrand(
            CODON_PARAMS.colors.dna,
            dnaSequence,
            0,           // Fase inicial
            true        // Es ADN
        );
        this.group.add(dnaStrand);

        const rnaStrand = this.createHelixStrand(
            CODON_PARAMS.colors.rna,
            rnaSequence,
            Math.PI,    // Fase opuesta
            false       // Es ARN
        );
        this.group.add(rnaStrand);

        // Guardar referencias a las hebras
        this.dnaStrand = dnaStrand;
        this.rnaStrand = rnaStrand;
    }

    createHelixStrand(color, sequence, initialPhase, isDNA) {
        const strand = new THREE.Group();
        const numBases = sequence.length;
        const height = this.boundingBox.y * 0.7;
        const turnHeight = height / CODON_PARAMS.helixTurns;
        
        // Crear array para almacenar las bases
        const bases = [];
        
        for (let i = 0; i < numBases; i++) {
            const base = sequence[i];
            const progress = i / (numBases - 1);
            const angle = progress * Math.PI * 2 * CODON_PARAMS.helixTurns + initialPhase;
            
            // Posición en la hélice
            const x = Math.cos(angle) * CODON_PARAMS.helixRadius;
            const y = height * (0.5 - progress);
            const z = Math.sin(angle) * CODON_PARAMS.helixRadius;

            // Crear base nitrogenada
            const baseObj = this.createBase(CODON_PARAMS.colors[base], base);
            baseObj.position.set(x, y, z);
            
            // Orientar la base hacia afuera de la hélice
            baseObj.lookAt(new THREE.Vector3(x * 2, y, z * 2));
            
            // Datos para animación
            baseObj.userData = {
                originalScale: baseObj.scale.clone(),
                pulsePhase: Math.random() * Math.PI * 2,
                originalPos: {x, y, z},
                angle: angle,
                radius: CODON_PARAMS.helixRadius,
                isDNA: isDNA,
                baseIndex: i,
                baseType: base
            };

            strand.add(baseObj);
            bases.push(baseObj);

            // Crear enlaces entre bases
            if (i < numBases - 1) {
                const nextProgress = (i + 1) / (numBases - 1);
                const nextAngle = nextProgress * Math.PI * 2 * CODON_PARAMS.helixTurns + initialPhase;
                const nextX = Math.cos(nextAngle) * CODON_PARAMS.helixRadius;
                const nextY = height * (0.5 - nextProgress);
                const nextZ = Math.sin(nextAngle) * CODON_PARAMS.helixRadius;

                const link = this.createLink(
                    new THREE.Vector3(x, y, z),
                    new THREE.Vector3(nextX, nextY, nextZ),
                    color
                );
                
                link.userData = {
                    originalPos: {x, y, z},
                    angle: angle,
                    radius: CODON_PARAMS.helixRadius,
                    isDNA: isDNA
                };
                
                strand.add(link);
            }
        }

        // Guardar las bases en el strand
        strand.userData = {
            bases: bases,
            isDNA: isDNA
        };

        return strand;
    }

    createBase(color, baseType) {
        let geometry;
        const size = CODON_PARAMS.baseSize;

        // Ajustar tamaños relativos de cada forma
        switch (BASE_SHAPES[baseType]) {
            case 'tetrahedron':
                geometry = new THREE.TetrahedronGeometry(size * 1.6);
                break;
            case 'cube':
                geometry = new THREE.BoxGeometry(size * 1.4, size * 1.4, size * 1.4);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(size * 1.5);
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(size * 1.2);
                break;
            default:
                geometry = new THREE.SphereGeometry(size, 12, 12);
        }
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 60,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 0.1
        });

        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });

        const base = new THREE.Mesh(geometry, material);
        const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
        base.add(wireframe);

        // Crear el sprite del carácter
        const sprite = this.createCharacterSprite(baseType, size);
        base.add(sprite);

        return base;
    }

    createCharacterSprite(character, size) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
        
        // Limpiar el canvas
        context.fillStyle = 'rgba(0,0,0,0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar el carácter
        context.fillStyle = 'white';
        context.font = 'bold 256px "Press Start 2P", monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(character, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(size * 2.5, size * 2.5, 1);
        sprite.renderOrder = 1;

        // Función para actualizar la posición y orientación del sprite
        sprite.onBeforeRender = (renderer, scene, camera) => {
            // Obtener la posición mundial de la base
            const baseWorldPos = sprite.parent.getWorldPosition(new THREE.Vector3());
            
            // Calcular la dirección desde el centro de la hélice hacia la base
            const direction = baseWorldPos.clone().sub(new THREE.Vector3(0, baseWorldPos.y, 0)).normalize();
            
            // Calcular la posición del sprite relativa a la base
            const localOffset = direction.multiplyScalar(size * 0.6);
            sprite.position.copy(localOffset);

            // Hacer que el sprite mire a la cámara mientras mantiene su orientación vertical
            const cameraPos = camera.position.clone();
            const up = new THREE.Vector3(0, 1, 0);
            
            // Crear una matriz de rotación que mire a la cámara
            const lookAtMatrix = new THREE.Matrix4();
            lookAtMatrix.lookAt(cameraPos, baseWorldPos, up);
            
            // Aplicar la rotación al sprite
            sprite.quaternion.setFromRotationMatrix(lookAtMatrix);
        };

        return sprite;
    }

    createLink(start, end, color) {
        // Crear una curva suave entre los puntos
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const direction = new THREE.Vector3().subVectors(end, start);
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        
        // Desplazar el punto medio hacia afuera de la hélice
        midPoint.add(perpendicular.multiplyScalar(CODON_PARAMS.linkRadius * 4));
        
        // Crear una curva cuadrática
        const curve = new THREE.QuadraticBezierCurve3(
            start,
            midPoint,
            end
        );

        // Crear geometría tubular a partir de la curva
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            8,  // Segmentos
            CODON_PARAMS.linkRadius,
            6,  // Segmentos radiales
            false
        );
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            shininess: 60,
            emissive: color,
            emissiveIntensity: 0.1
        });

        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        
        const link = new THREE.Mesh(tubeGeometry, material);
        const wireframe = new THREE.Mesh(tubeGeometry, wireframeMaterial);
        link.add(wireframe);
        
        return link;
    }

    update() {
        this.time += 0.016;
        this.cycleTime += 0.016;

        // Actualizar rotación general
        if (this.isRotating) {
            this.group.rotation.y += this.rotationSpeed;
        }

        // Calcular fase del ciclo
        const cycleDuration = 2.0 / CODON_PARAMS.cycleSpeed; // 2 segundos por ciclo completo
        if (this.cycleTime >= cycleDuration) {
            this.cycleTime = 0;
            
            // Rotar secuencias
            if (this.dnaSequence && this.rnaSequence) {
                // Rotar DNA
                const firstDNA = this.dnaSequence.shift();
                this.dnaSequence.push(firstDNA);
                
                // Rotar RNA
                const firstRNA = this.rnaSequence.shift();
                this.rnaSequence.push(firstRNA);
                
                // Actualizar las bases
                [this.dnaStrand, this.rnaStrand].forEach(strand => {
                    if (strand && strand.userData.bases) {
                        const sequence = strand.userData.isDNA ? this.dnaSequence : this.rnaSequence;
                        strand.userData.bases.forEach((baseObj, i) => {
                            const newBase = sequence[i];
                            // Actualizar el tipo de base y su color
                            baseObj.userData.baseType = newBase;
                            baseObj.material.color.setHex(CODON_PARAMS.colors[newBase]);
                            baseObj.material.emissive.setHex(CODON_PARAMS.colors[newBase]);
                            // Actualizar el sprite con el nuevo carácter
                            this.updateBaseSprite(baseObj, newBase);
                        });
                    }
                });
            }
        }

        // Actualizar cada elemento en la hélice
        this.group.traverse((child) => {
            if (child.userData && child.userData.originalScale) {
                // Efecto de pulso
                const time = Date.now() * 0.001;
                const scale = 1 + Math.sin(time * CODON_PARAMS.pulseSpeed + child.userData.pulsePhase) * 0.1;
                child.scale.copy(child.userData.originalScale).multiplyScalar(scale);

                // Rotación de la hélice
                if (child.userData.originalPos) {
                    const pos = child.userData.originalPos;
                    const angle = child.userData.angle + this.time * CODON_PARAMS.helixSpeed;
                    const radius = child.userData.radius;
                    
                    // Aplicar rotación helicoidal
                    child.position.x = Math.cos(angle) * radius;
                    child.position.z = Math.sin(angle) * radius;
                    
                    // Orientar la base hacia afuera de la hélice
                    child.lookAt(new THREE.Vector3(
                        child.position.x * 2,
                        child.position.y,
                        child.position.z * 2
                    ));
                }
            }
        });
    }

    updateBaseSprite(baseObj, newBase) {
        // Encontrar el sprite existente y actualizarlo
        baseObj.children.forEach(child => {
            if (child instanceof THREE.Sprite) {
                const newSprite = this.createCharacterSprite(newBase, CODON_PARAMS.baseSize);
                child.material = newSprite.material;
            }
        });
    }
}

// Estado global para modelos de codón
const codonModelState = new Map();

// Función para cargar el modelo de codón en un panel
export async function loadCodonToPanel(panel, gridSize) {
    if (!panel.group) return false;

    try {
        // Calcular dimensiones del panel
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;
        
        // Crear grupo contenedor
        const codonGroup = new THREE.Group();
        codonGroup.renderOrder = 1;
        
        // Crear modelo de codón
        const codon = new CodonModel(new THREE.Vector3(panelWidth * 0.8, panelHeight * 0.8, Math.min(panelWidth, panelHeight) * 0.5));
        
        // Añadir iluminación
        const light = new THREE.PointLight(0xffffff, 1.5, panelWidth * 2);
        light.position.set(0, 0, panelWidth * 0.5);
        codonGroup.add(light);
        
        const ambientLight = new THREE.AmbientLight(0x808080);
        codonGroup.add(ambientLight);
        
        // Añadir el modelo al grupo
        codonGroup.add(codon.group);
        
        // Posicionar el grupo
        codonGroup.position.z = CODON_PARAMS.zOffset;
        
        // Añadir el grupo al panel
        panel.group.add(codonGroup);
        
        // Guardar referencia al modelo
        codonModelState.set(panel, codon);
        
        return true;
    } catch (error) {
        console.error('Error creating codon model:', error);
        return false;
    }
}

// Función para animar los modelos de codón
export function animateCodons() {
    codonModelState.forEach((codon) => {
        if (codon) {
            codon.update();
        }
    });
}

// Función para limpiar los modelos
export function cleanupCodonModels() {
    codonModelState.forEach((codon, panel) => {
        if (codon && codon.group.parent) {
            codon.group.parent.remove(codon.group);
        }
    });
    codonModelState.clear();
} 
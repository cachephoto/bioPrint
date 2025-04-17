import * as THREE from 'three';

// Estado global para modelos genómicos
const genomModelState = new Map();
const gtacTextState = new Map();

// Constantes para la generación de ADN
const DNA_PARAMS = {
    radius: 0.2,        // Radio reducido para una hélice más delgada
    height: 3,          // Altura aumentada
    turns: 6,           // Más vueltas para mejor efecto
    segments: 16,       // Reducido de 32 a 16 para menor conteo poligonal
    baseSize: 0.08,     // Bases más pequeñas
    linkRadius: 0.015,  // Enlaces más delgados
    pulseSpeed: 0.5,    
    pulseIntensity: 1.2,
    rotationSpeed: 0.3,
    zOffset: 2.5        // Más cerca de la cámara
};

const DNA_COLORS = {
    strand1: 0x66ffff, // Cyan claro
    strand2: 0xff99cc, // Rosa claro
    bases: 0x99ffcc,   // Turquesa claro
    links: 0xffffff    // Blanco
};

const DNA_BASES = ['G', 'T', 'A', 'C'];
const GTAC_PARAMS = {
    updateInterval: 100, // ms entre actualizaciones
    textSize: 0.15,     // tamaño relativo del texto
    columns: 8,         // número de columnas de texto
    rows: 12,           // número de filas de texto
    colors: {
        G: 0x00ff00, // Verde
        T: 0xff0000, // Rojo
        A: 0x0000ff, // Azul
        C: 0xffff00  // Amarillo
    }
};

class DNAHelix {
    constructor(boundingBox) {
        this.group = new THREE.Group();
        this.nodes = [];
        this.links = [];
        this.boundingBox = boundingBox;
        this.pulsePhase = 0;
        this.rotationPhase = 0;
        this.createHelix();
    }

    createHelix() {
        // Calcular dimensiones basadas en el contenedor
        const height = this.boundingBox.y * 1.2; // 120% de la altura del contenedor
        const radius = Math.min(this.boundingBox.x, this.boundingBox.y) * 0.1; // Radio más pequeño
        
        // Ajustar número de vueltas basado en la altura
        const aspectRatio = height / (DNA_PARAMS.height * 2);
        const adjustedTurns = Math.max(3, Math.floor(DNA_PARAMS.turns * aspectRatio));
        
        // Ajustar tamaño de las bases y enlaces proporcionalmente
        const baseSize = Math.min(this.boundingBox.x, this.boundingBox.y) * 0.03;
        const linkRadius = baseSize * 0.2;
        
        // Calcular puntos de la doble hélice
        const points1 = [];
        const points2 = [];
        const bases = [];
        const totalPoints = DNA_PARAMS.segments * adjustedTurns;

        for (let i = 0; i <= totalPoints; i++) {
            const t = i / totalPoints;
            const angle = t * Math.PI * 2 * adjustedTurns;
            const y = height * (t - 0.5);

            // Primera hélice con radio variable para efecto visual
            const radiusModulation = 1 + Math.sin(t * Math.PI * adjustedTurns * 2) * 0.1;
            const currentRadius = radius * radiusModulation;

            // Primera hélice
            const x1 = Math.cos(angle) * currentRadius;
            const z1 = Math.sin(angle) * currentRadius;
            points1.push(new THREE.Vector3(x1, y, z1));

            // Segunda hélice (desplazada 180 grados)
            const x2 = Math.cos(angle + Math.PI) * currentRadius;
            const z2 = Math.sin(angle + Math.PI) * currentRadius;
            points2.push(new THREE.Vector3(x2, y, z2));

            // Bases nitrogenadas (cada 6 puntos)
            if (i % 6 === 0 && i < totalPoints) {
                bases.push({
                    pos1: new THREE.Vector3(x1, y, z1),
                    pos2: new THREE.Vector3(x2, y, z2),
                    index: i
                });
            }
        }

        // Crear las hebras de ADN con el radio ajustado
        const strand1 = this.createStrand(points1, DNA_COLORS.strand1, linkRadius * 1.5);
        const strand2 = this.createStrand(points2, DNA_COLORS.strand2, linkRadius * 1.5);
        
        this.group.add(strand1);
        this.group.add(strand2);

        // Crear bases nitrogenadas y enlaces con tamaños ajustados
        bases.forEach((base, index) => {
            // Base en hebra 1
            const base1 = this.createBase(base.pos1, DNA_COLORS.bases, baseSize);
            base1.userData.pulseIndex = index;
            this.nodes.push(base1);
            this.group.add(base1);

            // Base en hebra 2
            const base2 = this.createBase(base.pos2, DNA_COLORS.bases, baseSize);
            base2.userData.pulseIndex = index;
            this.nodes.push(base2);
            this.group.add(base2);

            // Enlace entre bases
            const link = this.createLink(base.pos1, base.pos2, linkRadius);
            link.userData.pulseIndex = index;
            this.links.push(link);
            this.group.add(link);
        });

        // Ajustar escala global del grupo
        this.group.scale.multiplyScalar(0.9);
    }

    createStrand(points, color, radius) {
        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(
            curve, 
            points.length, // Reducido de points.length * 2
            radius, 
            6, // Reducido de 8 a 6 segmentos radiales
            false
        );
        
        // Material principal
        const material = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 80,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 0.2
        });

        // Material wireframe
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });

        // Crear mesh principal
        const mesh = new THREE.Mesh(geometry, material);
        
        // Crear mesh wireframe
        const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
        mesh.add(wireframe);

        return mesh;
    }

    createBase(position, color, size) {
        // Usar IcosahedronGeometry en lugar de SphereGeometry
        const geometry = new THREE.IcosahedronGeometry(
            size,
            0  // Sin subdivisiones para mantener el conteo poligonal bajo
        );
        
        // Material principal con brillo más metálico
        const material = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 90, // Aumentado para más brillo en las facetas
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 0.2,
            flatShading: true // Resaltar las facetas geométricas
        });

        // Material wireframe más definido
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.3 // Aumentado para mejor visibilidad de la geometría
        });

        // Crear mesh principal
        const base = new THREE.Mesh(geometry, material);
        base.position.copy(position);
        
        // Añadir rotación aleatoria para variedad visual
        base.rotation.x = Math.random() * Math.PI;
        base.rotation.y = Math.random() * Math.PI;
        base.rotation.z = Math.random() * Math.PI;
        
        // Crear mesh wireframe
        const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
        base.add(wireframe);

        return base;
    }

    createLink(pos1, pos2, radius) {
        const direction = new THREE.Vector3().subVectors(pos2, pos1);
        const length = direction.length();
        
        const geometry = new THREE.CylinderGeometry(
            radius,
            radius,
            length,
            6, // Reducido de 8 a 6 segmentos radiales
            1,
            true
        );
        
        // Material principal
        const material = new THREE.MeshPhongMaterial({
            color: DNA_COLORS.links,
            transparent: true,
            opacity: 0.6,
            shininess: 80,
            emissive: DNA_COLORS.links,
            emissiveIntensity: 0.1
        });

        // Material wireframe
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });
        
        // Crear mesh principal
        const link = new THREE.Mesh(geometry, material);
        
        // Crear mesh wireframe
        const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
        link.add(wireframe);
        
        // Posicionar en el punto medio
        const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
        link.position.copy(midPoint);
        
        // Orientar hacia el segundo punto
        link.lookAt(pos2);
        link.rotateX(Math.PI / 2);
        
        return link;
    }

    update() {
        // Actualizar fase de pulso
        this.pulsePhase += DNA_PARAMS.pulseSpeed * 0.016;
        
        // Actualizar rotación
        this.rotationPhase += DNA_PARAMS.rotationSpeed * 0.016;
        this.group.rotation.y = this.rotationPhase;
        
        // Actualizar cada base y enlace
        const totalElements = this.nodes.length / 2;
        
        this.nodes.forEach((node, i) => {
            const pulseOffset = (node.userData.pulseIndex / totalElements) * Math.PI * 2;
            const pulse = Math.sin(this.pulsePhase + pulseOffset);
            const scale = 1 + Math.max(0, pulse) * 0.2;
            
            node.scale.setScalar(scale);
            node.material.opacity = 0.7 + Math.max(0, pulse) * 0.3;
            
            // Rotar suavemente el icosaedro durante el pulso
            node.rotation.x += 0.002 * Math.max(0, pulse);
            node.rotation.y += 0.003 * Math.max(0, pulse);
            
            // Actualizar opacidad del wireframe
            if (node.children[0]) {
                node.children[0].material.opacity = 0.2 + Math.max(0, pulse) * 0.2;
            }
        });
        
        this.links.forEach((link, i) => {
            const pulseOffset = (link.userData.pulseIndex / totalElements) * Math.PI * 2;
            const pulse = Math.sin(this.pulsePhase + pulseOffset);
            link.material.opacity = 0.3 + Math.max(0, pulse) * 0.2;
            
            // Actualizar opacidad del wireframe
            if (link.children[0]) {
                link.children[0].material.opacity = 0.1 + Math.max(0, pulse) * 0.2;
            }
        });
    }
}

class GTACText {
    constructor(boundingBox) {
        this.group = new THREE.Group();
        this.boundingBox = boundingBox;
        this.textMeshes = [];
        this.lastUpdate = 0;
        this.createTextGrid();
    }

    createTextGrid() {
        const loader = new THREE.FontLoader();
        // Usar una fuente monoespaciada para mejor alineación
        const font = loader.parse(require('three/examples/fonts/helvetiker_regular.typeface.json'));

        const cellWidth = this.boundingBox.x / GTAC_PARAMS.columns;
        const cellHeight = this.boundingBox.y / GTAC_PARAMS.rows;
        const textSize = Math.min(cellWidth, cellHeight) * GTAC_PARAMS.textSize;

        for (let row = 0; row < GTAC_PARAMS.rows; row++) {
            for (let col = 0; col < GTAC_PARAMS.columns; col++) {
                const base = DNA_BASES[Math.floor(Math.random() * DNA_BASES.length)];
                const textGeo = new THREE.TextGeometry(base, {
                    font: font,
                    size: textSize,
                    height: textSize * 0.1,
                    curveSegments: 4,
                });

                const material = new THREE.MeshPhongMaterial({
                    color: GTAC_PARAMS.colors[base],
                    emissive: GTAC_PARAMS.colors[base],
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.9
                });

                const textMesh = new THREE.Mesh(textGeo, material);
                
                // Posicionar en la grilla
                textMesh.position.x = (col - GTAC_PARAMS.columns/2) * cellWidth + cellWidth/2;
                textMesh.position.y = (row - GTAC_PARAMS.rows/2) * cellHeight + cellHeight/2;
                textMesh.position.z = 0.1;

                // Añadir wireframe
                const wireframeMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.2
                });
                const wireframe = new THREE.Mesh(textGeo, wireframeMaterial);
                textMesh.add(wireframe);

                this.textMeshes.push({
                    mesh: textMesh,
                    row: row,
                    col: col
                });
                this.group.add(textMesh);
            }
        }
    }

    update(currentTime) {
        if (currentTime - this.lastUpdate > GTAC_PARAMS.updateInterval) {
            // Actualizar algunas letras aleatoriamente
            const numUpdates = Math.floor(Math.random() * 5) + 1;
            for (let i = 0; i < numUpdates; i++) {
                const textObj = this.textMeshes[Math.floor(Math.random() * this.textMeshes.length)];
                const newBase = DNA_BASES[Math.floor(Math.random() * DNA_BASES.length)];
                
                // Crear nueva geometría y materiales
                const loader = new THREE.FontLoader();
                const font = loader.parse(require('three/examples/fonts/helvetiker_regular.typeface.json'));
                const textSize = Math.min(this.boundingBox.x / GTAC_PARAMS.columns, 
                                       this.boundingBox.y / GTAC_PARAMS.rows) * GTAC_PARAMS.textSize;
                
                const newGeo = new THREE.TextGeometry(newBase, {
                    font: font,
                    size: textSize,
                    height: textSize * 0.1,
                    curveSegments: 4,
                });

                const newMaterial = new THREE.MeshPhongMaterial({
                    color: GTAC_PARAMS.colors[newBase],
                    emissive: GTAC_PARAMS.colors[newBase],
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.9
                });

                // Actualizar mesh
                this.group.remove(textObj.mesh);
                const newMesh = new THREE.Mesh(newGeo, newMaterial);
                newMesh.position.copy(textObj.mesh.position);

                // Añadir wireframe
                const wireframeMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.2
                });
                const wireframe = new THREE.Mesh(newGeo, wireframeMaterial);
                newMesh.add(wireframe);

                this.group.add(newMesh);
                textObj.mesh = newMesh;
            }
            this.lastUpdate = currentTime;
        }
    }
}

// Función para cargar y ajustar una doble hélice a un panel
export async function loadGenomToPanel(panel, gridSize) {
    if (!panel.group) return false;

    try {
        // Calcular dimensiones del panel
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;
        
        // Crear grupo contenedor
        const genomGroup = new THREE.Group();
        genomGroup.renderOrder = 1;
        
        // Crear doble hélice
        const helix = new DNAHelix(new THREE.Vector3(panelWidth * 0.8, panelHeight * 0.8, Math.min(panelWidth, panelHeight) * 0.5));
        
        // Añadir iluminación local más intensa
        const light = new THREE.PointLight(0xffffff, 1.5, panelWidth * 2);
        light.position.set(0, 0, panelWidth * 0.5);
        genomGroup.add(light);
        
        // Añadir luz ambiente más intensa
        const ambientLight = new THREE.AmbientLight(0x808080); // Gris claro
        genomGroup.add(ambientLight);
        
        // Añadir la hélice al grupo
        genomGroup.add(helix.group);
        
        // Ya no rotamos el grupo, solo lo posicionamos ligeramente adelante
        genomGroup.position.z = DNA_PARAMS.zOffset;
        
        // Añadir el grupo al panel
        panel.group.add(genomGroup);
        
        // Guardar referencia a la hélice
        genomModelState.set(panel, helix);
        
        return true;
    } catch (error) {
        console.error('Error creating DNA:', error);
        return false;
    }
}

// Función para cargar texto GTAC en un panel
export async function loadGTACToPanel(panel, gridSize) {
    if (!panel.group) return false;

    try {
        // Limpiar texto existente si lo hay
        const existingText = gtacTextState.get(panel);
        if (existingText && existingText.group.parent) {
            existingText.group.parent.remove(existingText.group);
        }

        // Calcular dimensiones del panel
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;
        
        // Crear nuevo texto GTAC
        const gtacText = new GTACText(new THREE.Vector3(panelWidth * 0.8, panelHeight * 0.8, 1));
        
        // Añadir iluminación
        const light = new THREE.PointLight(0xffffff, 1.5, panelWidth * 2);
        light.position.set(0, 0, panelWidth * 0.5);
        gtacText.group.add(light);
        
        const ambientLight = new THREE.AmbientLight(0x808080);
        gtacText.group.add(ambientLight);
        
        // Añadir al panel
        panel.group.add(gtacText.group);
        
        // Guardar referencia
        gtacTextState.set(panel, gtacText);
        
        return true;
    } catch (error) {
        console.error('Error creating GTAC text:', error);
        return false;
    }
}

// Actualizar la función de animación para incluir el texto GTAC
export function animateGenoms() {
    const currentTime = Date.now();
    
    genomModelState.forEach((helix, panel) => {
        if (helix) {
            helix.update();
        }
    });

    gtacTextState.forEach((gtacText, panel) => {
        if (gtacText) {
            gtacText.update(currentTime);
        }
    });
}

// Actualizar la función de limpieza
export function cleanupGenomModels() {
    genomModelState.forEach((helix, panel) => {
        if (helix && helix.group.parent) {
            helix.group.parent.remove(helix.group);
        }
    });
    genomModelState.clear();

    gtacTextState.forEach((gtacText, panel) => {
        if (gtacText && gtacText.group.parent) {
            gtacText.group.parent.remove(gtacText.group);
        }
    });
    gtacTextState.clear();
} 
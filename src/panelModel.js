import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Estado global para modelos
const panelModelState = new Map();
const modelCache = new Map();
const loader = new OBJLoader();

// Constantes para vista isométrica
const ISO_ANGLE = -Math.PI / 4; // -45 grados
const MODEL_FORWARD_OFFSET = -2; // Cambiado a negativo para mover hacia atrás

// Función para cargar y ajustar un modelo a un panel
export async function loadModelToPanel(panel, modelUrl, gridSize) {
    if (!panel.group) return false;

    try {
        // Intentar obtener modelo del cache primero
        let model;
        if (modelCache.has(modelUrl)) {
            model = modelCache.get(modelUrl).clone();
        } else {
            try {
                const response = await fetch(modelUrl);
                if (!response.ok) {
                    throw new Error(`Error al cargar el modelo: ${response.status} ${response.statusText}`);
                }
                const modelText = await response.text();
                model = loader.parse(modelText);
                modelCache.set(modelUrl, model.clone());
            } catch (error) {
                console.error('Error al cargar el modelo:', error);
                throw new Error(`No se pudo cargar el modelo desde ${modelUrl}`);
            }
        }

        // Limpiar modelo anterior si existe
        if (panelModelState.has(panel)) {
            const oldModel = panelModelState.get(panel);
            if (oldModel.parent) {
                oldModel.parent.remove(oldModel);
            }
        }

        // Calcular dimensiones del panel en unidades de mundo
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;

        // Material sólido para las caras
        const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0x000066, // Azul oscuro
            transparent: false,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true,
            shadowSide: THREE.FrontSide
        });

        // Material wireframe para el overlay
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            depthTest: true,
            depthWrite: false,
            shadowSide: THREE.FrontSide
        });

        // Material para bordes resaltados
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff, // Cyan
            transparent: true,
            opacity: 0.8,
            depthTest: true,
            depthWrite: false,
            shadowSide: THREE.FrontSide
        });

        // Grupo para el modelo
        const modelGroup = new THREE.Group();
        modelGroup.renderOrder = 1;
        
        // Grupo para la rotación isométrica
        const isoGroup = new THREE.Group();
        isoGroup.rotation.x = ISO_ANGLE;
        isoGroup.position.z = MODEL_FORWARD_OFFSET; // Mover el grupo hacia adelante

        // Marcar el grupo como modelo para preservarlo durante la reconstrucción
        modelGroup.userData.isModel = true;
        modelGroup.userData.modelUrl = modelUrl;
        modelGroup.userData.gridSize = gridSize;

        // Aplicar materiales y filtrar caras
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry.clone();
                
                // Asegurar que la geometría tenga normales
                if (!geometry.attributes.normal) {
                    geometry.computeVertexNormals();
                }
                
                // Optimizar la geometría
                geometry.computeBoundingSphere();
                geometry.computeBoundingBox();
                
                // Crear el mesh sólido
                const solidMesh = new THREE.Mesh(geometry, solidMaterial.clone());
                solidMesh.renderOrder = 1;
                
                // Crear el wireframe como una geometría de líneas
                const wireframeGeometry = new THREE.WireframeGeometry(geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial.clone());
                wireframe.renderOrder = 2;
                
                // Crear bordes resaltados
                const edgesGeometry = new THREE.EdgesGeometry(geometry, 30);
                const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial.clone());
                edges.renderOrder = 3;
                
                // Crear un grupo para mantener todo junto
                const meshGroup = new THREE.Group();
                meshGroup.add(solidMesh);
                meshGroup.add(wireframe);
                meshGroup.add(edges);
                
                // Reemplazar el mesh original
                child.parent.add(meshGroup);
                child.parent.remove(child);
            }
        });

        // Calcular bounding box y escala
        const bbox = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        bbox.getSize(modelSize);

        // Calcular escala
        const scaleX = panelWidth / modelSize.x;
        const scaleY = panelHeight / modelSize.y;
        const scaleZ = panelHeight / modelSize.z;
        const scale = Math.min(scaleX, scaleY, scaleZ) * 0.85; // Aumentado de 0.6 a 0.85 para usar más espacio

        model.scale.set(scale, scale, scale);

        // Centrar modelo
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        model.position.set(-center.x * scale, -center.y * scale, 0);

        // Rotar el modelo 90 grados en X para acostarlo
        model.rotation.x = Math.PI / 2;
        
        // Añadir el modelo al grupo isométrico
        isoGroup.add(model);
        
        // Añadir el grupo isométrico al grupo principal
        modelGroup.add(isoGroup);

        // Añadir el grupo principal al panel
        panel.group.add(modelGroup);

        // Guardar referencia al modelo y su configuración
        const modelState = {
            model: model,
            rotationSpeed: 0.005,
            isRotating: true,
            lastRotationTime: performance.now(),
            initialRotation: 0 // Añadir rotación inicial
        };
        
        panelModelState.set(panel, modelState);

        return true;
    } catch (error) {
        console.error('Error loading model:', error);
        return false;
    }
}

// Función para preservar el modelo durante la reconstrucción del panel
export function preserveModel(panel) {
    if (!panel.group) return null;
    
    // Buscar el modelo en los hijos del panel
    const modelGroup = panel.group.children.find(child => child.userData.isModel);
    if (modelGroup) {
        // Obtener el estado actual del modelo
        const modelState = panelModelState.get(panel);
        const currentRotation = modelState.model.rotation.y;
        
        // Remover el modelo del panel actual
        panel.group.remove(modelGroup);
        return {
            group: modelGroup,
            url: modelGroup.userData.modelUrl,
            gridSize: modelGroup.userData.gridSize,
            lastRotation: currentRotation, // Guardar la rotación actual
            rotationState: modelState // Guardar el estado completo
        };
    }
    return null;
}

// Función para restaurar el modelo después de la reconstrucción del panel
export function restoreModel(panel, modelData) {
    if (!panel.group || !modelData) return;
    
    // Restaurar el modelo al panel
    panel.group.add(modelData.group);
    
    // Si hay un estado de rotación previo, restaurarlo
    if (modelData.rotationState) {
        const model = modelData.rotationState.model;
        
        // Restaurar la rotación exacta donde se quedó
        if (modelData.lastRotation !== undefined) {
            model.rotation.y = modelData.lastRotation;
        }
        
        // Crear nuevo estado manteniendo la configuración anterior
        const newModelState = {
            model: model,
            rotationSpeed: modelData.rotationState.rotationSpeed,
            isRotating: modelData.rotationState.isRotating,
            lastRotationTime: performance.now() // Actualizar el tiempo
        };
        
        panelModelState.set(panel, newModelState);
    }
}

// Función para animar modelos usando deltaTime para rotación suave
export function animateModels() {
    const currentTime = performance.now();
    
    panelModelState.forEach((modelState, panel) => {
        if (modelState && modelState.isRotating) {
            // Calcular delta time en segundos
            const deltaTime = (currentTime - modelState.lastRotationTime) / 1000;
            
            // Rotar el modelo usando deltaTime para mantener velocidad constante
            const rotationAmount = modelState.rotationSpeed * deltaTime * 60;
            modelState.model.rotation.y = (modelState.model.rotation.y + rotationAmount) % (Math.PI * 2);
            
            // Actualizar tiempo de última rotación
            modelState.lastRotationTime = currentTime;
        }
    });
}

// Función para limpiar recursos
export function cleanupPanelModels() {
    panelModelState.forEach((modelState, panel) => {
        if (modelState && modelState.model) {
            const parent = modelState.model.parent;
            if (parent) {
                parent.remove(modelState.model);
            }
            modelState.model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    });
    panelModelState.clear();
    modelCache.clear();
}

// Función para alternar rotación
export function toggleModelRotation(panel) {
    const modelState = panelModelState.get(panel);
    if (modelState) {
        modelState.isRotating = !modelState.isRotating;
        if (modelState.isRotating) {
            modelState.lastRotationTime = performance.now();
        }
        return modelState.isRotating;
    }
    return false;
}

// Función para cambiar velocidad de rotación
export function setModelRotationSpeed(panel, speed) {
    const modelState = panelModelState.get(panel);
    if (modelState) {
        modelState.rotationSpeed = speed;
    }
} 
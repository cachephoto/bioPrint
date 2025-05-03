import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Estado global para modelos
const panelModelState = new Map();
const modelCache = new Map();
const loader = new OBJLoader();

// Constantes para vista isométrica
const ISO_ANGLE = -Math.PI / 4; // -45 grados
const MODEL_FORWARD_OFFSET = -2; // Cambiado a negativo para mover hacia atrás

// Constantes para rotación
const DEFAULT_ROTATION_SPEED = 0.005;
const MIN_ROTATION_SPEED = 0.001;
const MAX_ROTATION_SPEED = 0.1;

// Función para cargar y ajustar un modelo a un panel
export async function loadModelToPanel(panel, modelUrl, gridSize) {
    if (!panel.group) return false;

    try {
        // Limpiar modelo anterior si existe en el panel
        // Primero buscar si hay algún modelo existente en el panel
        const existingModelGroup = panel.group.children.find(child => child.userData && child.userData.isModel);
        if (existingModelGroup) {
            console.log('Eliminando modelo existente en el panel');
            panel.group.remove(existingModelGroup);
            
            // Limpiar materiales y geometrías
            existingModelGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Limpiar estado del modelo si existe
        if (panelModelState.has(panel)) {
            const oldModelState = panelModelState.get(panel);
            if (oldModelState && oldModelState.model) {
                // El modelo debe ser limpiado solo si no es parte del grupo ya eliminado
                if (oldModelState.model.parent) {
                    oldModelState.model.parent.remove(oldModelState.model);
                }
                
                // Limpiar recursos del modelo anterior
                oldModelState.model.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
            // Eliminar el estado
            panelModelState.delete(panel);
        }

        // Intentar obtener modelo del cache primero
        let model;
        if (modelCache.has(modelUrl)) {
            console.log('Usando modelo en caché:', modelUrl);
            model = modelCache.get(modelUrl).clone();
        } else {
            console.log('Cargando modelo desde URL:', modelUrl);
            try {
                const response = await fetch(modelUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const modelText = await response.text();
                
                // Verificar que el texto recibido parece un archivo OBJ válido
                if (!modelText.includes('v ') || !modelText.includes('f ')) {
                    throw new Error('El archivo no parece ser un modelo OBJ válido');
                }
                
                model = loader.parse(modelText);
                console.log('Modelo cargado exitosamente, guardando en caché');
                modelCache.set(modelUrl, model.clone());
            } catch (error) {
                console.error('Error al cargar el modelo:', error);
                throw new Error(`No se pudo cargar el modelo desde ${modelUrl}: ${error.message}`);
            }
        }

        // Calcular dimensiones del panel en unidades de mundo
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;

        // Material sólido para las caras con mejor apariencia
        const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x0066cc, // Azul más brillante
            specular: 0x111111,
            shininess: 30,
            transparent: false,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true
        });

        // Material wireframe mejorado
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff, // Cyan
            transparent: true,
            opacity: 0.3,
            depthTest: true,
            depthWrite: false
        });

        // Material para bordes resaltados mejorado
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff, // Cyan
            transparent: true,
            opacity: 0.8,
            depthTest: true,
            depthWrite: false,
            linewidth: 2 // Nota: esto solo funciona en WebGL1
        });

        // Grupo para el modelo con mejor organización
        const modelGroup = new THREE.Group();
        modelGroup.name = 'ModelGroup';
        modelGroup.renderOrder = 1;
        
        // Grupo para la rotación isométrica
        const isoGroup = new THREE.Group();
        isoGroup.name = 'IsoGroup';
        isoGroup.rotation.x = ISO_ANGLE;
        isoGroup.position.z = MODEL_FORWARD_OFFSET;

        // Marcar el grupo como modelo
        modelGroup.userData = {
            isModel: true,
            modelUrl: modelUrl,
            gridSize: gridSize,
            loadTime: Date.now()
        };

        // Aplicar materiales y optimizar geometría
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry.clone();
                
                // Optimizar la geometría
                geometry.computeVertexNormals();
                geometry.computeBoundingSphere();
                geometry.computeBoundingBox();
                
                // Crear el mesh sólido
                const solidMesh = new THREE.Mesh(geometry, solidMaterial.clone());
                solidMesh.name = 'SolidMesh';
                solidMesh.renderOrder = 1;
                
                // Crear el wireframe
                const wireframeGeometry = new THREE.WireframeGeometry(geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial.clone());
                wireframe.name = 'Wireframe';
                wireframe.renderOrder = 2;
                
                // Crear bordes resaltados
                const edgesGeometry = new THREE.EdgesGeometry(geometry, 30);
                const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial.clone());
                edges.name = 'Edges';
                edges.renderOrder = 3;
                
                // Grupo para cada parte del modelo
                const meshGroup = new THREE.Group();
                meshGroup.name = 'MeshGroup';
                meshGroup.add(solidMesh);
                meshGroup.add(wireframe);
                meshGroup.add(edges);
                
                // Reemplazar el mesh original
                if (child.parent) {
                    child.parent.add(meshGroup);
                    child.parent.remove(child);
                }
            }
        });

        // Calcular bounding box y escala
        const bbox = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        bbox.getSize(modelSize);

        // Calcular escala con mejor ajuste
        const scaleX = panelWidth / modelSize.x;
        const scaleY = panelHeight / modelSize.y;
        const scaleZ = Math.min(panelWidth, panelHeight) / modelSize.z;
        const scale = Math.min(scaleX, scaleY, scaleZ) * 0.85;

        model.scale.set(scale, scale, scale);

        // Centrar modelo con más precisión
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        model.position.set(-center.x * scale, -center.y * scale, 0);

        // Rotar el modelo 90 grados en X para acostarlo
        model.rotation.x = Math.PI / 2;
        
        // Añadir el modelo al grupo isométrico
        isoGroup.add(model);
        modelGroup.add(isoGroup);
        panel.group.add(modelGroup);

        // Guardar estado del modelo con más información
        const modelState = {
            model: model,
            rotationSpeed: 0.005,
            isRotating: true,
            lastRotationTime: performance.now(),
            initialRotation: model.rotation.y,
            loadTime: Date.now(),
            url: modelUrl
        };
        
        panelModelState.set(panel, modelState);
        
        // Aplicar efectos visuales para la rotación activa
        model.traverse((child) => {
            if (child.material && child.material.opacity !== undefined) {
                child.material.baseOpacity = child.material.opacity;
            }
        });
        
        console.log('Modelo cargado y configurado exitosamente con rotación automática activada');

        return true;
    } catch (error) {
        console.error('Error en loadModelToPanel:', error);
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
            rotationSpeed: modelData.rotationState.rotationSpeed || DEFAULT_ROTATION_SPEED,
            isRotating: modelData.rotationState.isRotating !== false, // Asegurar que rote por defecto
            lastRotationTime: performance.now(), // Actualizar el tiempo
            url: modelData.url
        };
        
        // Asegurar que las opacidades base están definidas
        model.traverse((child) => {
            if (child.material && child.material.opacity !== undefined) {
                child.material.baseOpacity = child.material.opacity;
            }
        });
        
        panelModelState.set(panel, newModelState);
        console.log('Modelo restaurado con rotación', newModelState.isRotating ? 'activada' : 'desactivada');
    }
}

// Función para animar modelos usando deltaTime para rotación suave
export function animateModels() {
    const currentTime = performance.now();
    
    panelModelState.forEach((modelState, panel) => {
        // Verificar si el modelo existe
        if (!modelState || !modelState.model) return;
        
        // Verificar si el modelo tiene un padre válido
        const modelParent = modelState.model.parent;
        if (!modelParent) return;

        // Si isRotating es true o no está definido, rotar el modelo
        // El valor por defecto es true para compatibilidad con modelos existentes
        if (modelState.isRotating !== false) {
            // Asegurar que isRotating siempre esté definido
            if (modelState.isRotating === undefined) {
                modelState.isRotating = true;
            }
            
            // Calcular delta time en segundos
            const deltaTime = (currentTime - (modelState.lastRotationTime || currentTime)) / 1000;
            modelState.lastRotationTime = currentTime;
            
            // Asegurar que rotationSpeed esté definido
            const rotationSpeed = modelState.rotationSpeed || DEFAULT_ROTATION_SPEED;
            
            // Rotar el modelo usando deltaTime para mantener velocidad constante
            const rotationAmount = rotationSpeed * deltaTime * 60;
            
            // Aplicar rotación al modelo
            modelState.model.rotation.y = (modelState.model.rotation.y + rotationAmount) % (Math.PI * 2);

            // Aplicar efectos visuales durante la rotación
            if (modelState.model.children.length > 0) {
                modelState.model.traverse((child) => {
                    if (child.material) {
                        if (child.material.opacity !== undefined) {
                            // Efecto de pulso suave en la opacidad
                            const pulse = Math.sin(currentTime * 0.001) * 0.1 + 0.9;
                            
                            // Asegurar que baseOpacity esté definida
                            if (child.material.baseOpacity === undefined) {
                                child.material.baseOpacity = child.material.opacity;
                            }
                            
                            child.material.opacity = child.material.baseOpacity * pulse;
                        }
                    }
                });
            }
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
    if (!modelState || !modelState.model) return false;

    modelState.isRotating = !modelState.isRotating;
    
    if (modelState.isRotating) {
        // Reiniciar tiempo al activar la rotación
        modelState.lastRotationTime = performance.now();
        
        // Guardar opacidades base si no existen
        modelState.model.traverse((child) => {
            if (child.material && child.material.opacity !== undefined) {
                child.material.baseOpacity = child.material.opacity;
            }
        });
    } else {
        // Restaurar opacidades base al detener
        modelState.model.traverse((child) => {
            if (child.material && child.material.baseOpacity !== undefined) {
                child.material.opacity = child.material.baseOpacity;
            }
        });
    }

    return modelState.isRotating;
}

// Función para cambiar velocidad de rotación
export function setModelRotationSpeed(panel, speed) {
    const modelState = panelModelState.get(panel);
    if (!modelState || !modelState.model) return;

    // Limitar la velocidad al rango permitido
    const clampedSpeed = Math.max(MIN_ROTATION_SPEED, 
                                Math.min(MAX_ROTATION_SPEED, speed));
    
    modelState.rotationSpeed = clampedSpeed;
    
    // Si el modelo no está rotando, activar la rotación
    if (!modelState.isRotating) {
        modelState.isRotating = true;
        modelState.lastRotationTime = performance.now();
    }
}

// Función para establecer una rotación específica
export function setModelRotation(panel, angle) {
    const modelState = panelModelState.get(panel);
    if (!modelState || !modelState.model) return;

    // Normalizar el ángulo a un rango de 0 a 2π
    const normalizedAngle = angle % (Math.PI * 2);
    modelState.model.rotation.y = normalizedAngle;
}

// Función para obtener la rotación actual
export function getModelRotation(panel) {
    const modelState = panelModelState.get(panel);
    if (!modelState || !modelState.model) return 0;

    return modelState.model.rotation.y;
} 
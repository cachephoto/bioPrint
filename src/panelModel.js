import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Estado global para modelos
const panelModelState = new Map();
const modelCache = new Map();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();

// Constantes para vista isométrica ajustada para modelos altos
const ISO_ANGLE = -Math.PI / 4; // -45 grados
const MODEL_FORWARD_OFFSET = -1.5; // Reducido para dar más espacio vertical

// Constantes para rotación
const DEFAULT_ROTATION_SPEED = 0.005;
const MIN_ROTATION_SPEED = 0.001;
const MAX_ROTATION_SPEED = 0.1;

// Objetos reutilizables para evitar allocaciones en cada frame
const _tempVector3 = new THREE.Vector3();
const _tempVector3_2 = new THREE.Vector3();
const _tempVector3_3 = new THREE.Vector3();
const _tempMatrix4 = new THREE.Matrix4();

// Función auxiliar para calcular posiciones deformadas de un SkinnedMesh (optimizada)
function computeDeformedPositions(skinnedMesh) {
    const geometry = skinnedMesh.geometry;
    const skeleton = skinnedMesh.skeleton;
    
    if (!skeleton || !geometry.attributes.position) return null;
    
    const positions = geometry.attributes.position;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;
    
    if (!skinIndex || !skinWeight) return null;
    
    // Actualizar skeleton (más eficiente que actualizar cada bone individualmente)
    skeleton.update();
    
    const deformedPositions = new Float32Array(positions.count * 3);
    const boneMatrices = skeleton.boneMatrices;
    const bindMatrix = skinnedMesh.bindMatrix;
    const bindMatrixInverse = skinnedMesh.bindMatrixInverse;
    
    // Procesar vértices optimizado para mejor cache locality
    for (let i = 0; i < positions.count; i++) {
        // Leer posición directamente del buffer
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        
        // Aplicar bindMatrix directamente (sin clonar)
        _tempVector3.set(px, py, pz);
        _tempVector3.applyMatrix4(bindMatrix);
        const bx = _tempVector3.x;
        const by = _tempVector3.y;
        const bz = _tempVector3.z;
        
        // Inicializar acumulador
        let vx = 0, vy = 0, vz = 0;
        
        // Leer índices y pesos de skinning
        const skinIndices = new THREE.Vector4();
        const skinWeights = new THREE.Vector4();
        skinIndices.fromBufferAttribute(skinIndex, i);
        skinWeights.fromBufferAttribute(skinWeight, i);
        
        // Procesar hasta 4 bones por vértice
        for (let j = 0; j < 4; j++) {
            const boneIndex = skinIndices.getComponent(j);
            const weight = skinWeights.getComponent(j);
            
            if (weight > 0 && boneIndex >= 0 && boneIndex < skeleton.bones.length) {
                // Obtener matriz del bone directamente del array
                const boneMatrixOffset = boneIndex * 16;
                _tempMatrix4.fromArray(boneMatrices, boneMatrixOffset);
                
                // Aplicar transformación (reutilizar vector temporal)
                _tempVector3_2.set(bx, by, bz);
                _tempVector3_2.applyMatrix4(_tempMatrix4);
                
                // Acumular con peso
                vx += _tempVector3_2.x * weight;
                vy += _tempVector3_2.y * weight;
                vz += _tempVector3_2.z * weight;
            }
        }
        
        // Aplicar bindMatrixInverse
        _tempVector3_3.set(vx, vy, vz);
        _tempVector3_3.applyMatrix4(bindMatrixInverse);
        
        deformedPositions[i * 3] = _tempVector3_3.x;
        deformedPositions[i * 3 + 1] = _tempVector3_3.y;
        deformedPositions[i * 3 + 2] = _tempVector3_3.z;
    }
    
    return deformedPositions;
}

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

        // Detectar tipo de archivo por extensión (necesario para todo el scope)
        const fileExtension = modelUrl.toLowerCase().split('.').pop();

        // Función para clonar correctamente modelos FBX con SkinnedMesh
        function cloneFBXModel(originalModel) {
            const clonedModel = originalModel.clone();
            
            // Recopilar todos los SkinnedMesh del modelo original en orden
            const originalSkinnedMeshes = [];
            originalModel.traverse((child) => {
                if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                    originalSkinnedMeshes.push(child);
                }
            });
            
            // Recopilar todos los SkinnedMesh del modelo clonado en el mismo orden
            const clonedSkinnedMeshes = [];
            clonedModel.traverse((child) => {
                if (child instanceof THREE.SkinnedMesh) {
                    clonedSkinnedMeshes.push(child);
                }
            });
            
            // Para cada par de SkinnedMesh (original y clonado), clonar el skeleton
            originalSkinnedMeshes.forEach((originalMesh, index) => {
                if (index < clonedSkinnedMeshes.length) {
                    const clonedMesh = clonedSkinnedMeshes[index];
                    const originalSkeleton = originalMesh.skeleton;
                    
                    // Crear nuevo skeleton
                    const clonedSkeleton = new THREE.Skeleton([]);
                    
                    // Mapa para relacionar bones originales con clonados
                    const boneMap = new Map();
                    
                    // Clonar todos los bones
                    clonedSkeleton.bones = originalSkeleton.bones.map((originalBone) => {
                        const clonedBone = originalBone.clone();
                        boneMap.set(originalBone, clonedBone);
                        return clonedBone;
                    });
                    
                    // Reconstruir la jerarquía de bones
                    clonedSkeleton.bones.forEach((clonedBone, boneIndex) => {
                        const originalBone = originalSkeleton.bones[boneIndex];
                        
                        // Limpiar hijos
                        clonedBone.children = [];
                        
                        // Restaurar la jerarquía padre-hijo
                        if (originalBone.parent && boneMap.has(originalBone.parent)) {
                            const clonedParent = boneMap.get(originalBone.parent);
                            clonedBone.parent = clonedParent;
                            clonedParent.children.push(clonedBone);
                        }
                        
                        // Copiar bindMatrixInverse
                        clonedBone.bindMatrixInverse.copy(originalBone.bindMatrixInverse);
                    });
                    
                    // Copiar bindMatrix y bindMatrixInverse del mesh original
                    if (originalMesh.bindMatrix) {
                        clonedMesh.bindMatrix.copy(originalMesh.bindMatrix);
                    }
                    if (originalMesh.bindMatrixInverse) {
                        clonedMesh.bindMatrixInverse.copy(originalMesh.bindMatrixInverse);
                    }
                    
                    // Vincular el skeleton clonado al mesh clonado
                    clonedMesh.bind(clonedSkeleton, clonedMesh.bindMatrix);
                    
                    console.log(`Skeleton clonado y vinculado para SkinnedMesh: ${clonedMesh.name || 'sin nombre'}, bones: ${clonedSkeleton.bones.length}`);
                }
            });
            
            return clonedModel;
        }
        
        // Intentar obtener modelo del cache primero
        let model;
        if (modelCache.has(modelUrl)) {
            console.log('Usando modelo en caché:', modelUrl);
            // Usar función de clonado personalizada para FBX
            if (fileExtension === 'fbx') {
                model = cloneFBXModel(modelCache.get(modelUrl));
            } else {
                model = modelCache.get(modelUrl).clone();
            }
        } else {
            console.log('Cargando modelo desde URL:', modelUrl);
            
            try {
                if (fileExtension === 'fbx') {
                    // Cargar archivo FBX (binario)
                    model = await new Promise((resolve, reject) => {
                        fbxLoader.load(
                            modelUrl,
                            (loadedModel) => {
                                console.log('Modelo FBX cargado exitosamente');
                                console.log('  Tipo:', loadedModel.type);
                                console.log('  Hijos:', loadedModel.children.length);
                                console.log('  Animaciones:', loadedModel.animations ? loadedModel.animations.length : 0);
                                
                                // Log de la estructura del modelo
                                let childCount = 0;
                                let meshCount = 0;
                                let skinnedMeshCount = 0;
                                loadedModel.traverse((child) => {
                                    childCount++;
                                    if (child instanceof THREE.Mesh) {
                                        meshCount++;
                                        console.log(`  - Mesh: ${child.name || 'sin nombre'}, visible: ${child.visible}, geometry: ${child.geometry ? 'sí' : 'no'}`);
                                    } else if (child instanceof THREE.SkinnedMesh) {
                                        skinnedMeshCount++;
                                        console.log(`  - SkinnedMesh: ${child.name || 'sin nombre'}, visible: ${child.visible}, geometry: ${child.geometry ? 'sí' : 'no'}`);
                                    }
                                });
                                console.log(`  Total de objetos en el árbol: ${childCount} (${meshCount} Mesh, ${skinnedMeshCount} SkinnedMesh)`);
                                
                                resolve(loadedModel);
                            },
                            (progress) => {
                                if (progress.lengthComputable) {
                                    const percentComplete = (progress.loaded / progress.total) * 100;
                                    console.log(`Cargando FBX: ${percentComplete.toFixed(1)}%`);
                                }
                            },
                            (error) => {
                                console.error('Error cargando FBX:', error);
                                reject(error);
                            }
                        );
                    });
                } else if (fileExtension === 'obj') {
                    // Cargar archivo OBJ (texto)
                const response = await fetch(modelUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const modelText = await response.text();
                
                // Verificar que el texto recibido parece un archivo OBJ válido
                    // Si contiene HTML, significa que el servidor devolvió una página de error
                    if (modelText.includes('<!DOCTYPE') || modelText.includes('<html')) {
                        throw new Error('El archivo no existe o el servidor devolvió HTML en lugar del modelo');
                    }
                    
                if (!modelText.includes('v ') || !modelText.includes('f ')) {
                    throw new Error('El archivo no parece ser un modelo OBJ válido');
                }
                
                    model = objLoader.parse(modelText);
                    console.log('Modelo OBJ cargado exitosamente');
                } else {
                    throw new Error(`Formato de archivo no soportado: ${fileExtension}. Formatos soportados: .obj, .fbx`);
                }
                
                // Guardar en caché (para FBX, usar función de clonado personalizada)
                if (fileExtension === 'fbx') {
                    // Para FBX, guardar una copia profunda que incluya skeletons correctamente
                    const cachedModel = model.clone();
                    // Asegurar que los skeletons se guarden correctamente
                    cachedModel.traverse((child) => {
                        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                            // El skeleton ya está vinculado, solo necesitamos asegurar que se guarde
                            child.skeleton.update();
                        }
                    });
                    modelCache.set(modelUrl, cachedModel);
                } else {
                    modelCache.set(modelUrl, model.clone());
                }
            } catch (error) {
                console.error('Error al cargar el modelo:', error);
                throw new Error(`No se pudo cargar el modelo desde ${modelUrl}: ${error.message}`);
            }
        }

        // Calcular dimensiones del panel en unidades de mundo
        const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1) * gridSize;
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * gridSize;

        // Material x-ray para modelos FBX (transparente, efecto de rayos X)
        const xrayMaterial = new THREE.MeshPhongMaterial({
            color: 0xcccccc, // Gris claro
            specular: 0xffffff,
            shininess: 100,
            transparent: true,
            opacity: 0.04, // 96% transparente (4% opaco)
            side: THREE.DoubleSide, // Ver ambos lados
            depthTest: true,
            depthWrite: false, // No escribir en depth buffer para efecto x-ray
            emissive: 0x888888, // Emisivo gris claro
            emissiveIntensity: 0.8 // Más intensidad para efecto más claro
        });
        
        // Material sólido para modelos OBJ — cuerpo oscuro azulado para que el
        // wireframe blanco contraste encima
        const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x0a1a3a, // Azul muy oscuro (fondo del wireframe)
            specular: 0x222222,
            shininess: 30,
            transparent: false,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true
        });

        // 🔆 Wireframe BLANCO brillante — contrasta con el fondo azul y florece
        // con el bloom cuando se sube el brillo (teclas [ y ])
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0xe8f4ff, // Blanco hielo
            transparent: true,
            opacity: 0.65, // más presencia blanca sobre el fondo azul
            depthTest: true,
            depthWrite: false
        });

        // Bordes resaltados: blanco puro, lo más brillante del modelo
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff, // Blanco puro
            transparent: false,
            opacity: 1.0,
            depthTest: true,
            depthWrite: false,
            linewidth: 2 // Nota: esto solo funciona en WebGL1
        });

        // Grupo para el modelo con mejor organización
        const modelGroup = new THREE.Group();
        modelGroup.name = 'ModelGroup';
        modelGroup.renderOrder = 1;
        
        // Grupo para la rotación isométrica con ajuste dinámico
        const isoGroup = new THREE.Group();
        isoGroup.name = 'IsoGroup';
        isoGroup.rotation.x = ISO_ANGLE;
        // La posición Z se ajustará después de calcular el tamaño del modelo

        // Marcar el grupo como modelo
        modelGroup.userData = {
            isModel: true,
            modelUrl: modelUrl,
            gridSize: gridSize,
            loadTime: Date.now()
        };

        // Aplicar materiales y optimizar geometría
        let meshCount = 0;
        let skinnedMeshCount = 0;
        
        // Para modelos FBX, mantener la estructura original, aplicar material oscuro y agregar wireframe
        // Para modelos OBJ, procesar con wireframe y bordes
        if (fileExtension === 'fbx') {
            // Para FBX, aplicar material oscuro y agregar wireframe
            const meshesToProcess = [];
            
            model.traverse((child) => {
                const isMesh = child instanceof THREE.Mesh;
                const isSkinnedMesh = child instanceof THREE.SkinnedMesh;
                
                if (isMesh || isSkinnedMesh) {
                    if (isSkinnedMesh) {
                        skinnedMeshCount++;
                        meshesToProcess.push(child); // También procesar SkinnedMesh
                    } else {
                        meshCount++;
                        meshesToProcess.push(child);
                    }
                    
                    // Aplicar material x-ray manteniendo la estructura original
                    if (!child.material) {
                        child.material = xrayMaterial.clone();
                    } else if (Array.isArray(child.material)) {
                        // Si tiene múltiples materiales, aplicar el material x-ray a todos
                        child.material = child.material.map(() => xrayMaterial.clone());
                    } else {
                        // Aplicar material x-ray
                        child.material = xrayMaterial.clone();
                    }
                    // Asegurar que el mesh sea visible
                    child.visible = true;
                }
            });
            
            // Agregar edges (bordes) a cada mesh (Mesh y SkinnedMesh)
            meshesToProcess.forEach((mesh) => {
                if (!mesh.geometry) return;
                
                const isSkinned = mesh instanceof THREE.SkinnedMesh;
                
                // Asegurar que la geometría tenga normales calculadas
                if (!mesh.geometry.attributes.normal || mesh.geometry.attributes.normal.count === 0) {
                    mesh.geometry.computeVertexNormals();
                }
                
                let edgesGeometry;
                
                if (isSkinned && mesh.skeleton) {
                    // Para SkinnedMesh, calcular posiciones deformadas iniciales
                    const deformedPositions = computeDeformedPositions(mesh);
                    
                    if (deformedPositions) {
                        // Crear geometría temporal con posiciones deformadas
                        const tempGeometry = new THREE.BufferGeometry();
                        tempGeometry.setAttribute('position', new THREE.BufferAttribute(deformedPositions, 3));
                        
                        // Copiar normales si existen
                        if (mesh.geometry.attributes.normal) {
                            tempGeometry.setAttribute('normal', mesh.geometry.attributes.normal.clone());
                        }
                        
                        // Crear edges desde geometría deformada
                        edgesGeometry = new THREE.EdgesGeometry(tempGeometry, 15);
                        tempGeometry.dispose();
                    } else {
                        // Fallback: usar geometría original
                        edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 15);
                    }
                } else {
                    // Para Mesh normal, usar geometría directamente
                    edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 15);
                }
                
                const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial.clone());
                edges.name = 'Edges';
                edges.renderOrder = 10;
                edges.visible = true;
                
                // Asegurar que el material sea visible
                if (edges.material) {
                    edges.material.visible = true;
                    edges.material.transparent = false;
                    edges.material.opacity = 1.0;
                }
                
                // Configurar edges para que hereden correctamente las transformaciones del mesh padre
                edges.matrixAutoUpdate = false; // Desactivar auto-update para control manual
                edges.frustumCulled = false;
                
                // Para SkinnedMesh, guardar referencia para actualización dinámica
                if (isSkinned && mesh.skeleton) {
                    mesh.userData.edgesToUpdate = edges;
                    // Asegurar que los edges estén en el mismo espacio que el mesh (transformación identidad)
                    edges.position.set(0, 0, 0);
                    edges.rotation.set(0, 0, 0);
                    edges.scale.set(1, 1, 1);
                    edges.matrix.identity();
                    // No copiar matrixWorld - dejar que Three.js lo calcule desde el padre
                }
                
                // Agregar los edges como hijo del mesh original
                mesh.add(edges);
                
                console.log(`Edges agregados a ${isSkinned ? 'SkinnedMesh' : 'Mesh'}: ${mesh.name || 'sin nombre'}, vértices: ${mesh.geometry.attributes.position.count}`);
            });
            
            console.log(`Modelo FBX procesado: ${meshCount} Mesh(es), ${skinnedMeshCount} SkinnedMesh(es) - Material x-ray y edges aplicados`);
        } else {
            // Para OBJ, procesar con wireframe y bordes como antes
            const processedMeshes = new Set(); // Evitar procesar el mismo mesh múltiples veces
            
        model.traverse((child) => {
                const isMesh = child instanceof THREE.Mesh;
                
                if (isMesh && !processedMeshes.has(child)) {
                    processedMeshes.add(child);
                    meshCount++;
                    
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
            console.log(`Modelo OBJ procesado: ${meshCount} Mesh(es) con wireframe y bordes`);
        }

        // Calcular bounding box y escala
        // Primero actualizar las matrices del mundo para obtener posiciones correctas
        model.updateMatrixWorld(true);
        
        // Calcular bounding box desde el objeto completo
        const bbox = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        bbox.getSize(modelSize);
        
        console.log(`Bounding box calculado: min=${bbox.min.x.toFixed(2)},${bbox.min.y.toFixed(2)},${bbox.min.z.toFixed(2)} max=${bbox.max.x.toFixed(2)},${bbox.max.y.toFixed(2)},${bbox.max.z.toFixed(2)}`);
        console.log(`Tamaño del modelo: ${modelSize.x.toFixed(2)} x ${modelSize.y.toFixed(2)} x ${modelSize.z.toFixed(2)}`);
        
        // Si el bounding box está vacío, intentar calcular desde geometrías individuales
        if (modelSize.x === 0 && modelSize.y === 0 && modelSize.z === 0 || 
            isNaN(modelSize.x) || isNaN(modelSize.y) || isNaN(modelSize.z)) {
            console.warn('⚠️ Bounding box vacío o inválido - intentando recalcular desde geometrías individuales');
            
            // Resetear el bounding box
            bbox.makeEmpty();
            
            // Calcular desde cada geometría individual
            model.traverse((child) => {
                if (child.geometry) {
                    // Calcular bounding box de la geometría si no existe
                    if (!child.geometry.boundingBox) {
                        child.geometry.computeBoundingBox();
                    }
                    
                    if (child.geometry.boundingBox) {
                        // Obtener los 8 vértices del bounding box
                        const box = child.geometry.boundingBox;
                        const vertices = [
                            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                            new THREE.Vector3(box.max.x, box.max.y, box.max.z)
                        ];
                        
                        // Aplicar la matriz del objeto a cada vértice y expandir el bbox
                        vertices.forEach(vertex => {
                            vertex.applyMatrix4(child.matrixWorld);
                            bbox.expandByPoint(vertex);
                        });
                    }
                }
            });
            
            bbox.getSize(modelSize);
            console.log(`Bounding box recalculado: ${modelSize.x.toFixed(2)} x ${modelSize.y.toFixed(2)} x ${modelSize.z.toFixed(2)}`);
        }
        
        // Si aún está vacío, usar un tamaño por defecto
        if (modelSize.x === 0 && modelSize.y === 0 && modelSize.z === 0 || 
            isNaN(modelSize.x) || isNaN(modelSize.y) || isNaN(modelSize.z)) {
            console.error('❌ No se pudo calcular el tamaño del modelo - usando tamaño por defecto');
            modelSize.set(1, 1, 1); // Tamaño por defecto
            bbox.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), modelSize);
        }

        // 📐 ALTURA PROYECTADA REAL en pantalla tras la rotación isométrica.
        // El grupo se rota ISO_ANGLE sobre X, así que la altura visible NO es solo `y`
        // ni solo `z`: es la proyección combinada de ambas. Usar solo una hacía que los
        // modelos se salieran de su recuadro contenedor.
        const cosA = Math.abs(Math.cos(ISO_ANGLE));
        const sinA = Math.abs(Math.sin(ISO_ANGLE));
        const projectedHeight = modelSize.y * cosA + modelSize.z * sinA; // alto visible
        const projectedWidth  = modelSize.x;                              // el ancho no rota

        // Márgenes: el modelo ocupa como máximo el 80% del panel para dejar aire
        const FIT_MARGIN = 0.70;
        const scaleX = (panelWidth  * FIT_MARGIN) / Math.max(projectedWidth, 0.0001);
        const scaleY = (panelHeight * FIT_MARGIN) / Math.max(projectedHeight, 0.0001);

        // La escala más restrictiva garantiza que quepa completo en ambas dimensiones
        let scale = Math.min(scaleX, scaleY);

        // Los FBX suelen traer geometría extra; un poco más conservador
        if (fileExtension === 'fbx') {
            scale *= 0.85;
        }

        // Ajustar posición Z del grupo isométrico basándose en la altura del modelo para evitar clipping
        const heightFactor = Math.max(modelSize.z / Math.max(modelSize.x, modelSize.y), 1.0);
        let dynamicOffset = MODEL_FORWARD_OFFSET * Math.min(heightFactor, 2.0);
        
        // Para modelos FBX escalados 3x, alejar el modelo de la cámara para evitar clipping
        if (fileExtension === 'fbx') {
            // Alejar el modelo moviéndolo más hacia adelante (offset positivo o menos negativo)
            // La cámara está en z=10, así que mover el modelo hacia z=0 o positivo lo aleja
            // Con escala 3x, necesitamos alejar significativamente el modelo
            dynamicOffset = 2.0; // Offset positivo para alejar el modelo de la cámara
        }
        // Ajustar clip plane de la cámara ANTES de posicionar el modelo
        // Calcular el tamaño máximo del modelo escalado
        const maxScaledSize = Math.max(modelSize.x, modelSize.y, modelSize.z) * scale;
        // Asegurar que el far plane sea suficiente para el modelo escalado
        // Usar al menos 5x el tamaño máximo del modelo más la distancia de la cámara
        const requiredFar = Math.max(1000, maxScaledSize * 5 + 20);
        
        // Reducir el near plane para evitar recortes cuando el modelo está cerca
        // Usar un valor extremadamente pequeño para permitir que el modelo esté muy cerca de la cámara
        // Con modelos escalados 3x, necesitamos un near plane muy pequeño
        // Para modelos grandes cerca de la cámara, usar un near plane aún más pequeño
        const requiredNear = 0.0001; // Extremadamente pequeño para evitar recortes con modelos grandes escalados
        
        // Ajustar clip plane ANTES de posicionar el modelo
        if (typeof window !== 'undefined' && window.camera) {
            let needsUpdate = false;
            
            // Ajustar far plane si es necesario
            if (window.camera.far < requiredFar) {
                window.camera.far = requiredFar;
                needsUpdate = true;
            }
            
            // Ajustar near plane para evitar recortes cercanos (siempre reducir si es necesario)
            if (window.camera.near > requiredNear) {
                window.camera.near = requiredNear;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                window.camera.updateProjectionMatrix();
                console.log(`Clip plane ajustado: near = ${requiredNear}, far = ${requiredFar.toFixed(2)} para modelo escalado (300%)`);
            }
        }
        
        isoGroup.position.z = dynamicOffset;
        
        // Intentar acceder a la cámara global si está disponible
        if (typeof window !== 'undefined' && window.camera) {
            let needsUpdate = false;
            
            // Ajustar far plane si es necesario
            if (window.camera.far < requiredFar) {
                window.camera.far = requiredFar;
                needsUpdate = true;
            }
            
            // Ajustar near plane para evitar recortes cercanos
            if (window.camera.near > requiredNear) {
                window.camera.near = requiredNear;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                window.camera.updateProjectionMatrix();
                console.log(`Clip plane ajustado: near = ${requiredNear}, far = ${requiredFar.toFixed(2)} para modelo escalado (300%)`);
            }
        }

        model.scale.set(scale, scale, scale);

        // Centrar modelo con más precisión considerando el escalado conservador
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        // Posicionar el modelo centrado en el panel
        // Para modelos FBX escalados 3x, ajustar Z para alejar el modelo de la cámara
        let zOffset = -center.z * scale * 0.2; // Elevar ligeramente del suelo del panel
        if (fileExtension === 'fbx') {
            // Para FBX escalado 3x, alejar el modelo moviéndolo más hacia adelante
            // Usar offset positivo o menos negativo para alejar del near plane
            zOffset = -center.z * scale * 0.05; // Muy poca elevación para alejar del near plane
        }
        
        model.position.set(
            -center.x * scale,  // Centrar horizontalmente
            -center.y * scale,  // Centrar en profundidad (será la altura visual después de rotar)
            zOffset
        );

        // Rotar el modelo 90 grados en X para acostarlo
        model.rotation.x = Math.PI / 2;
        
        // Añadir el modelo al grupo isométrico
        isoGroup.add(model);
        modelGroup.add(isoGroup);
        panel.group.add(modelGroup);

        // 📦 AJUSTE FINAL DE CONTENCIÓN: medir el tamaño REAL ya rotado/escalado y,
        // si excede el recuadro del panel, reducir hasta que quepa y recentrar.
        // Esto captura el efecto de la rotación isométrica, wireframes y edges extra.
        try {
            isoGroup.updateMatrixWorld(true);
            const fitBox = new THREE.Box3().setFromObject(isoGroup);
            const fitSize = new THREE.Vector3();
            const fitCenter = new THREE.Vector3();
            fitBox.getSize(fitSize);
            fitBox.getCenter(fitCenter);

            if (isFinite(fitSize.x) && isFinite(fitSize.y) && fitSize.x > 0 && fitSize.y > 0) {
                const limitW = panelWidth * FIT_MARGIN;
                const limitH = panelHeight * FIT_MARGIN;
                // Solo REDUCIR si excede — nunca mover (la posición ya está centrada
                // por el offset del bbox; tocarla mezclaría coords locales y de mundo).
                const shrink = Math.min(limitW / fitSize.x, limitH / fitSize.y, 1);
                if (shrink < 0.999) {
                    isoGroup.scale.multiplyScalar(shrink);
                    isoGroup.updateMatrixWorld(true);
                }
            }
        } catch (e) {
            console.warn('Ajuste de contención del modelo falló:', e);
        }
        
        // Para modelos FBX, hacer invisible el panel (solo mostrar el modelo)
        if (fileExtension === 'fbx' && panel.group) {
            // Hacer invisible el fillMesh y borderLines del panel
            if (panel.fillMesh) {
                panel.fillMesh.visible = false;
                // Deshabilitar raycasts para que no intercepte clicks
                if (panel.fillMesh.userData) {
                    panel.fillMesh.userData.ignoreRaycast = true;
                } else {
                    panel.fillMesh.userData = { ignoreRaycast: true };
                }
            }
            
            if (panel.borderLines) {
                panel.borderLines.forEach(line => {
                    line.visible = false;
                    // Deshabilitar raycasts
                    if (line.userData) {
                        line.userData.ignoreRaycast = true;
                    } else {
                        line.userData = { ignoreRaycast: true };
                    }
                });
            }
            
            // Hacer invisible otros elementos del panel pero mantener el modelo visible
            // Solo ocultar hijos directos del panel que NO sean el modelGroup
            panel.group.children.forEach((child) => {
                // No ocultar el modelGroup que contiene el modelo
                if (child !== modelGroup && !child.userData?.isModel) {
                    if (child.visible !== undefined) {
                        child.visible = false;
                    }
                    // Deshabilitar raycasts
                    if (child.userData) {
                        child.userData.ignoreRaycast = true;
                    } else {
                        child.userData = { ignoreRaycast: true };
                    }
                }
            });
            
            // Asegurar que el modelGroup y sus hijos sean visibles
            modelGroup.visible = true;
            isoGroup.visible = true;
            model.visible = true;
            
            // Asegurar que todos los meshes y edges del modelo sean visibles
            model.traverse((child) => {
                if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                    child.visible = true;
                } else if (child instanceof THREE.LineSegments && child.name === 'Edges') {
                    // Asegurar que los edges sean visibles
                    child.visible = true;
                    if (child.material) {
                        child.material.visible = true;
                        child.material.transparent = false; // No transparente para mejor visibilidad
                        child.material.opacity = 1.0;
                    }
                }
            });
            
            console.log('Panel oculto para modelo FBX - solo se muestra el modelo');
        }

        // Detectar y configurar animaciones FBX
        // Nota: Las animaciones se configuran después de clonar, ya que cada instancia necesita su propio mixer
        let animationMixer = null;
        let animationAction = null;
        let hasAnimation = false;
        
        // Verificar si el modelo tiene animaciones (funciona tanto para modelos nuevos como clonados)
        if (fileExtension === 'fbx' && model.animations && model.animations.length > 0) {
            console.log(`Modelo FBX tiene ${model.animations.length} animación(es)`);
            hasAnimation = true;
            
            // Crear AnimationMixer para el modelo (cada instancia necesita su propio mixer)
            animationMixer = new THREE.AnimationMixer(model);
            
            // Obtener la primera animación (o la principal)
            const animationClip = model.animations[0];
            console.log(`Animación: ${animationClip.name}, duración: ${animationClip.duration}s`);
            
            // Crear AnimationAction
            animationAction = animationMixer.clipAction(animationClip);
            
            // Configurar para reproducir una vez y detenerse en el último frame
            animationAction.setLoop(THREE.LoopOnce, 1);
            animationAction.clampWhenFinished = true; // Mantener en el último frame
            
            // Reproducir la animación
            animationAction.play();
            console.log('Animación FBX iniciada, se detendrá en el último frame');
        }

        // Guardar estado del modelo con más información
        const modelState = {
            model: model,
            rotationSpeed: 0.005,
            isRotating: true, // Rotar constantemente en Y
            lastRotationTime: performance.now(),
            lastAnimationTime: performance.now(), // Tiempo separado para animaciones
            initialRotation: model.rotation.y,
            loadTime: Date.now(),
            url: modelUrl,
            animationMixer: animationMixer, // Guardar mixer para actualización
            animationAction: animationAction, // Guardar action para control
            hasAnimation: hasAnimation // Flag para saber si tiene animación
        };
        
        panelModelState.set(panel, modelState);
        
        // Aplicar efectos visuales para la rotación activa
        model.traverse((child) => {
            if (child.material && child.material.opacity !== undefined) {
                child.material.baseOpacity = child.material.opacity;
            }
        });
        
        console.log(`Modelo cargado exitosamente: ${modelUrl}`);
        console.log(`  - Tamaño original: ${modelSize.x.toFixed(2)} x ${modelSize.y.toFixed(2)} x ${modelSize.z.toFixed(2)}`);
        console.log(`  - Panel: ${panelWidth.toFixed(2)} x ${panelHeight.toFixed(2)}`);
        console.log(`  - Escala aplicada: ${scale.toFixed(3)}`);
        console.log(`  - Factor altura: ${heightFactor.toFixed(2)}, Offset Z: ${dynamicOffset.toFixed(2)}`);

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

        // Actualizar animaciones FBX si existen
        if (modelState.hasAnimation && modelState.animationMixer) {
            const deltaTime = (currentTime - (modelState.lastAnimationTime || currentTime)) / 1000;
            modelState.lastAnimationTime = currentTime;
            
            // Actualizar el mixer de animación (esto actualiza los skeletons)
            modelState.animationMixer.update(deltaTime);
            
            // Actualizar edges de SkinnedMesh después de que el skeleton se haya actualizado
            // Throttle agresivo: solo actualizar cada 66ms (~15fps) para máximo rendimiento
            // Los edges son visuales secundarios, no críticos para la animación principal
            const shouldUpdateEdges = !modelState.lastEdgeUpdate || (currentTime - modelState.lastEdgeUpdate) > 66;
            if (shouldUpdateEdges) {
                modelState.lastEdgeUpdate = currentTime;
                
                modelState.model.traverse((child) => {
                    if (child instanceof THREE.SkinnedMesh && child.skeleton && child.userData.edgesToUpdate) {
                        const edges = child.userData.edgesToUpdate;
                        
                        try {
                            // Los edges son hijos del mesh, así que deben estar en espacio local del mesh
                            // Solo actualizar matrices si realmente cambiaron
                            if (edges.matrixAutoUpdate !== false) {
                                edges.position.set(0, 0, 0);
                                edges.rotation.set(0, 0, 0);
                                edges.scale.set(1, 1, 1);
                                edges.matrix.identity();
                                edges.updateMatrix();
                            }
                            
                            // Calcular posiciones deformadas (optimizado)
                            const deformedPositions = computeDeformedPositions(child);
                            if (!deformedPositions) return;
                            
                            // Reutilizar geometría temporal
                            let tempGeometry = edges.userData.tempGeometry;
                            if (!tempGeometry) {
                                tempGeometry = new THREE.BufferGeometry();
                                edges.userData.tempGeometry = tempGeometry;
                            }
                            
                            // Actualizar posiciones
                            if (!tempGeometry.attributes.position || tempGeometry.attributes.position.count !== deformedPositions.length / 3) {
                                tempGeometry.setAttribute('position', new THREE.BufferAttribute(deformedPositions, 3));
                            } else {
                                tempGeometry.attributes.position.array.set(deformedPositions);
                                tempGeometry.attributes.position.needsUpdate = true;
                            }
                            
                            // Reutilizar EdgesGeometry
                            let newEdgesGeometry = edges.userData.edgesGeometryCache;
                            if (!newEdgesGeometry || !newEdgesGeometry.attributes.position || 
                                newEdgesGeometry.attributes.position.count !== deformedPositions.length / 3) {
                                if (newEdgesGeometry) {
                                    newEdgesGeometry.dispose();
                                }
                                newEdgesGeometry = new THREE.EdgesGeometry(tempGeometry, 15);
                                edges.userData.edgesGeometryCache = newEdgesGeometry;
                            } else {
                                newEdgesGeometry.setAttribute('position', tempGeometry.attributes.position);
                            }
                            
                            // Actualizar posiciones del edges
                            const edgesPositions = edges.geometry.attributes.position;
                            const newPositions = newEdgesGeometry.attributes.position;
                            
                            if (edgesPositions && newPositions && edgesPositions.count === newPositions.count) {
                                edgesPositions.array.set(newPositions.array);
                                edgesPositions.needsUpdate = true;
                            } else {
                                if (edges.geometry) {
                                    edges.geometry.dispose();
                                }
                                edges.geometry = newEdgesGeometry;
                                edges.userData.edgesGeometryCache = null;
                            }
                        } catch (error) {
                            console.warn('Error actualizando edges de SkinnedMesh:', error);
                        }
                    }
                });
            }
            
            // Verificar si la animación ha terminado
            if (modelState.animationAction && modelState.animationAction.paused) {
                // La animación ya está pausada en el último frame
                // No hacer nada más
            }
        }

        // 🧬 En modo HOMO PRINTEMPS, continuar rotación desde centro del grid
        // (El modelo ya está posicionado en Z=0 por setModelToFlatlayPosition)
        const isHomoPrintemps = modelState.isHomoPrintemps === true;
        
        // Si isRotating es true o no está definido, rotar el modelo
        // El valor por defecto es true para compatibilidad con modelos existentes
        // Rotar incluso si tiene animación FBX
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
            
            // Aplicar rotación al modelo (asegurar que rote incluso con animación)
            if (modelState.model) {
                modelState.model.rotation.y = (modelState.model.rotation.y + rotationAmount) % (Math.PI * 2);
            }

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
            // Limpiar animaciones si existen
            if (modelState.animationMixer) {
                // Detener todas las acciones
                if (modelState.animationAction) {
                    modelState.animationAction.stop();
                }
                // Limpiar el mixer
                modelState.animationMixer.uncacheRoot(modelState.model);
            }
            
            const parent = modelState.model.parent;
            if (parent) {
                parent.remove(modelState.model);
            }
            modelState.model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                // Los FBX (megazord) traen mallas con array de materiales
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m && m.dispose && m.dispose());
                } else if (child.material && child.material.dispose) {
                    child.material.dispose();
                }
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
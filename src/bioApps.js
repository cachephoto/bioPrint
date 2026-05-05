import * as THREE from 'three';

// Configuración de la cuadrícula de iconos
const GRID_CONFIG = {
    COLS: 5,
    ROWS: 4
};

// Lista de iconos individuales con sus rutas (usando los nombres de archivo existentes)
const APP_ICONS = [
    // Primera fila
    { name: 'app_1', path: 'public/img/app_1.png' },
    { name: 'app_2', path: 'public/img/app_2.png' },
    { name: 'app_3', path: 'public/img/app_3.png' },
    { name: 'app_4', path: 'public/img/app_4.png' },
    { name: 'app_5', path: 'public/img/app_5.png' },
    
    // Segunda fila
    { name: 'app_6', path: 'public/img/app_6.png' },
    { name: 'app_7', path: 'public/img/app_7.png' },
    { name: 'app_8', path: 'public/img/app_8.png' },
    { name: 'app_9', path: 'public/img/app_9.png' },
    { name: 'app_10', path: 'public/img/app_10.png' },
    
    // Tercera fila
    { name: 'app_11', path: 'public/img/app_11.png' },
    { name: 'app_12', path: 'public/img/app_12.png' },
    { name: 'app_13', path: 'public/img/app_13.png' },
    { name: 'app_14', path: 'public/img/app_14.png' },
    { name: 'app_15', path: 'public/img/app_15.png' },
    
    // Cuarta fila
    { name: 'app_16', path: 'public/img/app_16.png' },
    { name: 'app_17', path: 'public/img/app_17.png' },
    { name: 'app_18', path: 'public/img/app_18.png' },
    { name: 'app_19', path: 'public/img/app_19.png' },
    { name: 'app_20', path: 'public/img/app_20.png' }
];

// TextureLoader compartido para cargar las texturas
const textureLoader = new THREE.TextureLoader();

/**
 * Crea una cuadrícula de paneles con iconos de apps
 * @param {Object} containerPanel - Panel contenedor donde se crearán los iconos
 * @param {Function} createPanelFn - Función para crear un panel (createPanelFromBoundingBox)
 * @param {Function} getCurrentGridParamsFn - Función para obtener parámetros del grid
 * @param {Object} panelMaterials - Materiales para los paneles (normal, hover, selected)
 * @param {Function} successCallback - Función a llamar cuando se completa la carga
 * @param {Function} errorCallback - Función a llamar cuando ocurre un error
 */
function createAppGrid(containerPanel, createPanelFn, getCurrentGridParamsFn, panelMaterials, successCallback, errorCallback) {
    // Calcular dimensiones del contenedor en celdas
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    // Verificar que el contenedor sea lo suficientemente grande
    if (containerWidth < 15 || containerHeight < 9) {
        if (errorCallback) errorCallback(`El panel debe ser al menos de 15x9 celdas (actual: ${containerWidth}x${containerHeight})`);
        return;
    }
    
    // Configuración de la cuadrícula
    const columns = GRID_CONFIG.COLS;
    const rows = GRID_CONFIG.ROWS;
    const iconSize = Math.min(
        Math.floor(containerWidth / columns),
        Math.floor(containerHeight / rows)
    );
    
    // Obtener parámetros actuales del grid
    const gridParams = getCurrentGridParamsFn();
    if (!gridParams) {
        if (errorCallback) errorCallback('No se pudieron obtener los parámetros del grid');
        return;
    }
    
    // Calcular offset para centrar los iconos en el contenedor
    const totalGridWidth = columns * iconSize;
    const totalGridHeight = rows * iconSize;
    const offsetX = Math.floor((containerWidth - totalGridWidth) / 2);
    const offsetY = Math.floor((containerHeight - totalGridHeight) / 2);
    
    // Crear paneles para cada icono
    const createdPanels = [];
    const iconLoadPromises = [];
    
    for (let i = 0; i < APP_ICONS.length && i < (columns * rows); i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        
        try {
            // Calcular índices del grid relativos al contenedor
            const bboxIndices = {
                minX: containerPanel.minCellIndex.x + offsetX + (col * iconSize),
                maxX: containerPanel.minCellIndex.x + offsetX + ((col + 1) * iconSize) - 1,
                minY: containerPanel.minCellIndex.y + offsetY + (row * iconSize),
                maxY: containerPanel.minCellIndex.y + offsetY + ((row + 1) * iconSize) - 1
            };
            
            // Crear panel
            const panelData = createPanelFn(bboxIndices, gridParams);
            if (panelData) {
                // Cargar la textura para este panel específico
                const iconInfo = APP_ICONS[i];
                
                // Crear una promesa para la carga de la textura
                const loadPromise = new Promise((resolve, reject) => {
                    loadPanelTexture(iconInfo.path, (texture) => {
                        applyTextureToPanel(panelData, texture, panelMaterials);
                        createdPanels.push(panelData);
                        console.log(`Icono ${iconInfo.name} cargado correctamente`);
                        resolve();
                    }, (error) => {
                        console.error(`Error cargando icono ${iconInfo.name}:`, error);
                        // No rechazamos la promesa para que otros iconos puedan cargarse
                        resolve();
                    });
                });
                
                iconLoadPromises.push(loadPromise);
            }
        } catch (error) {
            console.error(`Error al crear el panel ${i}:`, error);
            if (errorCallback) errorCallback(`Error al crear el panel ${i}: ${error.message}`);
        }
    }
    
    // Esperar a que todas las imágenes se carguen
    Promise.all(iconLoadPromises).then(() => {
        if (successCallback) successCallback(createdPanels);
    });
}

/**
 * Carga una textura de icono para un panel
 * @param {string} path - Ruta de la imagen
 * @param {Function} onSuccess - Función a llamar cuando se carga exitosamente
 * @param {Function} onError - Función a llamar cuando ocurre un error
 */
function loadPanelTexture(path, onSuccess, onError) {
    console.log(`Intentando cargar textura desde: ${path}`);
    
    // También intentar con una ruta relativa alternativa si la original falla
    const tryLoad = (currentPath) => {
        textureLoader.load(
            currentPath,
            (texture) => {
                console.log(`Textura cargada exitosamente desde: ${currentPath}`);
                
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                
                if (onSuccess) onSuccess(texture);
            },
            (xhr) => {
                console.log(`${currentPath}: ${(xhr.loaded / xhr.total * 100)}% loaded`);
            },
            (error) => {
                console.error(`Error cargando textura desde ${currentPath}:`, error);
                
                // Si la ruta original falla, intentar con una alternativa
                if (currentPath === path) {
                    // Intentar con una ruta alternativa (quitar o añadir 'public/')
                    const altPath = currentPath.includes('public/') 
                        ? currentPath.replace('public/', '') 
                        : 'public/' + currentPath;
                    
                    console.log(`Intentando ruta alternativa: ${altPath}`);
                    tryLoad(altPath);
                } else {
                    // Si ya intentamos la ruta alternativa, fallar definitivamente
                    if (onError) onError(error);
                }
            }
        );
    };
    
    // Iniciar con la ruta original
    tryLoad(path);
}

/**
 * Aplica una textura a un panel
 * @param {Object} panelData - Datos del panel
 * @param {THREE.Texture} texture - Textura del icono
 * @param {Object} lineMaterials - Materiales para las líneas de borde
 */
function applyTextureToPanel(panelData, texture, lineMaterials) {
    if (!panelData || !panelData.fillMesh) return;
    
    // Crear materiales para los diferentes estados con la textura individual
    const normalMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    
    const hoverMaterial = new THREE.MeshBasicMaterial({
        map: texture.clone(),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    const selectedMaterial = new THREE.MeshBasicMaterial({
        map: texture.clone(),
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });
    
    // Aplicar el material normal inicialmente
    panelData.fillMesh.material = normalMaterial;
    
    // Marcar el panel como que tiene textura y guardar los materiales para los diferentes estados
    panelData.hasTexture = true;
    panelData.textureType = 'app'; // 🔥 Guardar tipo para snapshots
    panelData.texturePath = texture.image?.src || null; // 🔥 Guardar ruta si está disponible
    panelData.textureMaterials = {
        normal: normalMaterial,
        hover: hoverMaterial,
        selected: selectedMaterial
    };
    
    // Asegurar que el panel sea visible y tenga el material correcto para los bordes
    if (panelData.group) {
        panelData.group.visible = true;
        if (panelData.borderLines && lineMaterials) {
            panelData.borderLines.forEach(line => {
                line.material = lineMaterials.normal;
            });
        }
    }
}

export {
    createAppGrid,
    GRID_CONFIG
}; 
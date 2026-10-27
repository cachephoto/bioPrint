// Configuración de los iconos en la imagen
const ICON_GRID = {
    COLS: 4, // 4 columnas
    ROWS: 5, // 5 filas
    ICON_SIZE: 1/4  // Cada icono ocupa 1/4 del ancho
};

// Función para obtener las coordenadas UV de un icono específico
function getIconUVs(iconIndex) {
    const col = iconIndex % ICON_GRID.COLS;
    const row = Math.floor(iconIndex / ICON_GRID.COLS);
    
    return {
        u1: col * ICON_GRID.ICON_SIZE,
        v1: 1 - ((row + 1) * ICON_GRID.ICON_SIZE), // Invertido porque la textura se carga al revés
        u2: (col + 1) * ICON_GRID.ICON_SIZE,
        v2: 1 - (row * ICON_GRID.ICON_SIZE)
    };
}

function mapApps(args, output) {
    // Verificar si hay un panel seleccionado para usar como contenedor
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length !== 1) {
        showError('Selecciona exactamente un panel para usar como contenedor de las apps', output);
        return;
    }
    
    const containerPanel = selectedPanels[0];
    showInfo('Creando grid de apps en el panel seleccionado...', output);
    
    // Calcular dimensiones del contenedor en celdas
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    // Verificar que el contenedor sea lo suficientemente grande
    if (containerWidth < 15 || containerHeight < 9) {
        showError(`El panel debe ser al menos de 15x9 celdas (actual: ${containerWidth}x${containerHeight})`, output);
        return;
    }
    
    // Cargar la textura de los iconos con mejor manejo de errores
    const textureLoader = new THREE.TextureLoader();
    
    // Intentar diferentes rutas relativas
    const possiblePaths = [
        './img/apps.png',
        '../img/apps.png',
        'img/apps.png',
        './img/apps.png',
        '../img/apps.png',
        '/img/apps.png',
        './img/apps.png'
    ];
    
    let textureLoadAttempts = 0;
    
    function tryLoadTexture(pathIndex) {
        if (pathIndex >= possiblePaths.length) {
            showError(`No se pudo cargar la textura después de intentar todas las rutas posibles`, output);
            console.error('Rutas intentadas:', possiblePaths);
            return;
        }
        
        const path = possiblePaths[pathIndex];
        console.log(`Intentando cargar textura desde: ${path}`);
        
        textureLoader.load(
            path,
            (texture) => {
                console.log(`Textura cargada exitosamente desde: ${path}`);
                showInfo(`Textura cargada desde: ${path}`, output);
                
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;

                // Configuración del grid
                const columns = 4; // 4 columnas
                const rows = 5;    // 5 filas
                const iconSize = Math.min(
                    Math.floor(containerWidth / columns),
                    Math.floor(containerHeight / rows)
                );
                
                // Configuración de los iconos y sus índices en la imagen (total: 20 iconos)
                const iconIndices = [
                    0, 1, 2, 3,      // Primera fila
                    4, 5, 6, 7,      // Segunda fila
                    8, 9, 10, 11,    // Tercera fila
                    12, 13, 14, 15,  // Cuarta fila
                    16, 17, 18, 19   // Quinta fila
                ];
                
                // Obtener parámetros actuales del grid
                const gridParams = getCurrentGridParams();
                if (!gridParams) {
                    showError('No se pudieron obtener los parámetros del grid', output);
                    return;
                }
                
                // Calcular offset para centrar los iconos en el contenedor
                const totalGridWidth = columns * iconSize;
                const totalGridHeight = rows * iconSize;
                const offsetX = Math.floor((containerWidth - totalGridWidth) / 2);
                const offsetY = Math.floor((containerHeight - totalGridHeight) / 2);
                
                // Crear paneles para cada icono
                for (let i = 0; i < iconIndices.length; i++) {
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
                        const panelData = createPanelFromBoundingBox(bboxIndices, gridParams);
                        if (panelData) {
                            // Crear material con la textura y las coordenadas UV específicas del icono
                            if (panelData.fillMesh) {
                                const iconUVs = getIconUVs(iconIndices[i]);
                                const geometry = panelData.fillMesh.geometry;
                                const uvAttribute = geometry.attributes.uv;
                                
                                // Debug UV mapping
                                console.log(`Panel ${i} UVs:`, iconUVs);
                                
                                // Actualizar las coordenadas UV para mapear el icono correcto
                                for (let j = 0; j < uvAttribute.count; j++) {
                                    const u = uvAttribute.getX(j);
                                    const v = uvAttribute.getY(j);
                                    
                                    // Mapear las coordenadas UV locales a las coordenadas del icono en la textura
                                    uvAttribute.setXY(
                                        j,
                                        iconUVs.u1 + (u * (iconUVs.u2 - iconUVs.u1)),
                                        iconUVs.v1 + (v * (iconUVs.v2 - iconUVs.v1))
                                    );
                                }
                                
                                uvAttribute.needsUpdate = true;
                                
                                // Crear material con la textura que siempre será visible
                                const material = new THREE.MeshBasicMaterial({
                                    map: texture,
                                    transparent: true,
                                    opacity: 0.9,
                                    side: THREE.DoubleSide
                                });
                                
                                // Aplicar el material al panel
                                panelData.fillMesh.material = material;
                                
                                // Guardar materiales con texturas para diferentes estados
                                panelData.hasTexture = true;
                                panelData.textureMaterials = {
                                    normal: new THREE.MeshBasicMaterial({
                                        map: texture,
                                        transparent: true,
                                        opacity: 0.8,
                                        side: THREE.DoubleSide
                                    }),
                                    hover: new THREE.MeshBasicMaterial({
                                        map: texture,
                                        transparent: true, 
                                        opacity: 0.9,
                                        side: THREE.DoubleSide
                                    }),
                                    selected: new THREE.MeshBasicMaterial({
                                        map: texture,
                                        transparent: true,
                                        opacity: 1.0,
                                        side: THREE.DoubleSide
                                    })
                                };
                                
                                // Configurar las UVs para cada material
                                [panelData.textureMaterials.normal, panelData.textureMaterials.hover, panelData.textureMaterials.selected].forEach(mat => {
                                    if (mat.map) {
                                        mat.map = texture.clone();
                                    }
                                });
                            }
                            
                            // Asegurar que el panel sea visible y tenga el material correcto para los bordes
                            if (panelData.group) {
                                panelData.group.visible = true;
                                panelData.borderLines.forEach(line => {
                                    line.material = panelLineMaterialNormal.clone();
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error al crear el panel ${i}:`, error);
                        showError(`Error al crear el panel ${i}: ${error.message}`, output);
                    }
                }
                
                // Deseleccionar el panel contenedor
                containerPanel.selected = false;
                updatePanelColor(containerPanel);
                
                showSuccess('¡Iconos de apps mapeados exitosamente en cuadrícula de 4x5!', output);
                
                // Forzar actualización de la escena
                if (typeof render === 'function') {
                    render();
                }
            },
            (xhr) => {
                console.log(`${path}: ${(xhr.loaded / xhr.total * 100)}% loaded`);
            },
            (error) => {
                console.error(`Error cargando textura desde ${path}:`, error);
                textureLoadAttempts++;
                tryLoadTexture(pathIndex + 1);
            }
        );
    }
    
    // Comenzar intentos de carga
    tryLoadTexture(0);
} 
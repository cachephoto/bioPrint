import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Materiales base para paneles con textura
const createPanelMaterials = (texture) => ({
    normal: new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    }),
    hover: new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    }),
    selected: new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    })
});

// Utilidad compartida para cargar texturas
const textureLoader = new THREE.TextureLoader();

function loadTexture(path, onLoad, onError) {
    console.log('Intentando cargar textura desde:', path);
    textureLoader.load(
        path,
        (texture) => {
            console.log('Textura cargada exitosamente:', path);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            onLoad(texture);
        },
        (xhr) => {
            console.log(`${path}: ${(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        (error) => {
            console.error('Error cargando textura:', path, error);
            if (onError) onError(error);
        }
    );
}
import { 
    initPanelText, 
    createPanelText, 
    handleTextInput, 
    startTextEditing, 
    stopTextEditing, 
    setPanelText, 
    updatePanelText,
    cleanupPanelText,
    getPanelText,
    panelTextState,
    TEXT_CONFIG
} from './panelText.js';
import { initBioFX, setColorEffect, render as renderBioFX, setBloomEffect } from './bioFX.js';
import { 
    loadModelToPanel, 
    toggleModelRotation, 
    setModelRotationSpeed, 
    animateModels, 
    cleanupPanelModels, 
    preserveModel, 
    restoreModel 
} from './panelModel.js';
import { loadGenomToPanel, animateGenoms, cleanupGenomModels, loadGTACToPanel } from './genomModel.js';
import { 
    initBioKeyb, 
    createKeyboard, 
    createKeyLabel,
    keyboardState // AÑADIR keyboardState
} from './bioKeyb.js';
import { handleLogoCommand, updateOnPanelMove } from './bioLOGO.js';
import { loadCodonToPanel, animateCodons, cleanupCodonModels } from './codonModel.js';
import { createProgressPanel, cleanupProgressPanel } from './bioLoad.js';
import { createAppGrid } from './bioApps.js';

// Variables globales para controlar la visibilidad del teclado
let bioKeybVisible = false; // Controla si el teclado está visible o no
let bioKeybModuleInitialized = false; // NUEVA variable para rastrear la inicialización del módulo

// Mapa para almacenar los intervalos de GATC
const gatcIntervals = new Map(); // Para gestionar los intervalos de animación GATC

// Manejar el splash screen
document.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splash-screen');
  const appContainer = document.querySelector('.app-container');
  const loadingDots = document.getElementById('loading-dots');
  
  // Asegurar que el grid se animará en la primera creación
  isFirstGridCreation = true;
  
  // Animar los puntos suspensivos
  let dotCount = 0;
  const dotInterval = setInterval(() => {
    dotCount = (dotCount % 3) + 1;
    loadingDots.textContent = 'Iniciando' + '.'.repeat(dotCount) + ' '.repeat(3 - dotCount);
  }, 500);
  
  // Crear un div negro que cubra toda la pantalla hasta que comience la animación
  const blackOverlay = document.createElement('div');
  blackOverlay.style.position = 'fixed';
  blackOverlay.style.top = '0';
  blackOverlay.style.left = '0';
  blackOverlay.style.width = '100%';
  blackOverlay.style.height = '100%';
  blackOverlay.style.backgroundColor = '#000';
  blackOverlay.style.zIndex = '1000'; // Por debajo del splash pero por encima de la escena
  blackOverlay.id = 'black-overlay';
  document.body.appendChild(blackOverlay);
  
  // Mostrar la aplicación después de 3 segundos
  setTimeout(() => {
    clearInterval(dotInterval);
    splashScreen.style.opacity = '0';
    appContainer.style.opacity = '1';
    
    // Remover el splash screen después de la transición
    setTimeout(() => {
      splashScreen.style.display = 'none';
      
      // Limpiar completamente cualquier grid existente
      if (currentGrid) {
        scene.remove(currentGrid);
        currentGrid = null;
      }
      
      // Esperar un momento antes de iniciar la animación del grid
      setTimeout(() => {
        // Eliminar el overlay negro justo antes de empezar la animación
        document.body.removeChild(blackOverlay);
        
        // Iniciar la animación de 24 cuadros
        startGridAnimation24Frames();
      }, 200);
      
    }, 500);
  }, 3000);
});

// Variables para la animación de 24 cuadros
let animationFrame = 0;
const totalFrames = 24;
let animationInterval = null;
const initialZoom = 100; // Zoom inicial lejano
const finalZoom = 10; // Zoom final cercano

// Función para iniciar la animación de 24 cuadros del grid
function startGridAnimation24Frames() {
    console.log("Iniciando animación de 24 cuadros");
    
    // Resetear contador
    animationFrame = 0;
    
    // Asegurarse una vez más de que no hay grid
    if (currentGrid) {
        scene.remove(currentGrid);
        currentGrid = null;
    }

    // Posicionar la cámara inicialmente lejos
    camera.position.z = initialZoom;
    camera.updateProjectionMatrix();
    
    // Iniciar intervalo para crear un nuevo grid en cada cuadro
    animationInterval = setInterval(() => {
        // Incrementar contador
        animationFrame++;
        
        // La subdivisión es igual al número de cuadro multiplicado por 2
        const subdivisions = animationFrame * 2;
        
        console.log(`Cuadro ${animationFrame}: Grid con ${subdivisions} subdivisiones`);
        
        // Remover grid anterior si existe
        if (currentGrid) {
            scene.remove(currentGrid);
        }
        
        // Crear nuevo grid con las subdivisiones actuales
        currentGrid = createGridSimple(subdivisions);
        scene.add(currentGrid);

        // Calcular progreso de la animación (0 a 1)
        const progress = animationFrame / totalFrames;
        
        // Aplicar easing para suavizar el movimiento
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        
        // Interpolar la posición Z de la cámara
        camera.position.z = initialZoom - (initialZoom - finalZoom) * easedProgress;
        camera.updateProjectionMatrix();
        
        // Ajustar el tamaño del grid según el zoom
        adjustCameraToGrid();
        
        // Si llegamos al último cuadro, detener animación
        if (animationFrame >= totalFrames) {
            clearInterval(animationInterval);
            console.log("Animación de 24 cuadros completada - Se mantiene en 48 subdivisiones");
            
            // Establecer a 48 como nivel final después de la animación
            currentDivisions = 48;
            
            // Asegurar posición final correcta
            camera.position.z = finalZoom;
            adjustCameraToGrid();
            
            // Guardar configuración de cámara inicial
            initialCameraState.position = camera.position.clone();
            initialCameraState.zoom = camera.zoom;
            initialCameraState.distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
            
            // Actualizar estado
            isFirstGridCreation = false;

            // Cargar el bioKeyb y luego la configuración guardada
            setTimeout(async () => {
                await loadBioKeyb(true); // Cargar teclado sin guardar configuración
                bioKeybVisible = true; // Asegurar que el teclado esté marcado como visible
                loadConfiguration();
            }, 100);
        }
    }, 50); // 50ms por cuadro = 1.2 segundos total
}

// Función simplificada para crear un grid con N subdivisiones
function createGridSimple(divisions, color = 0x888888, visible = true) {
    const group = new THREE.Group();
    group.visible = visible;

    // Materiales
    const lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        opacity: visible ? 1.0 : 0,
        transparent: true
    });
    
    const centerLineMaterial = new THREE.LineBasicMaterial({
        color: color,
        opacity: visible ? 1.0 : 0,
        transparent: true
    });
    
    const borderMaterial = new THREE.LineBasicMaterial({
        color: color,
        opacity: visible ? 1.0 : 0,
        transparent: true,
        linewidth: 2
    });
    
    // Calcular dimensiones base
    const { width, height } = calculateGridSize();
    const minDimension = Math.min(width, height);
    
    // Asegurar que el número de divisiones sea par
    divisions = Math.max(2, Math.floor(divisions / 2) * 2);
    
    // Calcular tamaño de celda basado en la dimensión más pequeña
    const cellSize = minDimension / divisions;
    
    // Calcular número de celdas necesarias para cubrir el área
    const cellsX = Math.ceil(width / cellSize);
    const cellsY = Math.ceil(height / cellSize);
    
    // Asegurar que el número de celdas sea par
    const adjustedCellsX = Math.ceil(cellsX / 2) * 2;
    const adjustedCellsY = Math.ceil(cellsY / 2) * 2;
    
    // Calcular dimensiones totales ajustadas
    const adjustedWidth = adjustedCellsX * cellSize;
    const adjustedHeight = adjustedCellsY * cellSize;
    
    // Calcular mitades exactas
    const halfWidth = adjustedWidth / 2;
    const halfHeight = adjustedHeight / 2;
    
    // Crear grupos
    const linesGroup = new THREE.Group();
    const borderGroup = new THREE.Group();
    
    // Índices de las líneas centrales
    const centerXIndex = adjustedCellsX / 2;
    const centerYIndex = adjustedCellsY / 2;
    
    // Añadir líneas verticales
    for (let i = 0; i <= adjustedCellsX; i++) {
        const x = -halfWidth + i * cellSize;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -halfHeight, 0),
            new THREE.Vector3(x, halfHeight, 0)
        ]);
        
        // Si es la línea central
        if (i === centerXIndex) {
            const centerLine1 = new THREE.Line(geometry, centerLineMaterial);
            const centerLine2 = new THREE.Line(geometry, centerLineMaterial);
            // Desplazar ligeramente la segunda línea
            centerLine2.position.z = 0.001;
            linesGroup.add(centerLine1);
            linesGroup.add(centerLine2);
        } else {
            const line = new THREE.Line(geometry, lineMaterial.clone());
            linesGroup.add(line);
        }
    }
    
    // Añadir líneas horizontales
    for (let i = 0; i <= adjustedCellsY; i++) {
        const y = -halfHeight + i * cellSize;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfWidth, y, 0),
            new THREE.Vector3(halfWidth, y, 0)
        ]);
        
        // Si es la línea central
        if (i === centerYIndex) {
            const centerLine1 = new THREE.Line(geometry, centerLineMaterial);
            const centerLine2 = new THREE.Line(geometry, centerLineMaterial);
            // Desplazar ligeramente la segunda línea
            centerLine2.position.z = 0.001;
            linesGroup.add(centerLine1);
            linesGroup.add(centerLine2);
        } else {
            const line = new THREE.Line(geometry, lineMaterial.clone());
            linesGroup.add(line);
        }
    }
    
    // Añadir borde
    const bevelSize = cellSize * 0.5;
    const borderGeometry = new THREE.BufferGeometry().setFromPoints([
        // Lado izquierdo
        new THREE.Vector3(-halfWidth, -halfHeight + bevelSize, 0),
        new THREE.Vector3(-halfWidth, halfHeight - bevelSize, 0),
        // Esquina superior izquierda
        new THREE.Vector3(-halfWidth + bevelSize, halfHeight, 0),
        // Lado superior
        new THREE.Vector3(halfWidth - bevelSize, halfHeight, 0),
        // Esquina superior derecha
        new THREE.Vector3(halfWidth, halfHeight - bevelSize, 0),
        // Lado derecho
        new THREE.Vector3(halfWidth, -halfHeight + bevelSize, 0),
        // Esquina inferior derecha (bisel)
        new THREE.Vector3(halfWidth - bevelSize, -halfHeight, 0),
        // Lado inferior
        new THREE.Vector3(-halfWidth + bevelSize, -halfHeight, 0),
        // Cerrar el bucle
        new THREE.Vector3(-halfWidth, -halfHeight + bevelSize, 0)
    ]);
    
    const borderLine = new THREE.Line(borderGeometry, borderMaterial.clone());
    borderGroup.add(borderLine);
    
    // Añadir segunda línea para simular grosor
    const borderLine2 = borderLine.clone();
    borderLine2.scale.set(1.03, 1.03, 1.03);
    borderGroup.add(borderLine2);
    
    // Añadir grupos al principal
    group.add(linesGroup);
    group.add(borderGroup);
    
    // Guardar metadatos
    group.userData = {
        linesGroup,
        borderGroup,
        borderLines: [borderLine, borderLine2],
        cellSize,
        halfWidth,
        halfHeight,
        cellsX: adjustedCellsX,
        cellsY: adjustedCellsY
    };
    
    // Si es la primera creación del grid, forzar un ajuste inmediato
    if (isFirstGridCreation) {
        // Forzar un ajuste inmediato de la cámara
        adjustCameraToGrid();
        
        // Asegurar que la cámara esté en la posición correcta
        camera.position.z = 10;
        camera.updateProjectionMatrix();
        
        console.log("Ajuste inicial del grid realizado");
    }
    
    return group;
}

// Configuración de la escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Negro

// Variables para recordar la configuración inicial de la cámara
const initialCameraState = {
    position: null,
    zoom: null,
    distance: null
};

// Contador global para número de orden de los paneles
let panelOrderCounter = 1;

// Configuración de la cámara ortográfica
const camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    0.1,
    1000
);

camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// Función para ajustar la cámara al tamaño del grid
function adjustCameraToGrid() {
    if (!currentGrid) return;
    
    const gridSize = calculateGridSize();
    const aspect = window.innerWidth / window.innerHeight;
    
    // Ajustar el frustum de la cámara para que coincida exactamente con el viewport
    if (aspect > 1) {
        // Pantalla más ancha que alta
        camera.left = -gridSize.width / 2;
        camera.right = gridSize.width / 2;
        camera.top = (gridSize.width / aspect) / 2;
        camera.bottom = -(gridSize.width / aspect) / 2;
    } else {
        // Pantalla más alta que ancha
        camera.left = -gridSize.height * aspect / 2;
        camera.right = gridSize.height * aspect / 2;
        camera.top = gridSize.height / 2;
        camera.bottom = -gridSize.height / 2;
    }
    
    camera.near = 0.1;
    camera.far = 1000;
    
    // Ya no necesitamos ajustar position.z aquí, se maneja en la animación
    camera.updateProjectionMatrix();
}

// Configuración del renderizador
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// Inicializar efectos bioFX
initBioFX(renderer, scene, camera);

// Configuración del panel bioFX
const bioFXPanel = document.getElementById('bioFX-panel');
const colorPicker = document.getElementById('bioFX-color');
const blendTypePicker = document.getElementById('bioFX-blend-type');
const intensitySlider = document.getElementById('bioFX-intensity');
const intensityValue = document.getElementById('bioFX-intensity-value');
const glowSlider = document.getElementById('bioFX-glow');
const glowValue = document.getElementById('bioFX-glow-value');
const glowRadiusSlider = document.getElementById('bioFX-glow-radius');
const glowRadiusValue = document.getElementById('bioFX-glow-radius-value');
const glowThresholdSlider = document.getElementById('bioFX-glow-threshold');
const glowThresholdValue = document.getElementById('bioFX-glow-threshold-value');

// Función para actualizar el efecto
function updateBioFXEffect() {
    const color = parseInt(colorPicker.value.substring(1), 16);
    const blendType = parseInt(blendTypePicker.value);
    const intensity = parseFloat(intensitySlider.value);
    const glowIntensity = parseFloat(glowSlider.value);
    const glowRadius = parseFloat(glowRadiusSlider.value);
    const glowThreshold = parseFloat(glowThresholdSlider.value);
    
    setColorEffect(color, intensity, blendType);
    setBloomEffect(glowIntensity, glowRadius, glowThreshold);
    
    // Actualizar displays de valores
    intensityValue.textContent = intensity.toFixed(2);
    glowValue.textContent = glowIntensity.toFixed(2);
    glowRadiusValue.textContent = glowRadius.toFixed(2);
    glowThresholdValue.textContent = glowThreshold.toFixed(2);
}

// Event listeners para los controles
colorPicker.addEventListener('input', updateBioFXEffect);
blendTypePicker.addEventListener('change', updateBioFXEffect);
intensitySlider.addEventListener('input', updateBioFXEffect);
glowSlider.addEventListener('input', updateBioFXEffect);
glowRadiusSlider.addEventListener('input', updateBioFXEffect);
glowThresholdSlider.addEventListener('input', updateBioFXEffect);

// Función para ocultar todos los menús
function hideAllMenus() {
    const menus = [
        document.getElementById('controls'),
        document.getElementById('terminal-console'),
        bioFXPanel,
        document.getElementById('slots-panel') // Añadir el panel de slots
    ];
    menus.forEach(menu => {
        if (menu) menu.style.display = 'none';
    });
}

// Mostrar/ocultar paneles con la tecla V
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'v') {
        toggleControlPanels();
    }
});

// Ocultar paneles inicialmente
toggleControlPanels(false);

// Aplicar efecto inicial con los valores por defecto
colorPicker.value = '#0096ff'; // R0 G150 B255
blendTypePicker.value = '1';   // Multiply
intensitySlider.value = '1.0'; // 100%
glowSlider.value = '0.71';     // Glow intensity
glowRadiusSlider.value = '0.63'; // Glow radius
glowThresholdSlider.value = '0.1'; // Glow threshold
updateBioFXEffect();

// Variables globales para el grid
let currentGrid = null;
let currentDivisions = 1; // Estado natural: 1 subdivisión
const margin = 0.05;

// Variables para selección
const raycaster = new THREE.Raycaster();
// Configurar raycaster con mayor precisión
raycaster.params.Line.threshold = 0.02; // Umbral más preciso para líneas
raycaster.params.Points.threshold = 0.01; // Umbral más preciso para puntos
const mouse = new THREE.Vector2();
let isSelecting = false;
let startPoint = { x: 0, y: 0 };
let endPoint = { x: 0, y: 0 };
const selectionBox = document.getElementById('selection-box');
let panels = []; // Almacenar objetos de panel: { mesh, minCellIndex, maxCellIndex, selected, hovered }

// Materiales para los paneles (Mesh - ahora obsoletos, los dejamos por si acaso)
/* ... MeshMaterials ... */

// NUEVO: Materiales de LÍNEA para los paneles (Escala de Grises)
const panelLineMaterialNormal = new THREE.LineBasicMaterial({ 
    color: 0xaaaaaa, // Gris medio
    linewidth: 1, // Nota: linewidth no funciona en WebGL
    transparent: false // Los bordes no son transparentes
});
const panelLineMaterialHover = new THREE.LineBasicMaterial({ 
    color: 0xcccccc, // Gris claro
    linewidth: 1,
    transparent: false
});
const panelLineMaterialSelected = new THREE.LineBasicMaterial({ 
    color: 0xffffff, // Blanco
    linewidth: 2, // Más grueso al seleccionar
    transparent: false
});

// NUEVO: Materiales de RELLENO para los paneles (Escala de Grises con transparencia)
const panelFillMaterialNormal = new THREE.MeshBasicMaterial({ 
    color: 0xaaaaaa, // Gris medio
    transparent: true, 
    opacity: 0.25, // 10% opacidad
    side: THREE.DoubleSide,
    depthTest: false, // Desactivar depth testing
    depthWrite: false // No escribir en el buffer de profundidad
});
const panelFillMaterialHover = new THREE.MeshBasicMaterial({ 
    color: 0xcccccc, // Gris claro
    transparent: true, 
    opacity: 0.3, // Ligeramente más visible en hover
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
});
const panelFillMaterialSelected = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, // Blanco
    transparent: true, 
    opacity: .35, // Más visible cuando está seleccionado
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
});

let pendingBoundingBox = null; // Para almacenar el bbox al cambiar resolución
let currentlyHoveredPanel = null;

// Variables para la animación del grid
let gridAnimationInProgress = false;
let gridAnimationStep = 0;
let gridAnimationProgress = 0;
let gridFlashCount = 0;
let isFirstGridCreation = true; // Nueva variable para detectar primera creación
let gridAnimationProps = {
    targetScale: 1,
    borderOpacity: 1,
    linesOpacity: 0,
    flashIntensity: 0
};

// Variables para la animación de paneles
const panelsFlashing = new Set(); // Conjunto de paneles actualmente en animación flash
const panelsResizing = new Set(); // Conjunto de paneles en animación de cambio de forma
let doubleFlashPending = new Map(); // Map para controlar el doble flash

// Función para iniciar un doble flash en un panel
function startDoubleFlash(panelData) {
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    doubleFlashPending.set(panelData, 1); // Indica que queda 1 flash adicional después del primero
    panelsFlashing.add(panelData);
}

// Función para manejar doble click/tap en un panel
function handlePanelDoubleClick(panelData) {
    if (panelData) {
        // Si el panel está vacío y bioKeyb está visible, iniciar modo texto
        const isPanelTrulyEmpty = !panelData.hasText && 
                                 !panelData.modelData && 
                                 !panelData.genomData && 
                                 !panelData.codonData;
        
        if (isPanelTrulyEmpty && bioKeybVisible) {
            console.log(`Doble click en panel vacío #${panelData.orderNumber} con bioKeyb visible. Iniciando modo texto.`);
            const currentGridParams = getCurrentGridParams();
            if (currentGridParams && currentGridParams.cellSize) {
                panelData.hasText = true; 
                createPanelText(panelData, currentGridParams.cellSize); 
                startTextEditing(panelData, currentGridParams.cellSize); 
            }
        } else {
            // Si no es un panel vacío o bioKeyb no está visible, hacer doble flash
            startDoubleFlash(panelData);
        }
    }
}

// Variables para drag & drop de paneles
let isDraggingPanel = false;
let draggedPanel = null;
let dragStartPosition = { x: 0, y: 0 };
let dragStartPanelPosition = { x: 0, y: 0 };
let dragStartCellIndices = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
const dragSensitivity = 0.8; // Reducido para mayor precisión (era 3.0)
let dragSnapToGrid = true; // Nueva variable para activar/desactivar el ajuste a la cuadrícula
let dragStartTimer = null; // Temporizador para retrasar el inicio del arrastre
const dragStartDelay = 500; // 0.5 segundos de retraso para iniciar arrastre
let potentialDragPanel = null; // Panel potencial para arrastrar (durante el retraso)

// Variable para controlar la visibilidad de los controles
let controlsVisible = true;

// Variable para controlar la visibilidad de la consola terminal
let terminalVisible = false;

// Variables para almacenar estados de pantalla
let savedScreenStates = new Array(10).fill(null); // 10 slots para estados (0-9)
let lastSavedStateIndex = -1; // Último estado guardado

// NUEVAS variables y funciones para el sistema de SLOTS (Ctrl+Shift+Num y Ctrl+Num)
const MAX_SLOTS = 10;
let slots; // Declarar la variable de slots. Será inicializada por loadSlotsFromLocalStorage.

// Función para guardar el array de slots completo en localStorage
function persistSlotsToLocalStorage() {
    try {
        console.log('Intentando persistir slots. Contenido actual de slots antes de stringify:', slots);
        const slotsJSON = JSON.stringify(slots);
        console.log('Slots convertidos a JSON para localStorage:', slotsJSON);
        localStorage.setItem('bioPrint_slots_data', slotsJSON);
        console.log('Slots persistidos en localStorage.');
    } catch (error) {
        console.error('Error al persistir slots en localStorage:', error);
        // Considerar informar al usuario si el guardado falla (ej. localStorage lleno)
    }
}

// Función para cargar el array de slots desde localStorage al iniciar
function loadSlotsFromLocalStorage() {
    const storedSlotsData = localStorage.getItem('bioPrint_slots_data');
    console.log('Datos crudos de slots leídos desde localStorage al iniciar:', storedSlotsData);
    if (storedSlotsData) {
        try {
            const parsedSlots = JSON.parse(storedSlotsData);
            // Validar que lo cargado es un array y tiene la longitud esperada
            if (Array.isArray(parsedSlots) && parsedSlots.length === MAX_SLOTS) {
                slots = parsedSlots;
                console.log(`Slots cargados desde localStorage (${slots.filter(s => s !== null).length} slots con datos).`);
            } else {
                console.warn('Los datos de slots en localStorage son inválidos o tienen una longitud incorrecta. Se usarán slots vacíos por defecto.');
                slots = new Array(MAX_SLOTS).fill(null);
            }
        } catch (error) {
            console.error('Error al parsear slots desde localStorage. Se usarán slots vacíos por defecto:', error);
            slots = new Array(MAX_SLOTS).fill(null);
        }
    } else {
        // No hay datos guardados, inicializar con slots vacíos
        console.log('No se encontraron slots persistidos en localStorage. Inicializando slots vacíos.');
        slots = new Array(MAX_SLOTS).fill(null);
    }
}

// Cargar slots persistentes al iniciar la aplicación
loadSlotsFromLocalStorage();

// Función para guardar el estado en un slot (Ctrl+Shift+Numero)
async function saveToSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido.`);
        return;
    }
    const config = getSerializableConfig();
    if (!config) {
        console.error('Error Crítico: getSerializableConfig() devolvió null. No se guardará nada en el slot.');
        const slotEntry = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
        if (slotEntry) {
            slotEntry.textContent = 'Error al Guardar';
            slotEntry.title = 'No se pudieron obtener los datos de la escena para guardar.';
        }
        return;
    }
    
    console.log(`Intentando guardar en Slot ${slotIndex}. Configuración obtenida:`, JSON.parse(JSON.stringify(config)));

    slots[slotIndex] = JSON.stringify(config); 
    
    persistSlotsToLocalStorage(); 

    // Flash de confirmación visual
    gridAnimationInProgress = true;
    gridAnimationStep = 2; 
    gridAnimationProgress = 0;
    gridFlashCount = 0;

    updateSlotsPanelUI(); // Actualizar la UI después de todas las operaciones
}

// Función para cargar el estado desde un slot (Ctrl+Numero)
async function loadFromSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido.`);
        return;
    }
    const slotDataString = slots[slotIndex];
    if (!slotDataString) {
        console.warn(`Slot ${slotIndex} está vacío.`);
        // Podríamos añadir una indicación visual en el panel de slots si se intenta cargar uno vacío.
        const slotEntry = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
        if (slotEntry) {
            const originalText = slotEntry.textContent;
            slotEntry.textContent = 'Vacío (No se puede cargar)';
            slotEntry.style.color = '#ff8800'; // Naranja para advertencia
            setTimeout(() => {
                slotEntry.textContent = originalText;
                slotEntry.style.color = ''; // Restaurar color original
                 updateSlotsPanelUI(); // Re-actualizar para asegurar estado correcto
            }, 2000);
        }
        return;
    }
    try {
        const config = JSON.parse(slotDataString);
        console.log(`Cargando configuración desde Slot ${slotIndex}:`, JSON.parse(JSON.stringify(config)));
        
        // Limpiar la escena y aplicar la nueva configuración
        // La función applyConfigurationFromData se encargará de limpiar paneles, etc.
        const success = await applyConfigurationFromData(config); 

        if (success) {
            console.log(`Ctrl+${slotIndex}: Estado cargado y aplicado desde Slot ${slotIndex}.`);
            // Flash de confirmación visual
            gridAnimationInProgress = true;
            gridAnimationStep = 2; // Solo paso de flash
            gridAnimationProgress = 0;
            gridFlashCount = 0;
            updateSlotsPanelUI(); // Asegurar que la UI refleje el estado cargado (por si hay fechas, etc)
        } else {
            console.error(`Error al aplicar la configuración del Slot ${slotIndex}.`);
            // Considerar mostrar un error en la UI del slot
             const slotEntryStatus = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
            if (slotEntryStatus) {
                slotEntryStatus.textContent = 'Error al Aplicar';
                slotEntryStatus.title = 'Hubo un problema al aplicar los datos de este slot.';
            }
        }

    } catch (error) {
        console.error(`Error al cargar datos del Slot ${slotIndex}:`, error);
        // Considerar mostrar un error en la UI del slot
        const slotEntryStatus = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
        if (slotEntryStatus) {
            slotEntryStatus.textContent = 'Error de Carga';
            slotEntryStatus.title = `Error: ${error.message}`;
        }
    }
}

// Función para asignar un panel para navegar a un slot (Shift+Numero en panel seleccionado)
function assignPanelToSlotNavigation(panelData, slotIndex) {
    if (!panelData) {
        console.warn('Panel no válido para asignar navegación.');
        return;
    }
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.warn(`Slot ${slotIndex} inválido para navegación.`);
        return;
    }

    panelData.navigateToSlot = slotIndex;
    console.log(`Shift+${slotIndex}: Panel P${panelData.orderNumber} asignado para navegar al Slot ${slotIndex} al hacer click.`);
    // Podrías añadir una indicación visual al panel (ej. un pequeño ícono o cambio de color sutil)
    // Por ahora, solo un log.
    // Efecto flash para confirmar
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelsFlashing.add(panelData);
}

// Función para calcular el tamaño del grid basado en el aspecto del canvas
function calculateGridSize() {
    const aspect = window.innerWidth / window.innerHeight;
    const maxSize = 24; // Duplicado para llenar más la pantalla
    
    if (aspect > 1) {
        // Canvas más ancho que alto
        return {
            width: maxSize * aspect,
            height: maxSize
        };
    } else {
        // Canvas más alto que ancho
        return {
            width: maxSize,
            height: maxSize / aspect
        };
    }
}

// Función para crear el grid con biseles (Escala de Grises)
function createGrid(divisions, color = 0x888888, animate = true) { 
    // Si hay una animación en progreso, cancelarla
    gridAnimationInProgress = false;
    
    const group = new THREE.Group();
    
    // Si es la primera vez, usar opacity 0 para todo
    const initialOpacity = (animate && isFirstGridCreation) ? 0 : 1;
    
    const material = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: initialOpacity
    });
    
    const borderMaterial = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: initialOpacity,
        linewidth: 2 
    });
    
    const { width, height } = calculateGridSize();
    
    // Calcular el tamaño de celda basado en la dimensión más pequeña
    const minDimension = Math.min(width, height);
    const cellSize = minDimension / divisions;
    
    // Calcular el número de celdas en cada dirección
    const cellsX = Math.ceil(width / cellSize);
    const cellsY = Math.ceil(height / cellSize);
    
    // Ajustar el tamaño total para que sea múltiplo del tamaño de celda
    const adjustedWidth = cellsX * cellSize;
    const adjustedHeight = cellsY * cellSize;
    
    const halfWidth = adjustedWidth / 2;
    const halfHeight = adjustedHeight / 2;
    
    // Tamaño del bisel (mitad del tamaño de la celda)
    const bevelSize = cellSize * 0.5;
    
    // Grupo para las líneas internas (separado para animar)
    const linesGroup = new THREE.Group();
    group.add(linesGroup);
    
    // Crear líneas verticales internas
    for (let i = 1; i < cellsX; i++) {
        const x = -halfWidth + (i * cellSize);
        
        const points = [];
        points.push(new THREE.Vector3(x, -halfHeight, 0));
        points.push(new THREE.Vector3(x, halfHeight, 0));
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material.clone());
        linesGroup.add(line);
    }
    
    // Crear líneas horizontales internas
    for (let i = 1; i < cellsY; i++) {
        const y = -halfHeight + (i * cellSize);
        
        const points = [];
        points.push(new THREE.Vector3(-halfWidth, y, 0));
        points.push(new THREE.Vector3(halfWidth, y, 0));
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material.clone());
        linesGroup.add(line);
    }
    
    // Grupo para el borde (separado para animar)
    const borderGroup = new THREE.Group();
    group.add(borderGroup);
    
    // Crear borde grueso
    const borderPoints = [];
    
    // Lado izquierdo
    borderPoints.push(new THREE.Vector3(-halfWidth, -halfHeight + bevelSize, 0));
    borderPoints.push(new THREE.Vector3(-halfWidth, halfHeight - bevelSize, 0));
    
    // Esquina superior izquierda (bisel)
    borderPoints.push(new THREE.Vector3(-halfWidth + bevelSize, halfHeight, 0));
    
    // Lado superior
    borderPoints.push(new THREE.Vector3(halfWidth - bevelSize, halfHeight, 0));
    
    // Esquina superior derecha (bisel)
    borderPoints.push(new THREE.Vector3(halfWidth, halfHeight - bevelSize, 0));
    
    // Lado derecho
    borderPoints.push(new THREE.Vector3(halfWidth, -halfHeight + bevelSize, 0));
    
    // Esquina inferior derecha (bisel)
    borderPoints.push(new THREE.Vector3(halfWidth - bevelSize, -halfHeight, 0));
    
    // Lado inferior
    borderPoints.push(new THREE.Vector3(-halfWidth + bevelSize, -halfHeight, 0));
    
    // Esquina inferior izquierda (bisel)
    borderPoints.push(new THREE.Vector3(-halfWidth, -halfHeight + bevelSize, 0));
    
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderLine = new THREE.Line(borderGeometry, borderMaterial.clone());
    
    // Crear una segunda línea para el borde para simular grosor
    const borderLine2 = borderLine.clone();
    borderLine2.scale.set(1.03, 1.03, 1.03);
    borderGroup.add(borderLine);
    borderGroup.add(borderLine2);
    
    // Guardar referencias para la animación
    group.userData = {
        borderGroup,
        linesGroup,
        borderLines: [borderLine, borderLine2]
    };
    
    // Agregar animación solo si es primera vez o se solicita explícitamente
    if (animate && isFirstGridCreation) {
        // Iniciar con escala pequeña para animación y opacidad 0
        group.scale.set(0.01, 0.01, 0.01);
        
        // Asegurar que todas las líneas son invisibles inicialmente
        linesGroup.children.forEach(line => {
            line.material.opacity = 0;
        });
        
        borderGroup.children.forEach(line => {
            line.material.opacity = 0;
        });
        
        // Configurar animación
        gridAnimationInProgress = true;
        gridAnimationStep = 0; // Comenzar desde el paso 0 (crecimiento)
        gridAnimationProgress = 0;
        gridFlashCount = 0;
        
        // Propiedades de animación
        gridAnimationProps = {
            targetScale: 1,
            borderOpacity: 1,
            linesOpacity: 1,
            flashIntensity: 0.3
        };
        
        console.log("Animación del grid configurada, isFirstGridCreation:", isFirstGridCreation);
    } else {
        // Sin animación, establecer valores finales
        group.scale.set(1, 1, 1);
        
        // Actualizar opacidad de líneas y bordes a 1
        linesGroup.children.forEach(line => {
            line.material.opacity = 1;
        });
        
        borderGroup.children.forEach(line => {
            line.material.opacity = 1;
        });
    }
    
    // No establecer isFirstGridCreation en false aquí
    // Solo lo haremos después de completar la animación
    
    return group;
}

// Crear el grid principal
// NO crear el grid aquí - se creará después del splash screen
// currentGrid = createGrid(currentDivisions);
// scene.add(currentGrid);
// Marcar que ya pasó la primera creación después de crear el grid inicial
// isFirstGridCreation = false;

// Guardar configuración inicial de la cámara (después de crear todo)
initialCameraState.position = camera.position.clone();
initialCameraState.zoom = camera.zoom;
initialCameraState.distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));

// Controles de órbita
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = true;

// Desactivar completamente los controles táctiles
controls.enableTouchMovement = false;
controls.touches = {
    ONE: null,
    TWO: null
}

// Configuración adicional para prevenir gestos táctiles
controls.enablePan = false; // Desactivar pan por defecto
controls.enableRotate = false; // Desactivar rotación por defecto
controls.enableZoom = false; // Desactivar zoom por defecto

// Configurar límites de rotación para mantener la vista usable
const MAX_ANGLE = 12 * (Math.PI / 180); // 12 grados en radianes (era 16)
controls.minPolarAngle = Math.PI / 2 - MAX_ANGLE; // Limitar rotación vertical
controls.maxPolarAngle = Math.PI / 2 + MAX_ANGLE;
controls.minAzimuthAngle = -MAX_ANGLE; // Limitar rotación horizontal
controls.maxAzimuthAngle = MAX_ANGLE;

// Variables para el retorno automático
let isOrbiting = false;
let orbitReturnTimeout = null;
let returnAnimationStartTime = null;
const RETURN_DELAY = 2000; // 2 segundos
const RETURN_DURATION = 1000; // 1 segundo de animación

// Manejar eventos de teclado para controles
let isCtrlPressed = false;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Control') {
        isCtrlPressed = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        renderer.domElement.style.cursor = 'move';
    }
    // Cambiado de 'else if' a 'if' para intentar resolver el problema del linter
    if (event.key === 'F11') { 
        event.preventDefault();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                 document.exitFullscreen();
            }
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Control') {
        isCtrlPressed = false;
        controls.enableRotate = false;
        controls.enableZoom = false;
        renderer.domElement.style.cursor = 'auto';
        startOrbitReturn();
    }
});

// Manejar eventos del mouse para controles
renderer.domElement.addEventListener('mousedown', (event) => {
    if (isCtrlPressed) {
        event.preventDefault();
        controls.enabled = true;
        controls.enableRotate = true;
        renderer.domElement.style.cursor = 'move';
        isOrbiting = true;
        
        // Cancelar cualquier retorno automático en progreso
        if (orbitReturnTimeout) {
            clearTimeout(orbitReturnTimeout);
            orbitReturnTimeout = null;
        }
        returnAnimationStartTime = null;
    }
});

renderer.domElement.addEventListener('mouseup', () => {
    if (isOrbiting) {
        isOrbiting = false;
        startOrbitReturn();
    }
    if (!isCtrlPressed) {
        controls.enabled = false;
        controls.enableRotate = false;
        renderer.domElement.style.cursor = 'auto';
    }
});

// Función para iniciar el retorno automático
function startOrbitReturn() {
    // Cancelar cualquier retorno existente
    if (orbitReturnTimeout) {
        clearTimeout(orbitReturnTimeout);
    }
    
    // Iniciar nuevo retorno después del delay
    orbitReturnTimeout = setTimeout(() => {
        returnAnimationStartTime = performance.now();
        // Guardar posiciones iniciales para la animación
        const startRotation = {
            polar: controls.getPolarAngle(),
            azimuth: controls.getAzimuthalAngle()
        };
        
        // Función de animación de retorno
        function animateReturn() {
            const currentTime = performance.now();
            const elapsed = currentTime - returnAnimationStartTime;
            const progress = Math.min(elapsed / RETURN_DURATION, 1);
            
            // Función de easing para suavizar el movimiento
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            
            // Interpolar ángulos hacia la posición neutral
            const targetPolar = Math.PI / 2; // Vista frontal
            const targetAzimuth = 0; // Centro
            
            // Calcular nuevos ángulos
            const newPolar = startRotation.polar + (targetPolar - startRotation.polar) * easeProgress;
            const newAzimuth = startRotation.azimuth + (targetAzimuth - startRotation.azimuth) * easeProgress;
            
            // Actualizar la rotación de la cámara directamente
            camera.position.x = controls.target.x + controls.getDistance() * Math.sin(newPolar) * Math.sin(newAzimuth);
            camera.position.z = controls.target.z + controls.getDistance() * Math.sin(newPolar) * Math.cos(newAzimuth);
            camera.position.y = controls.target.y + controls.getDistance() * Math.cos(newPolar);
            
            camera.lookAt(controls.target);
            
            // Continuar animación si no ha terminado
            if (progress < 1) {
                requestAnimationFrame(animateReturn);
            }
        }
        
        // Iniciar animación
        animateReturn();
        
    }, RETURN_DELAY);
}

renderer.domElement.addEventListener('mousemove', (event) => {
    if (isCtrlPressed && event.buttons === 1) { // 1 = botón izquierdo presionado
        event.preventDefault();
        controls.enabled = true;
        controls.enableRotate = true;
        renderer.domElement.style.cursor = 'move';
    }
});

// Variables para touch drag
let isTouchSelecting = false;
let touchStartPoint = { x: 0, y: 0 };
let touchEndPoint = { x: 0, y: 0 };

// Variables para detectar doble tap
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300; // milisegundos entre taps para considerarlo doble tap

renderer.domElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
    const currentTime = Date.now();
    
    // Limpiar inmediatamente cualquier estado de hover
    if (currentlyHoveredPanel) {
        currentlyHoveredPanel.hovered = false;
        updatePanelColor(currentlyHoveredPanel);
        currentlyHoveredPanel = null;
    }

    // Registrar tiempo de inicio para cada toque
    Array.from(event.touches).forEach(touch => {
        touchStartTimes.set(touch.identifier, currentTime);
    });
    
    // Detectar doble tap
    const timeSinceLastTap = currentTime - lastTapTime;
    if (timeSinceLastTap < DOUBLE_TAP_DELAY && event.touches.length === 1) {
        // Es un doble tap con un solo dedo
        const touch = event.touches[0];
        const mouseForRaycast = new THREE.Vector2( 
            (touch.clientX / window.innerWidth) * 2 - 1,
            -(touch.clientY / window.innerHeight) * 2 + 1
        );
        
        raycaster.setFromCamera(mouseForRaycast, camera);
        
        const allSelectable = [];
        const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
        const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
        allSelectable.push(...allFillMeshes, ...allBorderLines);
        
        const intersects = raycaster.intersectObjects(allSelectable, false);
        
        if (intersects.length > 0) {
            let panelData = null;
            let currentObject = intersects[0].object;
            while (currentObject && !panelData) {
                if (currentObject.userData && currentObject.userData.panelDataRef) {
                    panelData = currentObject.userData.panelDataRef;
                    break;
                }
                currentObject = currentObject.parent;
            }
            
            if (panelData) {
                handlePanelDoubleClick(panelData);
            }
        }
        lastTapTime = 0; // Resetear para evitar triple tap
        return;
    } else if (event.touches.length === 1) { // Es un solo tap, NO un doble tap
        lastTapTime = currentTime;
        // ... (resto de la lógica de single tap: iniciar selección de área o drag de panel)
    }
    // ... (resto del código de touchstart para múltiples toques o interacciones con controles de UI)
    
    // Resto del código existente para touchstart...
    touchStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
    
    // Verificar si el toque está sobre un panel existente
    const mouse = new THREE.Vector2(
        (touchStartPosition.x / window.innerWidth) * 2 - 1,
        -(touchStartPosition.y / window.innerHeight) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, camera);
    
    // Recopilar todos los objetos seleccionables
    const allSelectable = [];
    const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
    const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
    allSelectable.push(...allFillMeshes, ...allBorderLines);
    
    const intersects = raycaster.intersectObjects(allSelectable, false);
    
    if (intersects.length === 0 && !event.touches[1]) {
        // Si no hay intersección con paneles existentes, iniciar selección
        isTouchSelecting = true;
        touchStartPoint = { ...touchStartPosition };
        touchEndPoint = { ...touchStartPosition };
        
        // Mostrar caja de selección
        selectionBox.style.left = `${touchStartPoint.x}px`;
        selectionBox.style.top = `${touchStartPoint.y}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    } else {
        // Si hay intersección, ocultar caja de selección
        isTouchSelecting = false;
        selectionBox.style.display = 'none';
    }
    
    // Simular mousedown para la interacción con paneles existentes
    const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: touchStartPosition.x,
        clientY: touchStartPosition.y,
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
    });
    event.target.dispatchEvent(mouseDownEvent);
}, { passive: false });

renderer.domElement.addEventListener('touchmove', (event) => {
    event.preventDefault();
    
    // Asegurar que no hay efecto hover durante el movimiento táctil
    if (currentlyHoveredPanel) {
        currentlyHoveredPanel.hovered = false;
        updatePanelColor(currentlyHoveredPanel);
        currentlyHoveredPanel = null;
    }
    
    if (event.touches.length > 1) {
        return false;
    }
    
    const currentPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
    
    // Actualizar selección solo si estamos en modo selección
    if (isTouchSelecting) {
        touchEndPoint = currentPosition;
        
        // Actualizar caja de selección visual
        const width = Math.abs(touchEndPoint.x - touchStartPoint.x);
        const height = Math.abs(touchEndPoint.y - touchStartPoint.y);
        const left = Math.min(touchStartPoint.x, touchEndPoint.x);
        const top = Math.min(touchStartPoint.y, touchEndPoint.y);
        
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
    }
    
    // Calcular distancia para determinar si es drag o click
    const deltaX = currentPosition.x - touchStartPosition.x;
    const deltaY = currentPosition.y - touchStartPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Simular mousemove para interacción con paneles existentes
    if (distance > 0) {
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: currentPosition.x,
            clientY: currentPosition.y,
            bubbles: true,
            cancelable: true,
            view: window
        });
        event.target.dispatchEvent(mouseMoveEvent);
    }
    
    // Cancelar el click si el movimiento es muy grande
    if (distance > TOUCH_CLICK_THRESHOLD) {
        touchStartTime = 0;
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', (event) => {
    event.preventDefault();
    
    // Limpiar estado de hover al finalizar el toque
    if (currentlyHoveredPanel) {
        currentlyHoveredPanel.hovered = false;
        updatePanelColor(currentlyHoveredPanel);
        currentlyHoveredPanel = null;
    }

    // Limpiar tiempos de inicio para los toques que terminaron
    Array.from(event.changedTouches).forEach(touch => {
        touchStartTimes.delete(touch.identifier);
    });
    
    // Procesar el final de la selección por arrastre solo si estábamos seleccionando
    if (isTouchSelecting) {
        selectionBox.style.display = 'none';
        
        // Obtener puntos 3D de inicio y fin
        const start3D = get3DPointOnGrid({
            clientX: touchStartPoint.x,
            clientY: touchStartPoint.y
        });
        const end3D = get3DPointOnGrid({
            clientX: touchEndPoint.x,
            clientY: touchEndPoint.y
        });
        
        // Calcular la distancia del arrastre
        const dragDistance = Math.sqrt(
            Math.pow(touchEndPoint.x - touchStartPoint.x, 2) +
            Math.pow(touchEndPoint.y - touchStartPoint.y, 2)
        );
        
        if (dragDistance > TOUCH_CLICK_THRESHOLD) {
            // Calcular los límites del área de selección en coordenadas de pantalla
            const left = Math.min(touchStartPoint.x, touchEndPoint.x);
            const right = Math.max(touchStartPoint.x, touchEndPoint.x);
            const top = Math.min(touchStartPoint.y, touchEndPoint.y);
            const bottom = Math.max(touchStartPoint.y, touchEndPoint.y);
            
            // Verificar si hay paneles dentro del área de selección
            let panelsInSelection = false;
            panels.forEach(panel => {
                if (!panel.group) return;
                
                // Convertir la posición del panel a coordenadas de pantalla
                const panelPosition = panel.group.position.clone();
                const screenPosition = panelPosition.project(camera);
                const panelX = (screenPosition.x + 1) * window.innerWidth / 2;
                const panelY = (-screenPosition.y + 1) * window.innerHeight / 2;
                
                // Calcular el tamaño aproximado del panel en pantalla
                const panelSize = panel.group.userData.cellSize * 100; // Ajustar según sea necesario
                const halfSize = panelSize / 2;
                
                // Verificar si el panel está dentro del área de selección
                if (panelX + halfSize > left && panelX - halfSize < right &&
                    panelY + halfSize > top && panelY - halfSize < bottom) {
                    panel.selected = true;
                    updatePanelColor(panel);
                    panelsInSelection = true;
                } else if (!event.shiftKey) {
                    // Deseleccionar si no se presiona Shift
                    panel.selected = false;
                    updatePanelColor(panel);
                }
            });
            
            // Si no hay paneles en la selección, crear uno nuevo
            if (!panelsInSelection && start3D && end3D) {
                createPanelFromSelection(start3D, end3D);
            }
        }
        
        isTouchSelecting = false;
    }
    
    // Procesar click normal si fue un toque rápido
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < TOUCH_CLICK_TIME && touchStartTime !== 0) {
        const mouseUpEvent = new MouseEvent('mouseup', {
            clientX: touchStartPosition.x,
            clientY: touchStartPosition.y,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
        });
        event.target.dispatchEvent(mouseUpEvent);
        
        const clickEvent = new MouseEvent('click', {
            clientX: touchStartPosition.x,
            clientY: touchStartPosition.y,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
        });
        event.target.dispatchEvent(clickEvent);
    }
    
    touchStartTime = 0;
}, { passive: false });

// Agregar un nuevo event listener para touchcancel
renderer.domElement.addEventListener('touchcancel', (event) => {
    event.preventDefault();
    
    // Limpiar estado hover en caso de cancelación del toque
    if (currentlyHoveredPanel) {
        currentlyHoveredPanel.hovered = false;
        updatePanelColor(currentlyHoveredPanel);
        currentlyHoveredPanel = null;
    }
    
    // Limpiar otros estados táctiles
    isTouchSelecting = false;
    selectionBox.style.display = 'none';
}, { passive: false });

// Desactivar gestos del navegador en el canvas y el documento
renderer.domElement.style.touchAction = 'none';
document.body.style.touchAction = 'none';
document.documentElement.style.touchAction = 'none';

// Prevenir el zoom del navegador en dispositivos táctiles
document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

// Prevenir el scroll del navegador en el canvas
renderer.domElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
}, { passive: false });

// Función para actualizar el grid Y los paneles
function updateGrid(newDivisions) {
    // Validar que el valor sea al menos 1 subdivisión
    newDivisions = Math.max(1, newDivisions);
    
    scene.remove(currentGrid);
    currentDivisions = newDivisions;
    
    console.log(`Actualizando grid a ${currentDivisions} subdivisiones`);
    
    // Crear el grid con las subdivisiones solicitadas (siempre visible)
    currentGrid = createGridSimple(currentDivisions, 0x888888, true);
    scene.add(currentGrid);
    
    // Ajustar la cámara al nuevo grid
    adjustCameraToGrid();

    // Actualizar paneles inmediatamente
    updatePanelsAfterGridAnimation();
}

// Función helper para comprobar conflictos al mover un panel
function checkPanelMoveConflict(panelToMove, dx, dy, gridParams) {
    const { cellsX, cellsY } = gridParams;
    const newMinX = panelToMove.minCellIndex.x + dx;
    const newMaxX = panelToMove.maxCellIndex.x + dx;
    const newMinY = panelToMove.minCellIndex.y + dy;
    const newMaxY = panelToMove.maxCellIndex.y + dy;

    // Comprobar límites del grid
    if (newMinX < 0 || newMaxX >= cellsX || newMinY < 0 || newMaxY >= cellsY) {
        //console.log("Move conflict: Out of bounds");
        return true; // Fuera de los límites
    }

    // Comprobar conflictos con otros paneles existentes (excepto él mismo y otros seleccionados que se moverán)
    const otherPanels = panels.filter(p => p !== panelToMove && !p.selected);
    for (const otherPanel of otherPanels) {
        const eMinX = otherPanel.minCellIndex.x;
        const eMaxX = otherPanel.maxCellIndex.x;
        const eMinY = otherPanel.minCellIndex.y;
        const eMaxY = otherPanel.maxCellIndex.y;

        // Comprobar si los nuevos índices (con margen de 1 celda) se solapan con el otro panel
        const conflictX = !(newMaxX < eMinX - 1 || newMinX > eMaxX + 1);
        const conflictY = !(newMaxY < eMinY - 1 || newMinY > eMaxY + 1);

        if (conflictX && conflictY) {
            //console.log("Move conflict: Panel collision");
            return true; // Conflicto con otro panel
        }
    }

    return false; // No hay conflictos
}

// Función para mover un panel
function movePanel(panel, dx, dy, gridParams) {
    if (checkPanelMoveConflict(panel, dx, dy, gridParams)) {
        console.warn("Movimiento cancelado: Conflicto de límites o colisión.");
        return false;
    }

    // Actualizar índices
    panel.minCellIndex.x += dx;
    panel.maxCellIndex.x += dx;
    panel.minCellIndex.y += dy;
    panel.maxCellIndex.y += dy;

    // Actualizar geometría y posición
    updatePanelGeometryAndPosition(panel, gridParams);

    return true;
}

// Función para alternar la visibilidad de todos los controles
function toggleControlsVisibility() {
    controlsVisible = !controlsVisible;
    
    // Alternar visibilidad de #controls (botones principales)
    const controlsElement = document.getElementById('controls');
    if (controlsElement) {
        controlsElement.style.display = controlsVisible ? 'block' : 'none';
    }
    
    // Alternar visibilidad de #ui-controls (botones de estados)
    const uiControlsElement = document.getElementById('ui-controls');
    if (uiControlsElement) {
        uiControlsElement.style.display = controlsVisible ? 'flex' : 'none';
    }
    
    // Actualizar la variable global
    controlsVisible = controlsVisible;
}

// Control de teclado
document.addEventListener('keydown', (event) => {
    const key = event.key;
    const activelyWritingText = keyboardState.isWriting; // Cachear para consistencia en esta ejecución

    // DEBUG: console.log(`Keydown: '${key}', activelyWritingText: ${activelyWritingText}, Ctrl: ${event.ctrlKey}, Shift: ${event.shiftKey}, Target:`, event.target);

    if (activelyWritingText) {
        // Si estamos en modo escritura:
        // 1. panelText.js (a través de preventTerminalInput) ahora maneja Escape para llamar a stopTextEditing
        //    y también llama a event.stopPropagation() para el Escape.
        // 2. Para otras teclas que NO son Escape Y NO tienen modificadores Ctrl/Alt/Meta Y NO son F-keys,
        //    hacemos un return aquí para asegurar que se deleguen al input de texto y no activen atajos globales.
        if (key !== 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey && !key.startsWith("F")) {
            // DEBUG: console.log(`Modo Escritura (main.js): Tecla '${key}' delegada. Atajo global prevenido.`);
        return;
        }
        // Si es Escape, panelText.js lo manejará y detendrá la propagación.
        // Si es una tecla con modificador (ej. Ctrl+C) o una F-key, permitimos que continúe,
        // por si es un atajo del navegador/SO o un atajo global que *queremos* que funcione.
    }

    // Si llegamos aquí, activelyWritingText es false, o fue una tecla con modificador/F-key/Escape en modo texto
    // (y Escape ya fue manejado y detenido por panelText.js si activelyWritingText era true).

    const terminalInputElement = document.getElementById('terminal-input');
    const terminalIsEffectivelyActive = document.activeElement === terminalInputElement && terminalVisible;

    if (terminalIsEffectivelyActive) {
        if (key === 'Escape') {
            toggleTerminal(false); 
            event.preventDefault(); 
            // DEBUG: console.log("Terminal activa: Escape presionado, cerrando terminal.");
            return; 
        }
        // DEBUG: console.log(`Terminal Activa: Tecla '${key}' delegada a la terminal.`);
        return; 
    }
    
    // DEBUG: console.log(`Procesando Atajo Global para Tecla: '${key}' (activelyWritingText: ${activelyWritingText}, terminalIsEffectivelyActive: ${terminalIsEffectivelyActive})`);

    // Atajos Globales
    let newDivisions = currentDivisions;
    let resolutionChanged = false;
    let moveDelta = { dx: 0, dy: 0 };
    let deleteTriggered = false;

    switch (key) {
        case '+':
        case '=':
            newDivisions = Math.min(currentDivisions + 1, 50);
            resolutionChanged = true;
            break;
        case '-':
        case '_':
            newDivisions = Math.max(currentDivisions - 1, 2);
            resolutionChanged = true;
            break;
        case 'ArrowUp':
            moveDelta.dy = 1;
            break;
        case 'ArrowDown':
            moveDelta.dy = -1;
            break;
        case 'ArrowLeft':
            moveDelta.dx = -1;
            break;
        case 'ArrowRight':
            moveDelta.dx = 1;
            break;
        case 'x':
        case 'X':
            deleteTriggered = true;
            break;
        case 'Delete':
            deleteTriggered = true;
            break;
        case 'c':
        case 'C':
            if (event.ctrlKey) { 
                clearAllPanels(true, false);
            }
            return;
        case 'a':
        case 'A':
            centerGridInCamera();
            return;
        case 'v':
        case 'V':
            toggleControlsVisibility();
            return;
        case 't':
        case 'T':
            event.preventDefault(); 
            toggleTerminal(true);
            return;
        case 'k':
        case 'K':
            if (!bioKeybVisible) {
                loadBioKeyb(false).then(() => {
                    console.log("Teclado bioKeyb mostrado con tecla K física.");
                }).catch(error => {
                    console.error("Error al mostrar bioKeyb con tecla K:", error);
                });
            } else {
                clearBioKeybOnly(); 
            }
            return;
        case 'Escape':
            if (isSelecting) { 
                isSelecting = false;
                selectionBox.style.display = 'none';
                controls.enabled = true; 
            } else if (panels.some(p => p.selected)) { 
                panels.forEach(p => {
                    if (p.selected) {
                        p.selected = false;
                        updatePanelColor(p);
                    }
                });
            }
            return;
    }

    // Procesar cambios de resolución, movimiento, borrado
    if (resolutionChanged && newDivisions !== currentDivisions) {
        updateGrid(newDivisions); 
    } else if (moveDelta.dx !== 0 || moveDelta.dy !== 0) {
            const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) {
            console.warn("No se pudo obtener la configuración actual del grid para mover paneles");
            return;
        }
        let somethingMoved = false;
        panels.forEach(panel => {
            if (panel.selected && !panel.isKeyboardKey) {
                movePanel(panel, moveDelta.dx, moveDelta.dy, currentGridParams);
                somethingMoved = true;
            }
        });
        if (somethingMoved) {
            animateResizingPanels();
        }
    } else if (deleteTriggered) {
        const remainingPanels = [];
        let deletedSomething = false;
        panels.forEach(panel => {
            if (panel.selected && !panel.isKeyboardKey) {
                if(panel.group) {
                    scene.remove(panel.group);
                    while(panel.group.children.length > 0){
                         const child = panel.group.children[0]; 
                         panel.group.remove(child);
                         if (child.geometry) child.geometry.dispose();
                         if (child.material) child.material.dispose(); 
                     }
                }
                if (panel === currentlyHoveredPanel) {
                     currentlyHoveredPanel = null; 
                }
                deletedSomething = true;
            } else {
                remainingPanels.push(panel);
            }
        });
        if(deletedSomething) {
            panels = remainingPanels; 
            reindexPanels();
        }
    }

    if (event.key === 'Shift' && isDraggingPanel) {
        dragSnapToGrid = false;
    }
});

document.addEventListener('keyup', (event) => {
    // Reactivar snap to grid al soltar Shift
    if (event.key === 'Shift' && isDraggingPanel) {
        dragSnapToGrid = true;
    }
});

// Función de animación
function animate() {
    requestAnimationFrame(animate);
    
    // Animar grid si está en progreso
    if (gridAnimationInProgress) {
        animateGrid();
    }
    
    // Animar paneles en redimensionamiento
    if (panelsResizing.size > 0) {
        animateResizingPanels();
    }
    
    // Animar paneles en flash si hay alguno
    if (panelsFlashing.size > 0) {
        animateFlashingPanels();
    }

    // Animar modelos 3D
    animateModels();
    
    // Animar redes de proteínas
    animateGenoms();
    
    // Animar modelos de codón
    animateCodons();
    
    controls.update();
    renderBioFX();
}
animate();

// Manejo del redimensionamiento
function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    renderer.setSize(width, height);
    
    // Ajustar la cámara ortográfica al nuevo tamaño
    adjustCameraToGrid();
    
    // Actualizar el grid y adaptar paneles existentes
    updateGrid(currentDivisions);
}

window.addEventListener('resize', handleResize);

// Manejar cambios de pantalla completa
document.addEventListener('fullscreenchange', handleResize);

// Exportar funciones para controlar el grid desde la consola
window.updateGrid = updateGrid;

// Función para obtener la posición 3D en el plano del grid
function get3DPointOnGrid(event) {
    // Calcular coordenadas precisas del mouse
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Configurar raycaster con la cámara y las coordenadas del mouse
    raycaster.setFromCamera(mouse, camera);
    
    // Crear un plano imaginario en z=0 para la intersección
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectionPoint = new THREE.Vector3();
    
    // Calcular intersección con mayor precisión
    const didIntersect = raycaster.ray.intersectPlane(plane, intersectionPoint);
    
    // Aplicar redondeo controlado para evitar imprecisiones por punto flotante
    if (didIntersect) {
        // Mantener 4 decimales de precisión
        intersectionPoint.x = Math.round(intersectionPoint.x * 10000) / 10000;
        intersectionPoint.y = Math.round(intersectionPoint.y * 10000) / 10000;
        intersectionPoint.z = 0; // Asegurar que Z es exactamente 0
    }
    
    return intersectionPoint;
}

// Función para crear paneles
function createPanelFromSelection(start3D, end3D) {
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) return;
    const { cellSize, cellsX, cellsY, halfWidth, halfHeight } = currentGridParams;

    // Deseleccionar todos los paneles existentes
    panels.forEach(panel => {
        if (panel.selected) {
            panel.selected = false;
            updatePanelColor(panel);
        }
    });

    // Determinar límites de la selección en 3D
    const minX = Math.min(start3D.x, end3D.x);
    const maxX = Math.max(start3D.x, end3D.x);
    const minY = Math.min(start3D.y, end3D.y);
    const maxY = Math.max(start3D.y, end3D.y);

    // Encontrar celdas seleccionadas y sus índices
    const selectedCellIndices = [];
    let pMinX = Infinity, pMaxX = -Infinity;
    let pMinY = Infinity, pMaxY = -Infinity;

    // Tolerancia para selecciones delgadas (en unidades de mundo)
    const selectionTolerance = cellSize * 0.1; // 10% del tamaño de celda

    // Convertir coordenadas del mundo a índices de celda
    const worldToGridIndex = (worldX, worldY) => {
        const gridX = Math.floor((worldX + halfWidth) / cellSize);
        const gridY = Math.floor((worldY + halfHeight) / cellSize);
        return { x: gridX, y: gridY };
    };

    // Obtener índices de inicio y fin
    const startIndex = worldToGridIndex(minX, minY);
    const endIndex = worldToGridIndex(maxX, maxY);

    // Ajustar índices para asegurar que estén dentro del grid
    const adjustedStartX = Math.max(0, Math.min(cellsX - 1, startIndex.x));
    const adjustedEndX = Math.max(0, Math.min(cellsX - 1, endIndex.x));
    const adjustedStartY = Math.max(0, Math.min(cellsY - 1, startIndex.y));
    const adjustedEndY = Math.max(0, Math.min(cellsY - 1, endIndex.y));

    // Determinar si es una selección delgada
    const isVerticalSelection = Math.abs(maxX - minX) < selectionTolerance;
    const isHorizontalSelection = Math.abs(maxY - minY) < selectionTolerance;

    // Iterar sobre el área ajustada
    for (let i = adjustedStartX; i <= adjustedEndX; i++) {
        for (let j = adjustedStartY; j <= adjustedEndY; j++) {
            const cellCenterX = -halfWidth + (i + 0.5) * cellSize;
            const cellCenterY = -halfHeight + (j + 0.5) * cellSize;
            
            let shouldInclude = false;

            if (isVerticalSelection) {
                // Para selecciones verticales, usar la coordenada X del punto medio
                const midX = (minX + maxX) / 2;
                shouldInclude = Math.abs(cellCenterX - midX) < cellSize;
            } else if (isHorizontalSelection) {
                // Para selecciones horizontales, usar la coordenada Y del punto medio
                const midY = (minY + maxY) / 2;
                shouldInclude = Math.abs(cellCenterY - midY) < cellSize;
            } else {
                // Para selecciones normales
                shouldInclude = cellCenterX >= minX && cellCenterX <= maxX && 
                              cellCenterY >= minY && cellCenterY <= maxY;
            }

            if (shouldInclude) {
                selectedCellIndices.push({ i, j });
                pMinX = Math.min(pMinX, i);
                pMaxX = Math.max(pMaxX, i);
                pMinY = Math.min(pMinY, j);
                pMaxY = Math.max(pMaxY, j);
            }
        }
    }

    if (selectedCellIndices.length === 0) return;

    // Verificar que los índices están dentro de los límites del grid
    if (pMinX < 0 || pMaxX >= cellsX || pMinY < 0 || pMaxY >= cellsY) {
        console.warn("Selección fuera de los límites del grid");
        return;
    }

    // *** Inicio: Comprobación de conflictos ***
    for (const existingPanel of panels) {
        const eMinX = existingPanel.minCellIndex.x;
        const eMaxX = existingPanel.maxCellIndex.x;
        const eMinY = existingPanel.minCellIndex.y;
        const eMaxY = existingPanel.maxCellIndex.y;

        // Comprobar si los rectángulos de índices (con margen de 1 celda) se solapan
        const conflictX = !(pMaxX < eMinX - 1 || pMinX > eMaxX + 1);
        const conflictY = !(pMaxY < eMinY - 1 || pMinY > eMaxY + 1);

        if (conflictX && conflictY) {
            console.warn("Creación de panel cancelada: Conflicto con panel existente.");
            return; // Detener la creación si hay conflicto
        }
    }
    // *** Fin: Comprobación de conflictos ***

    // Asegurar que el número de orden sea el siguiente disponible
    const maxCurrentNumber = Math.max(...panels.map(p => parseInt(p.orderNumber) || 0), 0);
    panelOrderCounter = Math.max(panelOrderCounter, maxCurrentNumber + 1);

    // Crear el objeto panel con el siguiente número
    const panelData = {
        group: null,
        minCellIndex: { x: pMinX, y: pMinY },
        maxCellIndex: { x: pMaxX, y: pMaxY },
        orderNumber: panelOrderCounter,
        showOrderNumber: globalShowNumbers,
        hasText: false,
        isNewPanel: true
    };

    // Calcular y asignar geometría/posición inicial
    updatePanelGeometryAndPosition(panelData, currentGridParams);

    if(panelData.group) {
        scene.add(panelData.group);
        panels.push(panelData);
        
        // Reindexar después de añadir
        reindexPanels();
        
        // Seleccionar el nuevo panel
        panelData.selected = true;
        updatePanelColor(panelData);
        
        // Crear etiqueta con número de orden
        createPanelOrderLabel(panelData);
    }
}

// Nueva función para crear la etiqueta con el número de orden
function createPanelOrderLabel(panelData) {
    if (!panelData.group) return;
    
    // Eliminar etiqueta anterior si existe
    if (panelData.orderLabel) {
        panelData.group.remove(panelData.orderLabel);
        panelData.orderLabel = null; // Asegurar que se limpie la referencia
    }
    
    // Solo crear etiqueta si showOrderNumber es true
    if (panelData.showOrderNumber) {
        // Crear canvas para la etiqueta
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256; 
        canvas.height = 256; 
        
        // Estilo del número
        context.fillStyle = '#000000'; // Fondo negro para mejor contraste
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff'; // Texto blanco
        context.font = 'bold 160px Arial'; 
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Determinar el texto de la etiqueta
        let labelText = '';
        if (panelData.isKeyboardKey) {
            // Para teclas del teclado, no mostrar prefijo "P" (o manejar diferente si se necesita)
            // Por ahora, las teclas del teclado no muestran número de orden por defecto.
            // Si se activara showOrderNumber para ellas, aquí se podría definir su formato.
            labelText = panelData.orderNumber.toString();
        } else {
            // Para paneles de usuario, añadir prefijo "P"
            labelText = 'P' + panelData.orderNumber.toString();
        }
        context.fillText(labelText, canvas.width/2, canvas.height/2);
        
        // Crear textura y sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Ajustar tamaño y posición
        sprite.scale.set(0.8, 0.8, 1); // Aumentado a 0.8
        sprite.position.set(0, 0, 0.02); // Ahora relativo a la posición del grupo
        
        // Guardar referencia y añadir al grupo
        panelData.orderLabel = sprite;
        panelData.group.add(sprite);
    }
}

// Función para obtener parámetros actuales del grid
function getCurrentGridParams() {
    if (!currentGrid) return null;
    const { width, height } = calculateGridSize();
    const minDimension = Math.min(width, height);
    const cellSize = minDimension / currentDivisions;
    const cellsX = Math.ceil(width / cellSize);
    const cellsY = Math.ceil(height / cellSize);
    const adjustedWidth = cellsX * cellSize;
    const adjustedHeight = cellsY * cellSize;
    const halfWidth = adjustedWidth / 2;
    const halfHeight = adjustedHeight / 2;
    return { width, height, minDimension, cellSize, cellsX, cellsY, adjustedWidth, adjustedHeight, halfWidth, halfHeight };
}

// Función para actualizar la geometría y posición de UN panel
function updatePanelGeometryAndPosition(panelData, gridParams) {
    const { cellSize, halfWidth, halfHeight } = gridParams;
    const { minCellIndex, maxCellIndex } = panelData;

    // Preservar el número de orden y visibilidad
    const orderNumber = panelData.orderNumber;
    const showOrderNumber = panelData.showOrderNumber !== undefined ? panelData.showOrderNumber : false;
    const hasText = panelData.hasText !== undefined ? panelData.hasText : false;
    const behavior = panelData.behavior; // Preservar el behavior

    // Preservar el modelo si existe
    const modelData = preserveModel(panelData);

    const panelCellsX = maxCellIndex.x - minCellIndex.x + 1;
    const panelCellsY = maxCellIndex.y - minCellIndex.y + 1;

    const panelWidth = panelCellsX * cellSize;
    const panelHeight = panelCellsY * cellSize;
    
    // Calcular centro basado en índices y tamaño de celda actual
    const panelCenterX = -halfWidth + (minCellIndex.x + panelCellsX / 2) * cellSize;
    const panelCenterY = -halfHeight + (minCellIndex.y + panelCellsY / 2) * cellSize;

    const panelHalfWidth = panelWidth / 2;
    const panelHalfHeight = panelHeight / 2;
    const bevelSize = cellSize * 0.5;

    // Si el grupo no existe, crearlo
    if (!panelData.group) {
        panelData.group = new THREE.Group();
        panelData.group.userData = { panelDataRef: panelData }; 
        panelData.selected = false; 
        panelData.hovered = false; 
        panelData.borderLines = []; // Inicializar array para líneas de borde
    } else {
        // Limpiar hijos antiguos (incluyendo líneas de borde antiguas)
        while(panelData.group.children.length > 0){
            const child = panelData.group.children[0]; 
            panelData.group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            if (child === panelData.fillMesh) {
                 delete panelData.fillMesh;
            }
        }
        panelData.borderLines = []; // Resetear array para nuevas líneas
        delete panelData.orderLabel; // Eliminar referencia a la etiqueta eliminada
        delete panelData.keyLabel; // Eliminar referencia a la etiqueta de tecla
    }

    // Asegurarnos de que se mantenga el número de orden, estado del texto y behavior
    panelData.orderNumber = orderNumber;
    panelData.showOrderNumber = showOrderNumber;
    panelData.hasText = hasText;
    panelData.behavior = behavior;

    // --- Crear/Actualizar Mesh de Relleno con Forma Biselada --- 
    const shape = new THREE.Shape();

    // Empezar en esquina inf izq (después del bisel)
    shape.moveTo(-panelHalfWidth + bevelSize, -panelHalfHeight);
    // Lado inferior
    shape.lineTo(panelHalfWidth - bevelSize, -panelHalfHeight);
    // Esquina inf der (bisel)
    shape.lineTo(panelHalfWidth, -panelHalfHeight + bevelSize);
    // Lado derecho
    shape.lineTo(panelHalfWidth, panelHalfHeight - bevelSize);
    // Esquina sup der (bisel)
    shape.lineTo(panelHalfWidth - bevelSize, panelHalfHeight);
    // Lado superior
    shape.lineTo(-panelHalfWidth + bevelSize, panelHalfHeight);
    // Esquina sup izq (bisel)
    shape.lineTo(-panelHalfWidth, panelHalfHeight - bevelSize);
    // Lado izquierdo
    shape.lineTo(-panelHalfWidth, -panelHalfHeight + bevelSize);
    // Cerrar (vuelve al punto inicial)
    shape.closePath();

    const fillGeometry = new THREE.ShapeGeometry(shape);
    
    // Generar UVs que cubran todo el panel uniformemente
    const uvs = fillGeometry.attributes.uv;
    const positions = fillGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        
        // Mapear coordenadas a UVs (0-1)
        const u = (x + panelHalfWidth) / panelWidth;
        const v = (y + panelHalfHeight) / panelHeight;
        
        uvs.setXY(i, u, v);
    }
    
    fillGeometry.attributes.uv.needsUpdate = true;
    panelData.fillMesh = new THREE.Mesh(fillGeometry, panelFillMaterialNormal);
    panelData.fillMesh.userData.panelDataRef = panelData;
    panelData.fillMesh.userData.isPanel = true;
    panelData.group.add(panelData.fillMesh);

    // --- Crear Líneas de Borde (una única línea) --- 
    const borderPoints = [];
    // Izquierdo
    borderPoints.push(new THREE.Vector3(-panelHalfWidth, -panelHalfHeight + bevelSize, 0));
    borderPoints.push(new THREE.Vector3(-panelHalfWidth, panelHalfHeight - bevelSize, 0));
    // Sup Izq (bisel)
    borderPoints.push(new THREE.Vector3(-panelHalfWidth + bevelSize, panelHalfHeight, 0));
    // Superior
    borderPoints.push(new THREE.Vector3(panelHalfWidth - bevelSize, panelHalfHeight, 0));
    // Sup Der (bisel)
    borderPoints.push(new THREE.Vector3(panelHalfWidth, panelHalfHeight - bevelSize, 0));
    // Derecho
    borderPoints.push(new THREE.Vector3(panelHalfWidth, -panelHalfHeight + bevelSize, 0));
    // Inf Der (bisel)
    borderPoints.push(new THREE.Vector3(panelHalfWidth - bevelSize, -panelHalfHeight, 0));
    // Inferior
    borderPoints.push(new THREE.Vector3(-panelHalfWidth + bevelSize, -panelHalfHeight, 0));
    // Inf Izq (bisel) y cerrar
    borderPoints.push(new THREE.Vector3(-panelHalfWidth, -panelHalfHeight + bevelSize, 0));

    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
    // Establecer un valor alto para computeBoundingSphere para mejorar la detección con raycaster
    borderGeometry.computeBoundingSphere();
    
    // Crear SOLO UNA línea de borde
    const borderLine = new THREE.Line(borderGeometry, panelLineMaterialNormal);
    // Mejorar la detección para raycasting
    borderLine.userData.isPanel = true; // Marcador para identificar líneas de panel
    borderLine.userData.panelDataRef = panelData; // Referencia al panel
    panelData.group.add(borderLine);
    panelData.borderLines.push(borderLine);
    
    // Posicionar el GRUPO en el centro calculado
    panelData.group.position.set(panelCenterX, panelCenterY, 0.01); 

    if (panelData.mesh) delete panelData.mesh; 

    // Restaurar el modelo si existía
    if (modelData) {
        restoreModel(panelData, modelData);
    }

    // Preparar animación de flash
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelsFlashing.add(panelData);
    
    // Crear etiqueta con el texto de la tecla
    createKeyLabel(panelData, gridParams.cellSize);
    
    // Solo actualizar el texto si el panel ya tenía texto
    if (hasText) {
        createPanelText(panelData, gridParams.cellSize);
    }
    
    // Actualizar logo si el panel está asociado
    updateOnPanelMove(panelData);
}

// Función para crear UN panel desde bounding box de índices
function createPanelFromBoundingBox(bboxIndices, gridParams) {
     const panelData = {
        group: null,
        minCellIndex: { x: bboxIndices.minX, y: bboxIndices.minY },
        maxCellIndex: { x: bboxIndices.maxX, y: bboxIndices.maxY },
        orderNumber: panelOrderCounter++,
        showOrderNumber: false,
        hasText: false,
        selected: false,
        hovered: false,
        borderLines: []
    };

    updatePanelGeometryAndPosition(panelData, gridParams);

    if (panelData.group) {
        scene.add(panelData.group);
        panels.push(panelData);
        
        // Crear etiqueta con número de orden
        createPanelOrderLabel(panelData);

        // Preparar animación de flash
        panelData.flashProgress = 0;
        panelData.shouldFlash = true;
        panelsFlashing.add(panelData);

        console.log('Panel creado:', {
            posición: panelData.group.position,
            índices: { min: panelData.minCellIndex, max: panelData.maxCellIndex },
            número: panelData.orderNumber
        });
    } else {
        console.error('Error al crear el panel:', bboxIndices);
    }

    return panelData;
}

// Función helper para actualizar el color del panel (AHORA PARA LÍNEAS Y RELLENO)
function updatePanelColor(panelData) {
    if (!panelData || !panelData.group) return;
    
    let targetLineMaterial;
    let targetFillMaterial;

    if (panelData.hasTexture && panelData.textureMaterials) {
        // Si el panel tiene textura, usar los materiales con textura
        if (panelData.selected) {
            targetFillMaterial = panelData.textureMaterials.selected;
        } else if (panelData.hovered && !('ontouchstart' in window)) {
            targetFillMaterial = panelData.textureMaterials.hover;
        } else {
            targetFillMaterial = panelData.textureMaterials.normal;
        }
        
        // Para las líneas usar los materiales normales
        if (panelData.selected) {
            targetLineMaterial = panelLineMaterialSelected;
        } else if (panelData.hovered && !('ontouchstart' in window)) {
            targetLineMaterial = panelLineMaterialHover;
        } else {
            targetLineMaterial = panelLineMaterialNormal;
        }
    } else {
        // Comportamiento normal para paneles sin textura
        if (panelData.selected) {
            targetLineMaterial = panelLineMaterialSelected;
            targetFillMaterial = panelFillMaterialSelected;
        } else if (panelData.hovered && !('ontouchstart' in window)) {
            targetLineMaterial = panelLineMaterialHover;
            targetFillMaterial = panelFillMaterialHover;
            
            // Imprimir el carácter en la consola cuando se hace hover
            if (panelData.behavior && panelData.behavior.character) {
                console.log(`Tecla: ${panelData.behavior.character}`);
            }
        } else {
            targetLineMaterial = panelLineMaterialNormal;
            targetFillMaterial = panelFillMaterialNormal;
        }
    }

    // Aplicar materiales
    panelData.group.children.forEach(child => {
        if (child instanceof THREE.Line) {
            child.material = targetLineMaterial;
        } else if (child === panelData.fillMesh) {
            child.material = targetFillMaterial;
        }
    });

    // Guardar referencia a materiales actuales para animación de flash
    panelData.currentLineMaterial = targetLineMaterial;
    panelData.currentFillMaterial = targetFillMaterial;
}

// Event listeners para selección
// Event listener para doble click
renderer.domElement.addEventListener('dblclick', (event) => {
    // Ignorar eventos táctiles
    if (event.pointerType === 'touch') return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Recopilar todos los objetos seleccionables
    const allSelectable = [];
    const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
    const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
    allSelectable.push(...allFillMeshes, ...allBorderLines);
    
    const intersects = raycaster.intersectObjects(allSelectable, false);
    
    if (intersects.length > 0) {
        let panelData = null;
        let currentObject = intersects[0].object;
        while (currentObject && !panelData) {
            if (currentObject.userData && currentObject.userData.panelDataRef) {
                panelData = currentObject.userData.panelDataRef;
                break;
            }
            currentObject = currentObject.parent;
        }
        
        if (panelData) {
            handlePanelDoubleClick(panelData);
        }
    }
});

renderer.domElement.addEventListener('mousedown', (event) => {
    // Ignorar eventos táctiles
    if (event.pointerType === 'touch') return;
    
    // Permitir solo click izquierdo sin Ctrl
    if (event.button === 0 && !event.ctrlKey) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Configurar raycaster con posición precisa
        raycaster.setFromCamera(mouse, camera);

        // --- Raycast contra BORDES Y RELLENO --- 
        // Recopilar todos los objetos seleccionables (bordes y rellenos)
        const allSelectable = [];
        
        // Añadir todos los meshes de relleno (fillMesh)
        const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
        allSelectable.push(...allFillMeshes);
        
        // Añadir también las líneas de borde para mantener la selección precisa
        const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
        allSelectable.push(...allBorderLines);
        
        // Ordenar por distancia más cercana primero
        const intersects = raycaster.intersectObjects(allSelectable, false)
            .sort((a, b) => a.distance - b.distance);

        if (intersects.length > 0) {
            // --- Se hizo click sobre un panel (borde o relleno) --- 
            // IMPORTANTE: Desactivar controles de cámara INMEDIATAMENTE al hacer clic en un panel
            // Esto evita que la cámara se mueva cuando queremos interactuar con paneles
            controls.enabled = false;
            
            let clickedPanelData = null;
            // El objeto intersectado es una línea o mesh, obtener panelData
            let currentObject = intersects[0].object;
            
            // Si es un fillMesh, podría tener referencia directa
            if (currentObject.userData && currentObject.userData.panelDataRef) {
                clickedPanelData = currentObject.userData.panelDataRef;
            } else {
                // Buscar hacia arriba en la jerarquía de objetos
                while (currentObject && !clickedPanelData) {
                    if (currentObject.userData && currentObject.userData.panelDataRef) {
                        clickedPanelData = currentObject.userData.panelDataRef;
                        break; // Salir del bucle inmediatamente al encontrar el panel
                    }
                    // Subir al padre solo si NO encontramos userData aquí
                    currentObject = currentObject.parent; 
                }
            }
            
            if (clickedPanelData) {
                // NUEVA LÓGICA: Verificar si el panel está asignado para navegar a un slot
                if (!clickedPanelData.isKeyboardKey && typeof clickedPanelData.navigateToSlot === 'number') {
                    console.log(`Panel P${clickedPanelData.orderNumber} clickeado. Navegando a Slot ${clickedPanelData.navigateToSlot}.`);
                    loadFromSlot(clickedPanelData.navigateToSlot);
                    // Deseleccionar el panel después de la navegación para evitar acciones no deseadas si el slot carga paneles seleccionados.
                    clickedPanelData.selected = false;
                    updatePanelColor(clickedPanelData);
                    return; // Terminar el procesamiento aquí para no interferir con la selección normal
                }

                if (clickedPanelData.isKeyboardKey && clickedPanelData.behavior && clickedPanelData.behavior.character) {
                    // Es una tecla del teclado, solo ejecutar onPress y flash
                    if (clickedPanelData.onPress) {
                        clickedPanelData.onPress();
                        console.log(`Tecla bioKeyb presionada: ${clickedPanelData.behavior.character}`);
                        
                        // Asegurar que no quede seleccionada
                        clickedPanelData.selected = false;
                        
                        // Efecto visual de flash
                        clickedPanelData.flashProgress = 0;
                        clickedPanelData.shouldFlash = true;
                        panelsFlashing.add(clickedPanelData);
                    }
                } else {
                    // Comportamiento normal para paneles regulares
                if (event.shiftKey) {
                    clickedPanelData.selected = !clickedPanelData.selected; 
                } else {
                    // --- Click Normal: Deseleccionar todos y seleccionar solo este --- 
                    panels.forEach(p => {
                        if (p !== clickedPanelData && p.selected) {
                            p.selected = false;
                            updatePanelColor(p);
                        }
                    });
                       clickedPanelData.selected = true; 
                       updatePanelColor(clickedPanelData);
                }
                }
            }
        } else {
            // --- Se hizo click en el fondo (no en un panel) --- 
            if (!event.shiftKey) { // Solo deseleccionar si NO se presiona Shift
                let deselectedSomething = false;
                panels.forEach(p => {
                    if (p.selected) {
                        p.selected = false;
                        updatePanelColor(p);
                        deselectedSomething = true;
                    }
                });
    
                // Iniciar selección por arrastre
                    isSelecting = true;
                    controls.enabled = false; 
                    startPoint = { x: event.clientX, y: event.clientY };
                    endPoint = { x: event.clientX, y: event.clientY };
                    selectionBox.style.left = `${startPoint.x}px`;
                    selectionBox.style.top = `${startPoint.y}px`;
                    selectionBox.style.width = '0px';
                    selectionBox.style.height = '0px';
                    selectionBox.style.display = 'block';
                }
        }
    }
});

renderer.domElement.addEventListener('mousemove', (event) => {
    // Ignorar eventos táctiles
    if (event.pointerType === 'touch') return;
    
    if (isSelecting) {
        endPoint = { x: event.clientX, y: event.clientY };
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        const left = Math.min(startPoint.x, endPoint.x);
        const top = Math.min(startPoint.y, endPoint.y);

        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
    } else if (isDraggingPanel && draggedPanel) {
        // Calcular el desplazamiento del mouse
        const deltaX = event.clientX - dragStartPosition.x;
        const deltaY = event.clientY - dragStartPosition.y;
        
        // Calcular factor de escala con sensibilidad reducida
        const screenToWorldFactor = 0.005 * dragSensitivity * (camera.position.z / 5);
        
        // Calcular nueva posición
        let newX = dragStartPanelPosition.x + deltaX * screenToWorldFactor;
        let newY = dragStartPanelPosition.y - deltaY * screenToWorldFactor; // Y invertido
        
        // Obtener parámetros actuales del grid para snap to grid
        if (dragSnapToGrid) {
            const currentGridParams = getCurrentGridParams();
            if (currentGridParams) {
                const { cellSize, halfWidth, halfHeight } = currentGridParams;
                
                // Calcular la posición de celda más cercana
                // Primero convertir de coordenadas de mundo a índices de celda
                const cellX = Math.round((newX + halfWidth) / cellSize - 0.5);
                const cellY = Math.round((newY + halfHeight) / cellSize - 0.5);
                
                // Convertir de vuelta a coordenadas de mundo para snap
                const snappedX = -halfWidth + (cellX + 0.5) * cellSize;
                const snappedY = -halfHeight + (cellY + 0.5) * cellSize;
                
                // Aplicar un factor de atracción suave
                const snapStrength = 0.4; // 0 = sin snap, 1 = snap total
                newX = newX * (1 - snapStrength) + snappedX * snapStrength;
                newY = newY * (1 - snapStrength) + snappedY * snapStrength;
            }
        }
        
        // Actualizar la posición visual del panel
        draggedPanel.group.position.set(newX, newY, draggedPanel.group.position.z);
        
        // Actualizar el cursor
        renderer.domElement.style.cursor = 'move';
        
        // Desactivar los controles de OrbitControls mientras se arrastra
        controls.enabled = false;
    } else {
        // --- Lógica de Hover para TODO el panel (borde y relleno) --- 
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Configurar raycaster con posición precisa
        raycaster.setFromCamera(mouse, camera);

        // Recopilar todos los objetos para hover (igual que en mousedown)
        const allHoverables = [];
        
        // Añadir todos los meshes de relleno
        const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
        allHoverables.push(...allFillMeshes);
        
        // Añadir también líneas de borde
        const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
        allHoverables.push(...allBorderLines);
        
        // Ordenar por distancia
        const intersects = raycaster.intersectObjects(allHoverables, false)
            .sort((a, b) => a.distance - b.distance);

        let newHoveredPanelData = null;
        if (intersects.length > 0) {
            // El objeto intersectado es una línea o mesh, obtener panelData
            let currentObject = intersects[0].object;
            
            // Si es un fillMesh, podría tener referencia directa
            if (currentObject.userData && currentObject.userData.panelDataRef) {
                newHoveredPanelData = currentObject.userData.panelDataRef;
            } else {
                // Buscar hacia arriba en la jerarquía
                while (currentObject && !newHoveredPanelData) {
                    if (currentObject.userData && currentObject.userData.panelDataRef) {
                        newHoveredPanelData = currentObject.userData.panelDataRef;
                        break;
                    }
                    currentObject = currentObject.parent;
                }
            }
        }

        // Si el panel hovereado cambió
        if (newHoveredPanelData !== currentlyHoveredPanel) {
            // Quitar hover del anterior (si existe)
            if (currentlyHoveredPanel) {
                currentlyHoveredPanel.hovered = false;
                updatePanelColor(currentlyHoveredPanel);
            }
            // Poner hover en el nuevo (si existe)
            if (newHoveredPanelData) {
                newHoveredPanelData.hovered = true;
                updatePanelColor(newHoveredPanelData);
            }
            currentlyHoveredPanel = newHoveredPanelData;
        }
    }
});

renderer.domElement.addEventListener('mouseup', (event) => {
    // Cancelar temporizador de inicio de arrastre si existe
    if (dragStartTimer) {
        clearTimeout(dragStartTimer);
        dragStartTimer = null;
    }
    
    // Limpiar panel potencial para arrastrar
    potentialDragPanel = null;
    
    if (isSelecting && event.button === 0) {
        isSelecting = false;
        controls.enabled = true;
        selectionBox.style.display = 'none';

        const start3D = get3DPointOnGrid({clientX: startPoint.x, clientY: startPoint.y});
        const end3D = get3DPointOnGrid({clientX: endPoint.x, clientY: endPoint.y});

        const dragDistance = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
        );
        
        if (start3D && end3D && dragDistance > 5) {
           createPanelFromSelection(start3D, end3D);
        }
    } else if (isDraggingPanel && draggedPanel && event.button === 0) {
        isDraggingPanel = false;
        
        const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) {
            draggedPanel.group.position.set(
                dragStartPanelPosition.x, 
                dragStartPanelPosition.y, 
                draggedPanel.group.position.z
            );
            draggedPanel = null;
            controls.enabled = true;
            renderer.domElement.style.cursor = 'auto';
            return;
        }
        
        const { cellSize, halfWidth, halfHeight, cellsX, cellsY } = currentGridParams;
        
        const groupX = draggedPanel.group.position.x;
        const groupY = draggedPanel.group.position.y;
        
        const cellX = Math.round((groupX + halfWidth) / cellSize - 0.5);
        const cellY = Math.round((groupY + halfHeight) / cellSize - 0.5);
        
        const cellDeltaX = cellX - (dragStartCellIndices.minX + (dragStartCellIndices.maxX - dragStartCellIndices.minX) / 2);
        const cellDeltaY = cellY - (dragStartCellIndices.minY + (dragStartCellIndices.maxY - dragStartCellIndices.minY) / 2);
        
        if (cellDeltaX !== 0 || cellDeltaY !== 0) {
            const newMinX = dragStartCellIndices.minX + Math.round(cellDeltaX);
            const newMaxX = dragStartCellIndices.maxX + Math.round(cellDeltaX);
            const newMinY = dragStartCellIndices.minY + Math.round(cellDeltaY);
            const newMaxY = dragStartCellIndices.maxY + Math.round(cellDeltaY);
            
            let collisionDetected = false;
            
            // Verificar límites del grid
            if (newMinX < 0 || newMaxX >= cellsX || newMinY < 0 || newMaxY >= cellsY) {
                collisionDetected = true;
            } else {
                // Verificar colisiones con otros paneles
                for (const panel of panels) {
                    if (panel === draggedPanel) continue;
                    
                    const eMinX = panel.minCellIndex.x;
                    const eMaxX = panel.maxCellIndex.x;
                    const eMinY = panel.minCellIndex.y;
                    const eMaxY = panel.maxCellIndex.y;
                    
                    const conflictX = !(newMaxX < eMinX - 1 || newMinX > eMaxX + 1);
                    const conflictY = !(newMaxY < eMinY - 1 || newMinY > eMaxY + 1);
                    
                    if (conflictX && conflictY) {
                        collisionDetected = true;
                        break;
                    }
                }
            }
            
            if (collisionDetected) {
                // En lugar de restaurar la posición, intentar empujar los paneles
                const pushed = pushOverlappingPanels(draggedPanel, currentGridParams);
                
                if (!pushed) {
                    // Si no se pudo empujar, restaurar posición original
                    draggedPanel.group.position.set(
                        dragStartPanelPosition.x, 
                        dragStartPanelPosition.y, 
                        draggedPanel.group.position.z
                    );
                    draggedPanel.minCellIndex.x = dragStartCellIndices.minX;
                    draggedPanel.minCellIndex.y = dragStartCellIndices.minY;
                    draggedPanel.maxCellIndex.x = dragStartCellIndices.maxX;
                    draggedPanel.maxCellIndex.y = dragStartCellIndices.maxY;
                }
            } else {
                // Movimiento válido sin colisiones
                draggedPanel.minCellIndex.x = newMinX;
                draggedPanel.minCellIndex.y = newMinY;
                draggedPanel.maxCellIndex.x = newMaxX;
                draggedPanel.maxCellIndex.y = newMaxY;
                
                // Actualizar las coordenadas base para futuros movimientos
                dragStartCellIndices.minX = newMinX;
                dragStartCellIndices.minY = newMinY;
                dragStartCellIndices.maxX = newMaxX;
                dragStartCellIndices.maxY = newMaxY;
                
                updatePanelGeometryAndPosition(draggedPanel, currentGridParams);
                    createPanelOrderLabel(draggedPanel);
                    
                    draggedPanel.flashProgress = 0;
                    draggedPanel.shouldFlash = true;
                    panelsFlashing.add(draggedPanel);
                }
        }
        
        draggedPanel = null;
    }
    
    // Manejar fin de órbita
    if (isOrbiting) {
        isOrbiting = false;
        startOrbitReturn();
    }
    
    if (!isCtrlPressed) {
        controls.enabled = false;
        controls.enableRotate = false;
        renderer.domElement.style.cursor = 'auto';
    }
    
        controls.enabled = true;
        renderer.domElement.style.cursor = 'auto';
});

// Añadir evento para cancelar arrastre y su temporizador al salir del canvas
renderer.domElement.addEventListener('mouseleave', () => {
    // Cancelar temporizador de inicio de arrastre
    if (dragStartTimer) {
        clearTimeout(dragStartTimer);
        dragStartTimer = null;
        potentialDragPanel = null;
    }
    
    if (isDraggingPanel && draggedPanel) {
        // Restaurar posición original
        draggedPanel.group.position.set(
            dragStartPanelPosition.x, 
            dragStartPanelPosition.y, 
            draggedPanel.group.position.z
        );
        
        // Limpiar estado
        isDraggingPanel = false;
        draggedPanel = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'auto';
    }
});

// --- Funciones de Configuración --- 

function getSerializableConfig() {
    try {
        const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) return null;
        
        const { width, height } = calculateGridSize();
        
        // Obtener los valores actuales del bioFX
        const currentColor = parseInt(colorPicker.value.substring(1), 16);
        const currentBlendType = parseInt(blendTypePicker.value);
        const currentIntensity = parseFloat(intensitySlider.value);
        const currentGlowIntensity = parseFloat(glowSlider.value);
        const currentGlowRadius = parseFloat(glowRadiusSlider.value);
        const currentGlowThreshold = parseFloat(glowThresholdSlider.value);
        
        // Serializar solo los paneles que NO son teclas del teclado
        const serializedPanels = [];
        
        // Filtrar y mapear en pasos separados para evitar problemas con paneles inválidos
        const regularPanels = panels.filter(panel => !panel.isKeyboardKey);
        
        for (const panel of regularPanels) {
            try {
                const textState = panelTextState.get(panel);
                const currentText = panel.hasText ? 
                    (textState && textState.isPassword ? textState.realText : getPanelText(panel)) : '';
                
                // Crear un objeto simple serializable
                const serializedPanel = {
                    minCellIndex: { 
                        x: typeof panel.minCellIndex.x === 'number' ? panel.minCellIndex.x : 0,
                        y: typeof panel.minCellIndex.y === 'number' ? panel.minCellIndex.y : 0
                    },
                    maxCellIndex: { 
                        x: typeof panel.maxCellIndex.x === 'number' ? panel.maxCellIndex.x : 0,
                        y: typeof panel.maxCellIndex.y === 'number' ? panel.maxCellIndex.y : 0
                    },
                    orderNumber: typeof panel.orderNumber === 'number' ? panel.orderNumber : 0,
                    showOrderNumber: !!panel.showOrderNumber,
                    selected: !!panel.selected,
            behavior: {
                        hasText: !!panel.hasText,
                        textContent: typeof currentText === 'string' ? currentText : '',
                        messageBuffer: Array.isArray(textState?.lines) ? [...textState.lines] : [],
                        maxLines: typeof textState?.maxCharsPerLine === 'number' ? textState.maxCharsPerLine : 0,
                        isPassword: !!textState?.isPassword,
                isGATCActive: gatcIntervals.has(panel),
                modelData: panel.modelData ? {
                            modelUrl: typeof panel.modelData.url === 'string' ? panel.modelData.url : '',
                            isRotating: !!panel.modelData.isRotating,
                            rotationSpeed: typeof panel.modelData.rotationSpeed === 'number' ? panel.modelData.rotationSpeed : 0.005
                } : null,
                    genomData: panel.genomData || null
                }
            };
                
                // Validar y sanear los datos
                if (isNaN(serializedPanel.minCellIndex.x)) serializedPanel.minCellIndex.x = 0;
                if (isNaN(serializedPanel.minCellIndex.y)) serializedPanel.minCellIndex.y = 0;
                if (isNaN(serializedPanel.maxCellIndex.x)) serializedPanel.maxCellIndex.x = 0;
                if (isNaN(serializedPanel.maxCellIndex.y)) serializedPanel.maxCellIndex.y = 0;
                
                serializedPanels.push(serializedPanel);
            } catch (error) {
                console.error("Error al serializar panel:", error);
                // Continuar con el siguiente panel
            }
        }
    
    return {
        grid: {
            divisions: currentDivisions,
            size: {
                width: width,
                height: height,
                maxSize: 24,
                cellSize: currentGridParams.cellSize,
                cellsX: currentGridParams.cellsX,
                cellsY: currentGridParams.cellsY,
                adjustedWidth: currentGridParams.adjustedWidth,
                adjustedHeight: currentGridParams.adjustedHeight
            }
        },
        panels: serializedPanels,
        cameraPosition: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        },
        cameraZoom: camera.zoom,
        date: new Date().toISOString(),
        bioFX: {
            color: currentColor,
            blendType: currentBlendType,
            intensity: currentIntensity,
            glow: {
                intensity: currentGlowIntensity,
                radius: currentGlowRadius,
                threshold: currentGlowThreshold
            }
            },
            appVersion: '1.1.0', // Agregar versión de la aplicación
            bioKeybVisible: bioKeybVisible // Guardar estado del teclado
    };
    } catch (error) {
        console.error("Error en getSerializableConfig:", error);
        return null;
    }
}

function saveConfiguration() {
    try {
        // Obtener la configuración actual
        const config = getSerializableConfig();
        if (!config) {
            console.error('No se pudo obtener la configuración para guardar');
            return;
        }
        
        // Guardar la configuración con manejo seguro de errores de serialización
        try {
        const configString = JSON.stringify(config);
            
            // Dividir en chunks si es demasiado grande
            const MAX_CHUNK_SIZE = 2000000; // ~2MB por chunk
            
            if (configString.length > MAX_CHUNK_SIZE) {
                // Si es demasiado grande, guardar en chunks
                const chunks = Math.ceil(configString.length / MAX_CHUNK_SIZE);
                console.log(`Configuración grande (${configString.length} bytes), dividiendo en ${chunks} partes`);
                
                // Limpiar chunks anteriores
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('gridConfig_chunk_')) {
                        localStorage.removeItem(key);
                    }
                }
                
                // Guardar metadatos
                localStorage.setItem('gridConfig_chunks', chunks.toString());
                
                // Guardar cada chunk
                for (let i = 0; i < chunks; i++) {
                    const start = i * MAX_CHUNK_SIZE;
                    const end = Math.min(start + MAX_CHUNK_SIZE, configString.length);
                    const chunk = configString.substring(start, end);
                    localStorage.setItem(`gridConfig_chunk_${i}`, chunk);
                }
                
                // Guardar flag para indicar modo chunked
                localStorage.setItem('gridConfig_mode', 'chunked');
                console.log(`Configuración guardada en ${chunks} chunks`);
            } else {
                // Caso normal, guardar directamente
                localStorage.setItem('gridConfig', configString);
                localStorage.setItem('gridConfig_backup', configString);
                localStorage.setItem('gridConfig_mode', 'single');
        }

        console.log('Configuración guardada exitosamente:', {
                divisiones: config.grid.divisions,
                paneles: config.panels.length,
                fecha: config.date,
                tamaño: configString.length + ' bytes'
            });
            
        console.log('Estado guardado correctamente. Use el botón de cargar para restaurar si es necesario.');
        } catch (stringifyError) {
            console.error('Error al serializar la configuración:', stringifyError);
            throw stringifyError; // Propagar el error para el catch externo
        }
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        // Intentar restaurar desde backup si hay error
        try {
            const backup = localStorage.getItem('gridConfig_backup');
            if (backup) {
                localStorage.setItem('gridConfig', backup);
                console.log('Configuración restaurada desde backup.');
            }
        } catch (backupError) {
            console.error('Error al restaurar desde backup:', backupError);
        }
    }
}

function loadConfiguration() {
    try {
        // No cargar si la animación inicial aún está en progreso
        if (isFirstGridCreation) {
            console.log('Esperando a que termine la animación inicial...');
            return;
        }

        // Verificar si la configuración está en modo chunked
        const configMode = localStorage.getItem('gridConfig_mode');
        let configString = '';
        
        if (configMode === 'chunked') {
            // Cargar configuración desde chunks
            const chunks = parseInt(localStorage.getItem('gridConfig_chunks') || '0');
            if (chunks <= 0) {
                console.error('Error en metadatos de chunks');
                return;
            }
            
            // Reconstruir desde chunks
            for (let i = 0; i < chunks; i++) {
                const chunk = localStorage.getItem(`gridConfig_chunk_${i}`);
                if (!chunk) {
                    console.error(`Error: No se encontró el chunk ${i}`);
                    return;
                }
                configString += chunk;
            }
            
            console.log(`Configuración cargada desde ${chunks} chunks (${configString.length} bytes)`);
        } else {
            // Cargar normalmente
            configString = localStorage.getItem('gridConfig');
        if (!configString) {
            console.log('No hay configuración guardada en localStorage.');
            if (!bioKeybVisible) {
                loadBioKeyb(true); // Cargar teclado pero no guardar configuración
            }
            return;
            }
        }

        let config;
        try {
            config = JSON.parse(configString);
        } catch (parseError) {
            console.error('Error al parsear la configuración:', parseError);
            // Intentar restaurar desde backup
            const backup = localStorage.getItem('gridConfig_backup');
            if (backup) {
                try {
                    config = JSON.parse(backup);
                    console.log('Configuración restaurada desde backup.');
                } catch (backupParseError) {
                    console.error('Error al parsear el backup:', backupParseError);
                    return;
                }
            } else {
                return;
            }
        }

        console.log('Cargando configuración:', {
            divisiones: config.grid.divisions,
            paneles: config.panels.length,
            fecha: config.date
        });

        // Limpiar TODOS los paneles (incluyendo teclado)
        clearAllPanels(true, true);

        // Restaurar configuración de bioFX si existe
        if (config.bioFX) {
            const colorHex = '#' + config.bioFX.color.toString(16).padStart(6, '0');
            colorPicker.value = colorHex;
            blendTypePicker.value = config.bioFX.blendType.toString();
            intensitySlider.value = config.bioFX.intensity.toString();
                glowSlider.value = config.bioFX.glow.intensity.toString();
                glowRadiusSlider.value = config.bioFX.glow.radius.toString();
                glowThresholdSlider.value = config.bioFX.glow.threshold.toString();
            updateBioFXEffect();
        }

        // Actualizar la división del grid solo si es diferente
        const newDivisions = config.grid.divisions;
        if (typeof newDivisions === 'number' && newDivisions !== currentDivisions) {
            console.log(`Actualizando grid de ${currentDivisions} a ${newDivisions} divisiones`);
            currentDivisions = newDivisions;
            updateGrid(newDivisions);
        }

        // Restaurar posición y zoom de la cámara si existen en la configuración
        if (config.cameraPosition) {
            camera.position.set(
                config.cameraPosition.x,
                config.cameraPosition.y,
                config.cameraPosition.z
            );
        }
        
        if (typeof config.cameraZoom === 'number') {
            camera.zoom = config.cameraZoom;
            camera.updateProjectionMatrix();
        }
        
        // Restaurar el estado del teclado según la configuración guardada
        if (config.bioKeybVisible !== undefined) {
            bioKeybVisible = !!config.bioKeybVisible;
        } else {
            bioKeybVisible = false; // Valor por defecto si no está especificado
        }

        // Cargar el teclado si estaba visible o si no hay información sobre visibilidad
        if (bioKeybVisible) {
            loadBioKeyb(true); // Cargar teclado sin guardar configuración
        }
        
        // Recrear los paneles guardados (que no son del teclado)
        requestAnimationFrame(() => {
            const currentGridParams = getCurrentGridParams();
            if (!currentGridParams) {
                console.error("No se pudieron obtener los parámetros del grid después de cargar.");
                return;
            }

            // Cargar solo los paneles que NO son teclas del teclado
            config.panels.forEach(panelInfo => {
                const panelData = {
                    group: null,
                    minCellIndex: { x: panelInfo.minCellIndex.x, y: panelInfo.minCellIndex.y },
                    maxCellIndex: { x: panelInfo.maxCellIndex.x, y: panelInfo.maxCellIndex.y },
                    orderNumber: panelInfo.orderNumber,
                    showOrderNumber: panelInfo.showOrderNumber,
                    hasText: panelInfo.behavior?.hasText || false
                };

                updatePanelGeometryAndPosition(panelData, currentGridParams);
                
                if(panelData.group) {
                    scene.add(panelData.group);
                    panels.push(panelData);

                    // Restaurar comportamiento del panel
                    if (panelInfo.behavior) {
                        if (panelInfo.behavior.hasText) {
                            panelData.hasText = true;
                            const textState = {
                                text: panelInfo.behavior.textContent,
                                lines: panelInfo.behavior.messageBuffer,
                                maxCharsPerLine: panelInfo.behavior.maxLines,
                                cursorPosition: 0,
                                isEditing: false,
                                scrollOffset: 0,
                                isPassword: panelInfo.behavior.isPassword || false,
                                realText: panelInfo.behavior.isPassword ? panelInfo.behavior.textContent : ''
                            };
                            panelTextState.set(panelData, textState);
                            
                            createPanelText(panelData, currentGridParams.cellSize);
                            if (textState.isPassword) {
                                setPanelText(panelData, '*'.repeat(textState.realText.length), currentGridParams.cellSize);
                            } else {
                                setPanelText(panelData, panelInfo.behavior.textContent, currentGridParams.cellSize);
                            }
                        }

                        if (panelInfo.behavior.isGATCActive) {
                            handleGATCCommand({ 
                                appendChild: () => {}, // Mock output para la función
                                innerHTML: ''
                            }, panelData);
                        }

                        if (panelInfo.behavior.modelData) {
                            const { modelUrl, isRotating, rotationSpeed } = panelInfo.behavior.modelData;
                            loadModelToPanel(panelData, modelUrl, currentGridParams.cellSize).then(() => {
                                if (isRotating) {
                                    toggleModelRotation(panelData);
                                    if (rotationSpeed) {
                                        setModelRotationSpeed(panelData, rotationSpeed);
                                    }
                                }
                            });
                        }

                        if (panelInfo.behavior.genomData) {
                            panelData.genomData = panelInfo.behavior.genomData;
                        }
                    }

                    if (panelInfo.selected) {
                        panelData.selected = true;
                        updatePanelColor(panelData);
                    }
                }
            });

            // Ajustar la cámara después de recrear todo
            adjustCameraToGrid();
        });

        console.log('Configuración cargada desde localStorage.');
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        // Si hay error, asegurar que el teclado esté cargado
        if (!panels.some(panel => panel.isKeyboardKey)) {
            loadBioKeyb(true); // Cargar teclado sin guardar configuración
        }
    }
}

// Función para descargar la configuración actual como archivo JSON
function downloadConfiguration() {
    try {
        // Obtener la configuración actual usando la misma función que saveConfiguration
        const config = getSerializableConfig();
        if (!config) {
            console.error('No se pudo obtener la configuración para descargar');
            return;
        }

        // Verificar que los datos son válidos
        if (!config.grid || !config.panels) {
            console.error('Error: Los datos a descargar están incompletos');
            return;
        }

        // Convertir a JSON con formato legible
        const jsonData = JSON.stringify(config, null, 2);

        // Crear y descargar el archivo
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bioPrint_config_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        
        // Guardar también en localStorage como backup
        localStorage.setItem('gridConfig', jsonData);
        localStorage.setItem('gridConfig_backup', jsonData);

        // Verificar que se guardó correctamente en localStorage
        const savedConfig = localStorage.getItem('gridConfig');
        if (!savedConfig) {
            console.error('Error: La configuración no se guardó correctamente en localStorage');
            return;
        }

        // Verificar que los datos guardados son correctos
        const parsedSavedConfig = JSON.parse(savedConfig);
        if (!parsedSavedConfig.grid || !parsedSavedConfig.panels) {
            console.error('Error: Los datos guardados en localStorage están incompletos');
            return;
        }
    
        // Si todo está correcto, proceder con la descarga
        document.body.appendChild(a);
        a.click();
    
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        console.log('Configuración guardada y descargada exitosamente:', {
            divisiones: parsedSavedConfig.grid.divisions,
            paneles: parsedSavedConfig.panels.length,
            fecha: parsedSavedConfig.date
        });

    } catch (error) {
        console.error('Error al descargar configuración:', error);
        // Intentar restaurar desde backup si hay error en localStorage
        try {
            const backup = localStorage.getItem('gridConfig_backup');
            if (backup) {
                localStorage.setItem('gridConfig', backup);
                console.log('Configuración restaurada desde backup en localStorage.');
            }
        } catch (backupError) {
            console.error('Error al restaurar desde backup:', backupError);
        }
    }
}

// Función para cargar configuración desde un archivo JSON
function loadConfigurationFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
                applyConfigurationFromData(data);
        } catch (error) {
            console.error("Error al cargar el archivo:", error);
            alert("El archivo seleccionado no tiene un formato válido");
        }
    };
    
    reader.readAsText(file);
}

// --- Event Listeners para Botones --- 
document.getElementById('save-config-btn').addEventListener('click', saveConfiguration);
document.getElementById('load-config-btn').addEventListener('click', loadConfiguration);
document.getElementById('download-config-btn').addEventListener('click', downloadConfiguration);
document.getElementById('toggle-numbers-btn').addEventListener('click', togglePanelNumbers);

// Agregar listener para el botón de limpiar diseño
const clearDesignButton = document.getElementById('clear-layout-btn'); // ID CORREGIDO
if (clearDesignButton) {
    clearDesignButton.addEventListener('click', () => {
        console.log("Botón 'Limpiar Diseño' (ID: clear-layout-btn) presionado.");
        // Llamar a clearAllPanels con skipSave = true y clearBioKeyb = false
        // Esto replica el comportamiento de Ctrl+C
        clearAllPanels(true, false); 
        
        const terminalOutput = document.getElementById('terminal-output');
        if (terminalOutput) {
            // Usar una función existente para mostrar mensajes en la terminal si está disponible
            if (typeof showInfo === 'function') {
                showInfo('Diseño limpiado (paneles de usuario eliminados). El teclado permanece.', terminalOutput);
            } else {
                const infoDiv = document.createElement('div');
                infoDiv.textContent = 'Diseño limpiado (paneles de usuario eliminados). El teclado permanece.';
                terminalOutput.appendChild(infoDiv);
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }
        }
    });
} else {
    // Este log ahora solo aparecerá si realmente falta después de corregir el ID, o si el script se ejecuta demasiado pronto.
    console.warn("El botón con ID 'clear-layout-btn' no fue encontrado en el DOM. Asegúrate que el script se ejecute después de que el DOM esté cargado.");
}

// Agregar event listeners para cargar JSON
document.getElementById('upload-config-btn').addEventListener('click', () => {
    document.getElementById('config-file-input').click();
});

document.getElementById('config-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // Parsear el JSON
            const config = JSON.parse(e.target.result);
            
            // Validar la estructura del archivo
            if (!config || !config.grid || !config.panels) {
                console.error('El archivo JSON no tiene el formato correcto');
                alert('Error: El archivo no tiene el formato correcto de configuración');
                return;
            }

            // Guardar en localStorage
            const jsonString = JSON.stringify(config);
            localStorage.setItem('gridConfig', jsonString);
            localStorage.setItem('gridConfig_backup', jsonString);

            // Verificar que se guardó correctamente
            const savedConfig = localStorage.getItem('gridConfig');
            if (!savedConfig) {
                console.error('Error al guardar la configuración en localStorage');
                alert('Error al guardar la configuración');
                return;
            }

            // Aplicar la configuración
            console.log('Cargando configuración desde archivo:', {
                divisiones: config.grid.divisions,
                paneles: config.panels.length,
                fecha: config.date
            });

            // Usar la función existente para aplicar la configuración
            loadConfiguration();

            console.log('Configuración cargada exitosamente desde archivo JSON');

        } catch (error) {
            console.error('Error al procesar el archivo JSON:', error);
            alert('Error al procesar el archivo. Asegúrese de que es un archivo JSON válido.');
        }
    };

    reader.onerror = function(error) {
        console.error('Error al leer el archivo:', error);
        alert('Error al leer el archivo');
    };

    reader.readAsText(file);

    // Limpiar el input para permitir cargar el mismo archivo nuevamente
    event.target.value = '';
});

// --- Carga Inicial --- 
// Intentar cargar la configuración guardada al iniciar
loadConfiguration(); 

// Función para animar el grid
function animateGrid() {
    if (!gridAnimationInProgress || !currentGrid) return;
    
    console.log("Animando grid, paso:", gridAnimationStep, "progreso:", gridAnimationProgress);
    
    // Obtener grupos desde userData
    const borderGroup = currentGrid.userData.borderGroup;
    const linesGroup = currentGrid.userData.linesGroup;
    
    // Paso 0: Escalar el grid desde pequeño a normal
    if (gridAnimationStep === 0) {
        gridAnimationProgress += 0.02;
        
        // Escalar el grid
        const newScale = THREE.MathUtils.lerp(0.01, gridAnimationProps.targetScale, gridAnimationProgress);
        currentGrid.scale.set(newScale, newScale, newScale);
        
        // Animar opacidad del borde
        const borderOpacity = THREE.MathUtils.lerp(0, 1.0, gridAnimationProgress);
        borderGroup.children.forEach(line => {
            line.material.opacity = borderOpacity;
        });
        
        // Cuando termina la animación de escala
        if (gridAnimationProgress >= 1) {
            gridAnimationProgress = 0;
            gridAnimationStep = 1;
            console.log("Paso 1 de animación completado");
        }
    }
    // Paso 1: Mostrar subdivisiones y bajar opacidad a 0.9
    else if (gridAnimationStep === 1) {
        gridAnimationProgress += 0.03;
        
        // Aumentar la opacidad de las líneas internas gradualmente y luego bajar a 0.9
        const progress = Math.min(1, gridAnimationProgress * 1.5); // Acelerar un poco la transición
        let linesOpacity;
        
        if (progress < 0.7) {
            // Primera fase: subir a 1.0
            linesOpacity = THREE.MathUtils.lerp(0, 1.0, progress / 0.7);
        } else {
            // Segunda fase: bajar a 0.9
            linesOpacity = THREE.MathUtils.lerp(1.0, 0.9, (progress - 0.7) / 0.3);
        }
        
        // Aplicar opacidad a todas las líneas
        linesGroup.children.forEach(line => {
            line.material.opacity = linesOpacity;
        });
        
        borderGroup.children.forEach(line => {
            line.material.opacity = linesOpacity;
        });
        
        // Pasar al siguiente paso cuando termine este
        if (gridAnimationProgress >= 1) {
            gridAnimationProgress = 0;
            gridAnimationStep = 2;
            console.log("Paso 2 de animación completado");
        }
    }
    // Paso 2: Flash (destello)
    else if (gridAnimationStep === 2) {
        gridAnimationProgress += 0.1;
        
        // Función senoidal para generar un destello (aumenta y disminuye)
        const flash = Math.sin(gridAnimationProgress * Math.PI);
        
        // Aplicar el destello a todo el grid
        const flashColor = new THREE.Color(0xffffff);
        const baseColor = new THREE.Color(0x888888);
        
        // Interpolar entre el color base y el color del flash
        const resultColor = new THREE.Color().lerpColors(baseColor, flashColor, flash * 0.7);
        
        // Aplicar a todas las líneas
        linesGroup.children.forEach(line => {
            line.material.color = resultColor.clone();
        });
        
        borderGroup.children.forEach(line => {
            line.material.color = resultColor.clone();
        });
        
        // Reset y siguiente flash cuando termine un ciclo completo
        if (gridAnimationProgress >= 1) {
            gridAnimationProgress = 0;
            gridFlashCount++;
            
            // Terminar después de 2 flashes
            if (gridFlashCount >= 2) {
                // Restaurar colores originales
                const originalColor = new THREE.Color(0x888888);
                linesGroup.children.forEach(line => {
                    line.material.color = originalColor.clone();
                });
                borderGroup.children.forEach(line => {
                    line.material.color = originalColor.clone();
                });
                
                // Terminar la animación
                gridAnimationInProgress = false;
                isFirstGridCreation = false;
                console.log("Animación del grid completada");
                
                // Guardar configuración inicial de la cámara ahora que ya tenemos el grid
                if (!initialCameraState.position) {
                    initialCameraState.position = camera.position.clone();
                    initialCameraState.zoom = camera.zoom;
                    initialCameraState.distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
                    console.log("Guardada configuración inicial de cámara");
                }
            }
        }
    }
}


// Función auxiliar para actualizar opacidad
function updateMaterialOpacity(object, callback) {
    if (object.material) {
        callback(object.material);
    }
    
    if (object.children) {
        object.children.forEach(child => {
            updateMaterialOpacity(child, callback);
        });
    }
}

// Función para actualizar paneles después de la animación
function updatePanelsAfterGridAnimation() {
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) return;
    
    // Guardar propiedades para animar desde el estado actual
    panels.forEach(panelData => {
        // Guardar datos actuales para animación
        if (panelData.group) {
            // Guardar posición actual
            panelData.oldPosition = {
                x: panelData.group.position.x,
                y: panelData.group.position.y,
                z: panelData.group.position.z
            };
            
            // Guardar geometría actual para borde y relleno
            panelData.oldGeometry = {
                borderPoints: [], // Se llenará si existe el borde
                fillShape: null // Se llenará si existe el relleno
            };
            
            // Intentar guardar puntos del borde
            if (panelData.borderLines && panelData.borderLines[0]) {
                const borderLine = panelData.borderLines[0];
                const positions = borderLine.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    panelData.oldGeometry.borderPoints.push(
                        new THREE.Vector3(
                            positions.getX(i),
                            positions.getY(i),
                            positions.getZ(i)
                        )
                    );
                }
            }
            
            // Guardar forma del relleno (simplificado, solo guardaremos el tamaño)
            if (panelData.fillMesh) {
                panelData.oldGeometry.fillSize = {
                    width: panelData.fillMesh.geometry.parameters ? 
                           panelData.fillMesh.geometry.parameters.width : null,
                    height: panelData.fillMesh.geometry.parameters ? 
                            panelData.fillMesh.geometry.parameters.height : null
                };
            }
        }
        
        const wasSelected = panelData.selected;
        const wasHovered = (panelData === currentlyHoveredPanel);
        
        // Calcular PERO NO APLICAR los nuevos datos del panel
        const { cellSize, halfWidth, halfHeight } = currentGridParams;
        const { minCellIndex, maxCellIndex } = panelData;
        
        const panelCellsX = maxCellIndex.x - minCellIndex.x + 1;
        const panelCellsY = maxCellIndex.y - minCellIndex.y + 1;
        
        const panelWidth = panelCellsX * cellSize;
        const panelHeight = panelCellsY * cellSize;
        
        // Calcular nuevo centro basado en índices y tamaño de celda actual
        const newPanelCenterX = -halfWidth + (minCellIndex.x + panelCellsX / 2) * cellSize;
        const newPanelCenterY = -halfHeight + (minCellIndex.y + panelCellsY / 2) * cellSize;
        
        const panelHalfWidth = panelWidth / 2;
        const panelHalfHeight = panelHeight / 2;
        const bevelSize = cellSize * 0.5;
        
        // Guardar datos objetivo de animación
        panelData.animTarget = {
            position: { x: newPanelCenterX, y: newPanelCenterY, z: 0.01 },
            size: { width: panelWidth, height: panelHeight, 
                   halfWidth: panelHalfWidth, halfHeight: panelHalfHeight,
                   bevelSize: bevelSize }
        };
        
        // Preparar para animación en lugar de actualizar inmediatamente
        panelData.resizeProgress = 0;
        panelData.isResizing = true;
        panelsResizing.add(panelData);
        
        // Restaurar estados
        panelData.selected = wasSelected;
        panelData.hovered = wasHovered;
    });
}

// Función para animar el cambio de forma de los paneles
function animateResizingPanels() {
    const panelsToFinalize = [];
    
    panelsResizing.forEach(panelData => {
        if (!panelData.group) {
            panelsToFinalize.push(panelData);
            return;
        }

        // Manejar animación de crecimiento inicial
        if (panelData.isNewPanel) {
            panelData.growthProgress = (panelData.growthProgress || 0) + 0.05;
            const progress = Math.min(1, panelData.growthProgress);
            
            // Función de suavizado para el crecimiento
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            const scale = THREE.MathUtils.lerp(0.01, 1, easedProgress);
            
            panelData.group.scale.set(scale, scale, 1);
            
            if (progress >= 1) {
                delete panelData.isNewPanel;
                delete panelData.growthProgress;
                panelsToFinalize.push(panelData);
                
                // Iniciar flash al completar el crecimiento
                panelData.flashProgress = 0;
                panelData.shouldFlash = true;
                panelsFlashing.add(panelData);
            }
            return;
        }

        // Manejar redimensionamiento normal (cuando cambia el nivel)
        if (!panelData.isResizing) {
            panelsToFinalize.push(panelData);
            return;
        }
        
        // Incrementar progreso (velocidad de animación)
        panelData.resizeProgress += 0.05;
        const progress = Math.min(1, panelData.resizeProgress);
        
        // Aplicar función de suavizado para que la animación sea más natural
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        
        // 1. Animar la posición del grupo
        if (panelData.oldPosition && panelData.animTarget.position) {
            panelData.group.position.x = THREE.MathUtils.lerp(
                panelData.oldPosition.x, 
                panelData.animTarget.position.x, 
                easedProgress
            );
            panelData.group.position.y = THREE.MathUtils.lerp(
                panelData.oldPosition.y, 
                panelData.animTarget.position.y, 
                easedProgress
            );
        }
        
        // 2. Animar la forma
        const size = panelData.animTarget.size;
        
        // 2.1 Animar el borde (crear nuevos puntos interpolados)
        if (panelData.borderLines && panelData.borderLines[0] && panelData.oldGeometry.borderPoints.length > 0) {
            const oldPoints = panelData.oldGeometry.borderPoints;
            
            // Calcular puntos del borde objetivo
            const targetPoints = [];
            // Izquierdo
            targetPoints.push(new THREE.Vector3(-size.halfWidth, -size.halfHeight + size.bevelSize, 0));
            targetPoints.push(new THREE.Vector3(-size.halfWidth, size.halfHeight - size.bevelSize, 0));
            // Sup Izq (bisel)
            targetPoints.push(new THREE.Vector3(-size.halfWidth + size.bevelSize, size.halfHeight, 0));
            // Superior
            targetPoints.push(new THREE.Vector3(size.halfWidth - size.bevelSize, size.halfHeight, 0));
            // Sup Der (bisel)
            targetPoints.push(new THREE.Vector3(size.halfWidth, size.halfHeight - size.bevelSize, 0));
            // Derecho
            targetPoints.push(new THREE.Vector3(size.halfWidth, -size.halfHeight + size.bevelSize, 0));
            // Inf Der (bisel)
            targetPoints.push(new THREE.Vector3(size.halfWidth - size.bevelSize, -size.halfHeight, 0));
            // Inferior
            targetPoints.push(new THREE.Vector3(-size.halfWidth + size.bevelSize, -size.halfHeight, 0));
            // Inf Izq (bisel) y cerrar
            targetPoints.push(new THREE.Vector3(-size.halfWidth, -size.halfHeight + size.bevelSize, 0));
            
            // Asegurarse de que tenemos la misma cantidad de puntos
            const pointCount = Math.min(oldPoints.length, targetPoints.length);
            
            // Crear puntos interpolados
            const interpolatedPoints = [];
            for (let i = 0; i < pointCount; i++) {
                const interpolatedPoint = new THREE.Vector3(
                    THREE.MathUtils.lerp(oldPoints[i].x, targetPoints[i].x, easedProgress),
                    THREE.MathUtils.lerp(oldPoints[i].y, targetPoints[i].y, easedProgress),
                    0
                );
                interpolatedPoints.push(interpolatedPoint);
            }
            
            // Actualizar geometría del borde
            panelData.borderLines[0].geometry.dispose();
            panelData.borderLines[0].geometry = new THREE.BufferGeometry().setFromPoints(interpolatedPoints);
            panelData.borderLines[0].geometry.computeBoundingSphere();
        }
        
        // 2.2 Animar el relleno (Shape)
        if (panelData.fillMesh && panelData.oldGeometry.fillSize) {
            // Crear una nueva forma interpolada
            const shape = new THREE.Shape();
            
            // Calcular dimensiones intermedias
            const oldWidth = panelData.oldGeometry.fillSize.width || size.width;
            const oldHeight = panelData.oldGeometry.fillSize.height || size.height;
            
            const currentWidth = THREE.MathUtils.lerp(oldWidth, size.width, easedProgress);
            const currentHeight = THREE.MathUtils.lerp(oldHeight, size.height, easedProgress);
            
            const currentHalfWidth = currentWidth / 2;
            const currentHalfHeight = currentHeight / 2;
            
            // Interpolar también el tamaño del bisel
            const oldBevelSize = panelData.oldGeometry.fillSize.bevelSize || size.bevelSize;
            const currentBevelSize = THREE.MathUtils.lerp(oldBevelSize, size.bevelSize, easedProgress);
            
            // Recrear la forma con dimensiones interpoladas
            // Empezar en esquina inf izq (después del bisel)
            shape.moveTo(-currentHalfWidth + currentBevelSize, -currentHalfHeight);
            // Lado inferior
            shape.lineTo(currentHalfWidth - currentBevelSize, -currentHalfHeight);
            // Esquina inf der (bisel)
            shape.lineTo(currentHalfWidth, -currentHalfHeight + currentBevelSize);
            // Lado derecho
            shape.lineTo(currentHalfWidth, currentHalfHeight - currentBevelSize);
            // Esquina sup der (bisel)
            shape.lineTo(currentHalfWidth - currentBevelSize, currentHalfHeight);
            // Lado superior
            shape.lineTo(-currentHalfWidth + currentBevelSize, currentHalfHeight);
            // Esquina sup izq (bisel)
            shape.lineTo(-currentHalfWidth, currentHalfHeight - currentBevelSize);
            // Lado izquierdo
            shape.lineTo(-currentHalfWidth, -currentHalfHeight + currentBevelSize);
            // Cerrar (vuelve al punto inicial)
            shape.closePath();
            
            // Actualizar geometría del relleno
            panelData.fillMesh.geometry.dispose();
            panelData.fillMesh.geometry = new THREE.ShapeGeometry(shape);
        }
        
        // Finalizar animación cuando completemos
        if (progress >= 1) {
            panelData.isResizing = false;
            panelsToFinalize.push(panelData);
            
            // Iniciar flash al completar el cambio de forma
            panelData.flashProgress = 0;
            panelData.shouldFlash = true;
            panelsFlashing.add(panelData);
        }
    });
    
    // Limpiar paneles que terminaron su animación
    panelsToFinalize.forEach(panel => {
        panelsResizing.delete(panel);
    });
}

// Función para animar el flash de los paneles
function animateFlashingPanels() {
    const panelsToRemove = [];

    panelsFlashing.forEach(panelData => {
        if (!panelData.shouldFlash) {
            panelsToRemove.push(panelData);
            return;
        }

        // Incrementar progreso de animación (más rápido)
        panelData.flashProgress += 0.15; // Aumentado de 0.05 a 0.15
        
        // Crear efecto de flash basado en función senoidal
        const flashIntensity = Math.sin(panelData.flashProgress * Math.PI * 3); // Aumentado de 2 a 3 para más rápido
        const positiveFlash = Math.max(0, flashIntensity);
        
        // Colores para flash (blanco brillante)
        const baseColor = new THREE.Color(
            panelData.selected ? 0xffffff : 
            panelData.hovered ? 0xcccccc : 0xaaaaaa
        );
        const flashColor = new THREE.Color(0xffffff);
        
        // Aplicar flash a materiales temporales
        if (panelData && panelData.group) {
            panelData.group.children.forEach(child => {
                if (child instanceof THREE.Line && child.material) {
                    const color = new THREE.Color().lerpColors(
                        baseColor, 
                        flashColor, 
                        positiveFlash * 0.7
                    );
                    child.material = child.material.clone();
                    child.material.color = color;
                }
                else if (child === panelData.fillMesh && child.material) {
                    // Si el panel tiene textura, solo modificamos la opacidad
                    if (panelData.hasTexture) {
                        const baseOpacity = panelData.selected ? 0.9 : (panelData.hovered ? 0.8 : 0.7);
                        child.material = child.material.clone();
                        child.material.opacity = baseOpacity + (positiveFlash * 0.1);
                    } else {
                        const color = new THREE.Color().lerpColors(
                            baseColor, 
                            flashColor, 
                            positiveFlash * 0.7
                        );
                        child.material = child.material.clone();
                        child.material.color = color;
                        const baseOpacity = panelData.selected ? 0.4 : (panelData.hovered ? 0.3 : 0.2);
                        child.material.opacity = baseOpacity + (positiveFlash * 0.3);
                    }
                }
            });
        }
        
        // Finalizar animación después de 1 ciclo completo
        if (panelData.flashProgress >= 1) {
            panelData.shouldFlash = false;
            panelsToRemove.push(panelData);
            
            // Verificar si hay un segundo flash pendiente
            if (doubleFlashPending.has(panelData)) {
                const remainingFlashes = doubleFlashPending.get(panelData);
                if (remainingFlashes > 0) {
                    // Iniciar siguiente flash
                    panelData.flashProgress = 0;
                    panelData.shouldFlash = true;
                    doubleFlashPending.set(panelData, remainingFlashes - 1);
                    panelsFlashing.add(panelData);
                } else {
                    doubleFlashPending.delete(panelData);
                }
            }
            
            // Restaurar materiales originales
            updatePanelColor(panelData);
        }
    });
    
    // Limpiar paneles que ya no están en animación
    panelsToRemove.forEach(panel => {
        if (!doubleFlashPending.has(panel) || doubleFlashPending.get(panel) <= 0) {
            panelsFlashing.delete(panel);
        }
    });
}

// Función para centrar el grid en la cámara con una animación suave
function centerGridInCamera() {
    // Verificar si hay rotación significativa antes de centrar
    const currentRotation = new THREE.Euler().setFromQuaternion(camera.quaternion);
    const isRotated = Math.abs(currentRotation.x) > 0.01 || 
                     Math.abs(currentRotation.y) > 0.01 || 
                     Math.abs(currentRotation.z) > 0.01;
    
    // Si no hay rotación significativa, no hacer nada
    if (!isRotated) {
        return;
    }

    // Guardar la posición inicial de la cámara y los controles
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // Usar la posición inicial de la cámara para el zoom
    const targetTarget = new THREE.Vector3(0, 0, 0);
    
    // Calcular la posición objetivo manteniendo la distancia inicial
    // Usamos la misma distancia que se configuró al iniciar la aplicación
    const targetPosition = new THREE.Vector3(0, 0, initialCameraState.distance);
    
    // Duración de la animación en milisegundos
    const duration = 800;
    const startTime = performance.now();
    
    // Animación personalizada para el centrado
    function animateCentering(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Función de suavizado para movimiento natural
        const smoothProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        
        // Interpolar posición de la cámara
        camera.position.lerpVectors(startPosition, targetPosition, smoothProgress);
        
        // Interpolar objetivo de los controles
        controls.target.lerpVectors(startTarget, targetTarget, smoothProgress);
        
        // Actualizar controles y cámara
        controls.update();
        
        // Continuar la animación si no ha terminado
        if (progress < 1) {
            requestAnimationFrame(animateCentering);
        } else {
            // Flash del grid al terminar el centrado (efecto visual de confirmación)
            if (currentGrid) {
                gridAnimationInProgress = true;
                gridAnimationStep = 2; // Solo paso de flash
                gridAnimationProgress = 0;
                gridFlashCount = 0;
            }
        }
    }
    
    // Iniciar la animación
    requestAnimationFrame(animateCentering);
}

// Función para guardar el estado actual de la pantalla
function saveScreenState(index) {
    if (index < 0 || index > 9) return; // Validar índice
    
    // Recopilar datos de todos los paneles actuales
    const currentPanels = panels.map((panel, panelIndex) => ({
        id: `${index+1}_${panel.orderNumber}`, // layout_panel
        minCellIndex: { x: panel.minCellIndex.x, y: panel.minCellIndex.y },
        maxCellIndex: { x: panel.maxCellIndex.x, y: panel.maxCellIndex.y },
        orderNumber: panel.orderNumber,
        showOrderNumber: panel.showOrderNumber,
        selected: panel.selected
    }));
    
    // Guardar datos de cámara y grid
    const screenState = {
        id: `state_${index+1}_${new Date().getTime()}`,
        cameraPosition: camera.position.clone(),
        cameraTarget: controls.target.clone(),
        gridDivisions: currentDivisions,
        panels: currentPanels,
        timestamp: new Date().toLocaleTimeString(),
        date: new Date().toISOString()
    };
    
    // Guardar en el slot correspondiente
    savedScreenStates[index] = JSON.stringify(screenState);
    lastSavedStateIndex = index;
    
    // Actualizar UI
    updateStateButtons();
    
    // Flash de confirmación visual
    gridAnimationInProgress = true;
    gridAnimationStep = 2; // Solo paso de flash
    gridAnimationProgress = 0;
    gridFlashCount = 0;
    
    console.log(`Estado de pantalla guardado en slot ${index + 1}`);
}

// Función para cargar un estado guardado
function loadScreenState(index) {
    if (index < 0 || index > 9 || !savedScreenStates[index]) {
        console.warn(`No hay estado guardado en el slot ${index + 1}`);
        return;
    }
    
    const state = savedScreenStates[index];
    
    // Limpiar paneles actuales
    clearAllPanels();
    
    // Restaurar posición de cámara
    if (state.cameraPosition) {
    camera.position.copy(state.cameraPosition);
    }
    
    // Restaurar objetivo de cámara
    if (state.cameraTarget) {
    controls.target.copy(state.cameraTarget);
    }
    
    // Actualizar divisiones de la cuadrícula
    if (state.gridDivisions) {
        updateGrid(state.gridDivisions);
    }
    
    // Recrear paneles
    const currentGridParams = getCurrentGridParams();
    if (currentGridParams) {
        state.panels.forEach(panelData => {
            const newPanelData = {
                id: panelData.id,
                group: null,
                minCellIndex: { x: panelData.minCellIndex.x, y: panelData.minCellIndex.y },
                maxCellIndex: { x: panelData.maxCellIndex.x, y: panelData.maxCellIndex.y },
                orderNumber: panelData.orderNumber,
                showOrderNumber: panelData.showOrderNumber !== undefined ? panelData.showOrderNumber : false // Default a false si no está definido
            };
            
            updatePanelGeometryAndPosition(newPanelData, currentGridParams);
            
            if (newPanelData.group) {
                scene.add(newPanelData.group);
                panels.push(newPanelData);
                
                // Crear etiqueta con número de orden
                createPanelOrderLabel(newPanelData);
                
                // Aplicar selección si estaba seleccionado
                if (panelData.selected) {
                    newPanelData.selected = true;
                    updatePanelColor(newPanelData);
                }
            }
        });
    }
    
    // Flash de confirmación visual
    gridAnimationInProgress = true;
    gridAnimationStep = 2; // Solo paso de flash
    gridAnimationProgress = 0;
    gridFlashCount = 0;
    
    console.log(`Estado de pantalla cargado desde slot ${index + 1} (guardado: ${state.timestamp})`);
}

// Función para actualizar la interfaz de botones de estado
function updateStateButtons() {
    savedScreenStates.forEach((state, index) => {
        const button = document.querySelector(`.state-button[data-index="${index}"]`);
        if (!button) return;
        
        // Limpiar cualquier indicador previo
        const existingIndicator = button.querySelector('.state-indicator');
        if (existingIndicator) {
            button.removeChild(existingIndicator);
        }
        
        if (state) {
            // Crear indicador para estados guardados
            const indicator = document.createElement('div');
            indicator.classList.add('state-indicator');
            indicator.style.position = 'absolute';
            indicator.style.top = '2px';
            indicator.style.right = '2px';
            indicator.style.width = '6px';
            indicator.style.height = '6px';
            indicator.style.borderRadius = '50%';
            indicator.style.backgroundColor = '#4CAF50'; // Verde
            
            button.appendChild(indicator);
            
            // Añadir tooltip con info del estado
            button.title = `Estado ${index + 1}: ${state.gridDivisions} divisiones, ${state.panels.length} paneles\nGuardado: ${state.timestamp}`;
        } else {
            button.title = `Estado ${index + 1}: Vacío`;
        }
    });
}

// Función para limpiar todos los paneles
function clearAllPanels(skipSave = false, clearBioKeyb = false) {
    // Preservar los paneles del teclado por defecto
    const preservedPanels = panels.filter(panel => panel.isKeyboardKey && !clearBioKeyb);
    
    // Limpiar los paneles que no son del teclado o todos si clearBioKeyb=true
    panels.forEach(panel => {
        if (!panel.isKeyboardKey || clearBioKeyb) {
        if (panel.group) {
            scene.remove(panel.group);
            // Limpiar geometrías de los hijos
            while(panel.group.children.length > 0) {
                const child = panel.group.children[0]; 
                panel.group.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
                }
            }
        }
    });

    // Reemplazar el array de paneles con los preservados
    panels = preservedPanels;
    
    currentlyHoveredPanel = null; 
    
    // Limpiar estados de texto si la función existe
    if (typeof cleanupPanelText === 'function') {
        cleanupPanelText();
    }
    
    // Limpiar estados de modelos
    if (typeof cleanupPanelModels === 'function') {
        cleanupPanelModels();
    }
    if (typeof cleanupGenomModels === 'function') {
        cleanupGenomModels();
    }
    
    // Limpiar intervalos GATC
    gatcIntervals.forEach(interval => clearInterval(interval));
    gatcIntervals.clear();

    // Guardar estado vacío en localStorage solo si no se especifica lo contrario
    if (!skipSave) {
        saveConfiguration();
    }
    
    // Flash de confirmación visual
    gridAnimationInProgress = true;
    gridAnimationStep = 2;
    gridAnimationProgress = 0;
    gridFlashCount = 0;

    // Si se especifica limpiar el teclado, actualizar la variable de visibilidad
    if (clearBioKeyb) {
        bioKeybVisible = false;
    }
}

// Inicializar la interfaz de usuario después de cargar
window.addEventListener('load', () => {
    initTerminalConsole();
    controlsVisible = false;
    toggleControlPanels(false);
    initSlotsPanel(); // Inicializar el panel de slots después de que el DOM esté listo
    updateSlotsPanelUI(); // Asegurar que la UI de slots esté actualizada después de cargar slots de localStorage
});

// Por si el documento ya está cargado
if (document.readyState === 'complete') {
    initTerminalConsole();
    controlsVisible = false;
    toggleControlPanels(false);
    initSlotsPanel();
    updateSlotsPanelUI();
}

// Inicialización de la consola terminal
function initTerminalConsole() {
    const terminalInput = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    
    if (!terminalInput || !output) {
        console.error('Terminal elements not found');
        return;
    }
    
    // Limpiar listeners existentes
    const newTerminalInput = terminalInput.cloneNode(true);
    terminalInput.parentNode.replaceChild(newTerminalInput, terminalInput);
    
    newTerminalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const command = newTerminalInput.value.trim();
            if (command) {
                // Crear div para el comando
                const cmdDiv = document.createElement('div');
                cmdDiv.className = 'terminal-command';
                cmdDiv.textContent = `> ${command}`;
                output.appendChild(cmdDiv);
                
                // Procesar comando
                processTerminalCommand(command);
                
                // Limpiar input y mantener el foco
                newTerminalInput.value = '';
                newTerminalInput.focus();
            }
        } else if (event.key === 'Escape') {
            toggleTerminal(false);
            event.preventDefault();
        }
    });
    
    // Mensaje de bienvenida
        const welcomeDiv = document.createElement('div');
        welcomeDiv.innerHTML = 'Consola de bioPrint. Escribe <b>help</b> para ver los comandos disponibles.';
        output.appendChild(welcomeDiv);
}

// Función para cargar configuración desde datos
async function applyConfigurationFromData(configData) {
    console.log("applyConfigurationFromData llamada con:", JSON.parse(JSON.stringify(configData)));
    if (!configData || !configData.grid) { // Se mantiene la validación de grid, pero se enfocará en panels
        console.error("Formato de configuración inválido: falta configData o configData.grid");
        return false;
    }
    
    // Limpiar los paneles actuales y sus comportamientos
    clearAllPanels(true, true); // Limpiar todo, incluyendo teclado, antes de cargar un estado completo
    gatcIntervals.forEach(interval => clearInterval(interval));
    gatcIntervals.clear();
    
    console.log("Paneles en la configuración a aplicar:", configData.panels);
    if (!configData.panels || !Array.isArray(configData.panels)) {
        console.error("Error en applyConfigurationFromData: configData.panels no es un array o no existe.");
        // Aunque no haya paneles, el grid y la cámara podrían haberse restaurado, por lo que podríamos retornar true
        // o false dependiendo de si consideramos esto un fallo total.
        // Por ahora, si no hay paneles para cargar, es posible que el slot estuviera "vacío" de paneles.
        // Se procederá a cargar el resto (grid, cámara, etc.)
    }

    // Restaurar configuración de bioFX si existe
    if (configData.bioFX) {
        const colorHex = '#' + configData.bioFX.color.toString(16).padStart(6, '0');
        colorPicker.value = colorHex;
        blendTypePicker.value = configData.bioFX.blendType.toString();
        intensitySlider.value = configData.bioFX.intensity.toString();
        glowSlider.value = configData.bioFX.glow.intensity.toString();
        glowRadiusSlider.value = configData.bioFX.glow.radius.toString();
        glowThresholdSlider.value = configData.bioFX.glow.threshold.toString();
        updateBioFXEffect();
        console.log("Configuración de bioFX aplicada.");
    }

    // Actualizar la división del grid solo si es diferente
    const newDivisions = configData.grid.divisions;
    if (typeof newDivisions === 'number' && newDivisions !== currentDivisions) {
        console.log(`Actualizando grid de ${currentDivisions} a ${newDivisions} divisiones`);
        currentDivisions = newDivisions;
        updateGrid(newDivisions); // updateGrid se encarga de scene.remove(currentGrid) y scene.add(newGrid)
    } else {
        // Si las divisiones son las mismas, aún es necesario asegurarse de que el grid actual exista o se regenere.
        // Esto es importante si clearAllPanels eliminó el grid, o si es la carga inicial.
        // La función updateGrid puede manejar esto si se llama incluso con las mismas divisiones.
        console.log("Divisiones del grid sin cambios, asegurando regeneración del grid si es necesario.");
        updateGrid(currentDivisions); 
    }
    
    // Restaurar posición y zoom de la cámara si existen en la configuración
    if (configData.cameraPosition) {
        camera.position.set(
            configData.cameraPosition.x,
            configData.cameraPosition.y,
            configData.cameraPosition.z
        );
        console.log("Posición de cámara aplicada.");
    }
    
    if (typeof configData.cameraZoom === 'number') {
        camera.zoom = configData.cameraZoom;
        // camera.updateProjectionMatrix(); // adjustCameraToGrid lo hará implicitamente si es necesario, o updateGrid
        console.log("Zoom de cámara aplicado.");
    }
    adjustCameraToGrid(); // Siempre ajustar la cámara después de cambiar grid o zoom.

    // Restaurar el estado del teclado según la configuración guardada
    // Es importante hacer esto ANTES de recrear los paneles de usuario,
    // para que el teclado (si estaba visible) no sea borrado por clearAllPanels y luego no recreado.
    if (configData.bioKeybVisible !== undefined) {
        bioKeybVisible = !!configData.bioKeybVisible;
    }
    if (bioKeybVisible) {
        await loadBioKeyb(true); // Cargar teclado sin guardar configuración, si estaba visible
        console.log("Teclado bioKeyb restaurado según configuración.");
    }

    // Encontrar el número de orden más alto en la configuración de paneles de usuario
    let maxOrderNumber = 0;
    if (configData.panels && Array.isArray(configData.panels)) {
        configData.panels.forEach(panel => {
            // Considerar solo paneles que no son del teclado para el panelOrderCounter
            // (aunque al cargar un slot, los paneles del teclado deberían venir de la config si bioKeybVisible era true)
            const orderNum = parseInt(panel.orderNumber);
            if (!isNaN(orderNum) && orderNum > maxOrderNumber) {
                maxOrderNumber = orderNum;
            }
        });
    }
    panelOrderCounter = maxOrderNumber + 1;
    console.log('panelOrderCounter reiniciado a:', panelOrderCounter, 'basado en los paneles del slot.');
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        console.error("Error Crítico en applyConfigurationFromData: No se pudieron obtener los parámetros del grid después de la actualización.");
        return false; // Fallo si no podemos obtener parámetros del grid para los paneles.
    }
    
    // Recrear los paneles guardados (que no son del teclado, ya que el teclado se maneja con loadBioKeyb)
    if (configData.panels && Array.isArray(configData.panels)) {
        for (const panelInfo of configData.panels) {
            console.log("Procesando panelInfo para recreación:", panelInfo);
            // Asegurar que el número de orden es un entero válido
            const orderNumber = parseInt(panelInfo.orderNumber);
            if (isNaN(orderNumber)) {
                console.warn('PanelInfo con número de orden inválido, omitiendo:', panelInfo.orderNumber);
                continue;
            }

            // Crear panel base
            const panel = {
                group: null,
                minCellIndex: panelInfo.minCellIndex,
                maxCellIndex: panelInfo.maxCellIndex,
                orderNumber: orderNumber,
                showOrderNumber: panelInfo.showOrderNumber !== undefined ? panelInfo.showOrderNumber : globalShowNumbers,
                hasText: panelInfo.behavior?.hasText || false,
                // Añadir más propiedades por defecto si es necesario o si vienen de panelInfo
                selected: panelInfo.selected || false,
                navigateToSlot: panelInfo.navigateToSlot // Preservar asignación de navegación
            };
            
            updatePanelGeometryAndPosition(panel, currentGridParams);
            
            if(panel.group) {
                scene.add(panel.group);
                panels.push(panel); // Añadir a la lista global de paneles
                
                // Restaurar comportamiento del panel
                if (panelInfo.behavior) {
                    if (panelInfo.behavior.hasText) {
                        panel.hasText = true; // Asegurar que está marcado
                        const textState = {
                            text: panelInfo.behavior.textContent || '',
                            lines: panelInfo.behavior.messageBuffer || [],
                            maxCharsPerLine: panelInfo.behavior.maxLines || TEXT_CONFIG.defaultMaxCharsPerLine,
                            cursorPosition: 0,
                            isEditing: false,
                            scrollOffset: 0,
                            isPassword: panelInfo.behavior.isPassword || false,
                            realText: (panelInfo.behavior.isPassword && panelInfo.behavior.textContent) ? panelInfo.behavior.textContent : ''
                        };
                        panelTextState.set(panel, textState);
                        
                        createPanelText(panel, currentGridParams.cellSize); // Crea la estructura visual del texto
                        // Establecer el texto con el contenido guardado, manejando el caso de contraseña
                        if (textState.isPassword) {
                            setPanelText(panel, '*'.repeat(textState.realText.length), currentGridParams.cellSize);
                        } else {
                            setPanelText(panel, textState.text, currentGridParams.cellSize); 
                        }
                        console.log(`Texto restaurado para panel P${orderNumber}. Contenido: ${textState.isPassword ? '(contraseña)' : textState.text}`);
                    }

                    if (panelInfo.behavior.isGATCActive) {
                        // Para restaurar GATC, necesitamos asegurar que el panel esté configurado como texto primero
                        if (!panel.hasText) panel.hasText = true;
                        if (!panelTextState.has(panel)) createPanelText(panel, currentGridParams.cellSize); 

                        handleGATCCommand({ 
                            appendChild: () => {}, 
                            innerHTML: ''
                        }, panel);
                        console.log(`GATC restaurado para panel P${orderNumber}`);
                    }

                    if (panelInfo.behavior.modelData && panelInfo.behavior.modelData.modelUrl) {
                        const { modelUrl, isRotating, rotationSpeed } = panelInfo.behavior.modelData;
                        console.log(`Restaurando modelo ${modelUrl} para panel P${orderNumber}`);
                        await loadModelToPanel(panel, modelUrl, currentGridParams.cellSize).then(() => {
                            if (isRotating) {
                                // toggleModelRotation invierte el estado. Si queremos que esté rotando, y empieza sin rotar, llamamos una vez.
                                // Asumimos que loadModelToPanel podría o no iniciar la rotación. Es más seguro setearlo explícitamente.
                                if (!panel.modelData.isRotating) toggleModelRotation(panel); 
                            }
                            if (rotationSpeed) {
                                setModelRotationSpeed(panel, rotationSpeed);
                            }
                            console.log(`Modelo ${modelUrl} restaurado y configurado en panel P${orderNumber}. Rotando: ${panel.modelData.isRotating}, Vel: ${rotationSpeed}`);
                        }).catch(err => console.error(`Error al restaurar modelo para panel P${orderNumber}:`, err));
                    }

                    if (panelInfo.behavior.genomData) {
                        panel.genomData = panelInfo.behavior.genomData;
                        // Aquí necesitaríamos una función para RECREAR la visualización del genoma si es necesario
                        // Por ahora, solo restauramos los datos. La visualización podría requerir una llamada explícita.
                        // Ejemplo: await recreateGenomVisuals(panel, currentGridParams.cellSize);
                        console.log(`GenomData restaurado para panel P${orderNumber}`);
                    }
                     if (panelInfo.behavior.codonData) { // Asumiendo que codonData se guarda en behavior
                        panel.codonData = panelInfo.behavior.codonData;
                        await loadCodonToPanel(panel, currentGridParams.cellSize);
                        console.log(`CodonData restaurado para panel P${orderNumber}`);
                    }
                }
                
                createPanelOrderLabel(panel); // Crear etiqueta de orden (visible o no según globalShowNumbers y panel.showOrderNumber)
                
                if (panel.selected) {
                    // panel.selected = true; // ya debería estar seteado desde la creación del objeto panel
                    updatePanelColor(panel);
                }
                console.log(`Panel P${orderNumber} completamente recreado y añadido a la escena.`);
            } else {
                console.warn(`No se pudo crear el grupo para panelInfo:`, panelInfo);
            }
        }
    }
    
    // Verificar y ajustar el contador global de paneles de USUARIO si es necesario después de cargar.
    // Esto asegura que los nuevos paneles creados manualmente obtengan un número de orden correcto.
    const userPanels = panels.filter(p => !p.isKeyboardKey);
    const actualMaxUserOrder = Math.max(0, ...userPanels.map(p => parseInt(p.orderNumber) || 0));
    panelOrderCounter = actualMaxUserOrder + 1;
    console.log('panelOrderCounter final ajustado a:', panelOrderCounter, 'después de cargar todos los paneles del slot.');
    
    console.log("applyConfigurationFromData completado exitosamente.");
    return true;
}

// Función para actualizar la lista de estados guardados en la interfaz
function updateScreenStatesList() {
    const statesList = document.getElementById('savedStatesList');
    if (!statesList) return;
    
    // Limpiar lista actual
    statesList.innerHTML = '';
    
    // Agregar cada estado guardado a la lista
    savedScreenStates.forEach((stateJson, index) => {
        try {
            const state = JSON.parse(stateJson);
            const date = state.date ? new Date(state.date).toLocaleString() : `Estado ${index + 1}`;
            
            const li = document.createElement('li');
            li.className = 'saved-state-item';
            
            // Texto del estado con fecha y número de paneles
            const stateText = document.createElement('span');
            stateText.textContent = `${date} (${state.panels?.length || 0} paneles)`;
            li.appendChild(stateText);
            
            // Botón para cargar este estado
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Cargar';
            loadBtn.onclick = () => loadScreenState(index);
            li.appendChild(loadBtn);
            
            statesList.appendChild(li);
        } catch (e) {
            console.error("Error al procesar estado guardado:", e);
        }
    });
}

// Variable global para controlar visibilidad de números
let globalShowNumbers = false;

// Función para alternar la visibilidad de los números de los paneles
function togglePanelNumbers() {
    // Cambiar estado global
    globalShowNumbers = !globalShowNumbers;
    
    // Aplicar a todos los paneles existentes
    panels.forEach(panel => {
        panel.showOrderNumber = globalShowNumbers;
        createPanelOrderLabel(panel);
    });
    
    // Mensaje de confirmación
    console.log(`Números de panel ${globalShowNumbers ? 'mostrados' : 'ocultados'}`);
}

// Función para mostrar u ocultar la consola terminal
function toggleTerminal(show) {
    const terminal = document.getElementById('terminal-console');
    if (!terminal) return;
    
    // Verificar si hay algún panel con texto activo
    const hasActiveText = panels.some(panel => panel.hasText && panel.isEditing);
    
    if (hasActiveText) {
        // Si hay texto activo, no permitir mostrar la terminal
        terminal.style.display = 'none';
        terminalVisible = false;
        return;
    }
    
    terminalVisible = show !== undefined ? show : !terminalVisible;
    terminal.style.display = terminalVisible ? 'block' : 'none';
    
    if (terminalVisible) {
        const input = document.getElementById('terminal-input');
        if (input) {
            input.focus();
            input.value = '';
        }
    }
}

// Función para procesar comandos de la consola
function processTerminalCommand(command) {
    const [cmd, ...args] = command.trim().split(' ');
    const output = document.getElementById('terminal-output');

    if (!output) {
        console.error('Terminal output element not found');
        return;
    }

    switch (cmd.toLowerCase()) {
        case 'help':
            showHelp(output);
            break;
        case 'zeng':
            setColorEffect(0x007dff, parseFloat(intensitySlider.value), parseInt(blendTypePicker.value)); // R0 G125 B255
            showSuccess('Efecto Zeng activado', output);
            break;
        case 'boris':
            setColorEffect(0x00ff00, parseFloat(intensitySlider.value), parseInt(blendTypePicker.value)); // Verde Matrix R0 G255 B0
            showSuccess('Efecto Matrix activado', output);
            break;
        case 'ann':
            setColorEffect(0x00e1ff, parseFloat(intensitySlider.value), parseInt(blendTypePicker.value)); // R0 G225 B255
            showSuccess('Efecto Ann activado', output);
            break;
        case 'select':
            selectPanels(args, output);
            break;
        case 'show':
            showPanelNumbers(true, output);
            break;
        case 'hide':
            hidePanelNumbers(output);
            break;
        case 'list':
            listPanels(output);
            break;
        case 'clear':
            clearTerminal(output);
            break;
        case 'delete':
            deletePanels(args, output);
            break;
        case 'logo':
            mapLogo(args, output);
            break;
        case 'apps':
            mapApps(args, output);
            break;
        case 'txt':
            handleTextCommand(args, output);
            break;
        case 'terms':
            handleTermsCommand(output);
            break;
        case 'model':
            if (args.length > 0) {
                switch(args[0].toLowerCase()) {
                    case 'rotate':
                        handleModelRotation(output);
                        break;
                    case 'speed':
                        handleModelSpeed(args.slice(1), output);
                        break;
                    case 'angle':
                        if (args.length < 2) {
                            showError('Especifique el ángulo en grados (0-360)', output);
                            return;
                        }
                        const angle = parseFloat(args[1]);
                        if (isNaN(angle)) {
                            showError('El ángulo debe ser un número', output);
                            return;
                        }
                        const panel = panels.find(p => p.selected);
                        if (!panel) {
                            showError('Seleccione un panel con modelo 3D', output);
                            return;
                        }
                        setModelRotation(panel, (angle * Math.PI) / 180);
                        showSuccess(`Rotación ajustada a ${angle}°`, output);
                        break;
                    default:
                        handleModelCommand(args, output);
                }
            } else {
                handleModelCommand(args, output);
            }
            break;
        case 'genom':
            handleGenomCommand(output);
            break;
        case 'gatc':
            if (handleGATCCommand(output)) {
                showSuccess('Secuencia GATC activada en el panel seleccionado', output);
            }
            break;
        case 'gtac': // Alias para gatc
            if (handleGATCCommand(output)) {
                showSuccess('Secuencia GATC activada en el panel seleccionado', output);
            }
            break;
        case 'splice':
            handleSpliceCommand(output);
            break;
        case 'index':
        case 'reindex':
            const count = reindexPanels();
            showSuccess(`Paneles reindexados (${count} paneles)`, output);
            // Mostrar el índice actual
            const indexDiv = document.createElement('div');
            indexDiv.innerHTML = panels.map(p => 
                `Panel #${p.orderNumber}: [${p.minCellIndex.x},${p.minCellIndex.y}] a [${p.maxCellIndex.x},${p.maxCellIndex.y}]`
            ).join('<br>');
            output.appendChild(indexDiv);
            break;
        case 'pass':
            handlePassCommand(output);
            break;
        case 'codon':
            handleCodonCommand(output);
            break;
        case 'stack':
            handleStackCommand(output);
            break;
        case 'flash':
            handleFlashCommand(output);
            break;
        default:
            showError(`Comando desconocido: ${cmd}. Escribe 'help' para ver comandos disponibles.`, output);
    }
    
    // Scroll al final
    output.scrollTop = output.scrollHeight;
}

// Funciones auxiliares para los comandos
function showHelp(output) {
    const helpText = `
Comandos disponibles:

    select <n>     Selecciona el panel número n
    show           Muestra los números de los paneles
    hide           Oculta los números de los paneles
    list           Lista todos los paneles
    clear          Limpia la terminal
    delete <n>     Elimina el panel número n
    logo           Crea un logo en el panel seleccionado
    apps           Crea un grid de iconos de aplicaciones
    txt            Añade texto al panel seleccionado
    model          Crea un modelo 3D en el panel seleccionado
    genom          Crea una visualización de ADN en el panel
    codon          Crea un modelo 3D de transcripción genética
    gatc           Muestra una secuencia GATC animada
    splice         Inicia proceso de splicing genético
    stack          Inicia proceso de stack genético
    flash          Hace parpadear el panel seleccionado
    help           Muestra esta ayuda
`;
    
    showSuccess(helpText, output);
}

function selectPanels(args, output) {
    if (args.length === 0 || args[0] === 'all') {
        // Seleccionar todos los paneles
        panels.forEach(panel => {
            panel.selected = true;
            updatePanelColor(panel);
        });
        showSuccess(`${panels.length} paneles seleccionados`, output);
        return;
    }
    
    // Deseleccionar todos los paneles primero
    panels.forEach(panel => {
        panel.selected = false;
        updatePanelColor(panel);
    });
    
    // Analizar los argumentos para determinar qué paneles seleccionar
    const panelsToSelect = new Set();
    
    for (const arg of args) {
        if (arg.includes('-')) {
            // Es un rango: "1-5"
            const [start, end] = arg.split('-').map(n => parseInt(n));
            for (let i = start; i <= end; i++) {
                panelsToSelect.add(i);
            }
        } else {
            // Es un número individual
            panelsToSelect.add(parseInt(arg));
        }
    }
    
    // Buscar y seleccionar los paneles por número de orden
    let selected = 0;
    panels.forEach(panel => {
        if (panelsToSelect.has(panel.orderNumber)) {
            panel.selected = true;
            updatePanelColor(panel);
            selected++;
        }
    });
    
    showSuccess(`${selected} paneles seleccionados`, output);
}

function showPanelNumbers(show, output) {
    globalShowNumbers = true;
    panels.forEach(panel => {
        panel.showOrderNumber = true;
        createPanelOrderLabel(panel);
    });
    showSuccess('Números de panel mostrados', output);
}

function hidePanelNumbers(output) {
    globalShowNumbers = false;
    panels.forEach(panel => {
        panel.showOrderNumber = false;
        createPanelOrderLabel(panel);
    });
    showSuccess('Números de panel ocultados', output);
}

function listPanels(output) {
    if (panels.length === 0) {
        showInfo('No hay paneles en el diseño actual', output);
        return;
    }
    
    const listDiv = document.createElement('div');
    listDiv.innerHTML = `<div><b>Paneles (${panels.length}):</b></div>`;
    
    // Ordenar paneles por número
    const sortedPanels = [...panels].sort((a, b) => {
        const aNum = parseInt(a.orderNumber) || 0;
        const bNum = parseInt(b.orderNumber) || 0;
        return aNum - bNum;
    });

    sortedPanels.forEach(panel => {
        const panelInfo = document.createElement('div');
        const size = {
            width: panel.maxCellIndex.x - panel.minCellIndex.x + 1,
            height: panel.maxCellIndex.y - panel.minCellIndex.y + 1
        };
        panelInfo.textContent = `Panel #${panel.orderNumber}: [${panel.minCellIndex.x},${panel.minCellIndex.y}] a [${panel.maxCellIndex.x},${panel.maxCellIndex.y}] - ${size.width}x${size.height} celdas${panel.selected ? ' (Seleccionado)' : ''}`;
        listDiv.appendChild(panelInfo);
    });

    // Mostrar el próximo número disponible
    const nextDiv = document.createElement('div');
    nextDiv.innerHTML = `<br>Próximo número disponible: ${panelOrderCounter}`;
    listDiv.appendChild(nextDiv);
    
    output.appendChild(listDiv);
}

function clearTerminal(output) {
    output.innerHTML = '';
}

function deletePanels(args, output) {
    if (args.length === 0) {
        showError('Especifique qué paneles eliminar: all, selected, o números', output);
        return;
    }
    
    if (args[0] === 'all') {
        clearAllPanels();
        return;
    }
    
    if (args[0] === 'selected') {
        const selectedPanels = panels.filter(p => p.selected);
        const count = selectedPanels.length;
        
        if (count === 0) {
            showInfo('No hay paneles seleccionados para eliminar', output);
            return;
        }
        
        // Guardar números que serán eliminados
        const deletedNumbers = selectedPanels.map(p => parseInt(p.orderNumber)).sort((a, b) => a - b);
        
        // Eliminar los paneles seleccionados
        panels = panels.filter(panel => {
            if (panel.selected) {
                if (panel.group) {
                    scene.remove(panel.group);
                    while (panel.group.children.length > 0) {
                        const child = panel.group.children[0];
                        panel.group.remove(child);
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                }
                return false;
            }
            return true;
        });

        // Ordenar los paneles restantes por número
        panels.sort((a, b) => parseInt(a.orderNumber) - parseInt(b.orderNumber));

        // Actualizar números inmediatamente
        let currentNumber = 1;
        panels.forEach(panel => {
            if (parseInt(panel.orderNumber) > currentNumber) {
                // Este panel necesita un nuevo número
                panel.orderNumber = currentNumber;
                if (panel.showOrderNumber) {
                    if (panel.orderLabel && panel.group) {
                        panel.group.remove(panel.orderLabel);
                        panel.orderLabel = null;
                    }
                    createPanelOrderLabel(panel);
                }
            }
            currentNumber = parseInt(panel.orderNumber) + 1;
        });

        // Actualizar el contador global
        panelOrderCounter = panels.length + 1;
        
        // Mostrar información detallada
        const deletedInfo = deletedNumbers.join(', ');
        showSuccess(`Paneles eliminados: ${deletedInfo}. Numeración reajustada inmediatamente.`, output);
        return;
    }
}

// Funciones para mostrar mensajes en la consola
function showError(message, output) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'terminal-error';
    errorDiv.textContent = message;
    output.appendChild(errorDiv);
}

function showSuccess(message, output) {
    const successDiv = document.createElement('div');
    successDiv.className = 'terminal-success';
    successDiv.textContent = message;
    output.appendChild(successDiv);
}

function showInfo(message, output) {
    const infoDiv = document.createElement('div');
    infoDiv.textContent = message;
    output.appendChild(infoDiv);
}

// Variables para detectar la escena
let sceneInitialized = false;

// Inicializar la aplicación después de mostrar el splash screen
function initializeApp() {
    if (sceneInitialized) return;
    
    // Configuración de la escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Negro

    // Variables para recordar la configuración inicial de la cámara
    const initialCameraState = {
        position: null,
        zoom: null,
        distance: null
    };
}

// Reemplazar la función mapLogo existente
function mapLogo(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length !== 1) {
        showError('Selecciona exactamente un panel para el logo', output);
        return;
    }

    const panel = selectedPanels[0];
    showInfo('Aplicando logo al panel...', output);

    loadTexture(
        './public/img/bioprint_logo.png',
        (texture) => {
            if (panel.fillMesh) {
                // Crear los materiales con textura
                panel.textureMaterials = createPanelMaterials(texture);
                
                // Aplicar el material inicial
                panel.fillMesh.material = panel.textureMaterials.normal;

                // Actualizar UVs para ajustar la textura con fit horizontal
                const geometry = panel.fillMesh.geometry;
                const uvAttribute = geometry.attributes.uv;
                
                // Obtener dimensiones
                const imageAspect = texture.image.width / texture.image.height;
                const panelWidth = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
                const panelHeight = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
                const panelAspect = panelWidth / panelHeight;
                
                // Calcular escalado para fit horizontal
                const scaleY = panelAspect / imageAspect;
                const offsetY = (1 - scaleY) / 2;
                
                // Aplicar transformación UV
                for (let i = 0; i < uvAttribute.count; i++) {
                    const u = uvAttribute.getX(i);
                    const v = uvAttribute.getY(i);
                    uvAttribute.setXY(
                        i,
                        u, // Mantener coordenada U para fit horizontal
                        offsetY + (v * scaleY) // Ajustar V para mantener proporción
                    );
                }
                
                uvAttribute.needsUpdate = true;
                panel.hasTexture = true; // Marcar que el panel tiene textura
                
                // Forzar actualización
                if (typeof render === 'function') {
                    render();
                }
                
                showSuccess('Logo aplicado exitosamente', output);
            } else {
                showError('El panel no tiene una malla para aplicar la textura', output);
            }
        },
        (error) => {
            showError(`No se pudo cargar el logo: ${error.message}`, output);
        }
    );
}

// Nueva función para manejar el comando de texto
function handleTextCommand(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para agregar texto', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para editar texto', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
    
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Marcar el panel como contenedor de texto
    panel.hasText = true;
    
    // Crear o actualizar el contenedor de texto
    createPanelText(panel, currentGridParams.cellSize);
    
    // Cerrar la terminal antes de activar el modo de edición
    toggleTerminal(false);
    
    // Activar modo de edición
    startTextEditing(panel, currentGridParams.cellSize);
    
    // Agregar listeners de teclado
    const handleKeyPress = (event) => {
        handleTextInput(panel, event, currentGridParams.cellSize);
    };
    
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            stopTextEditing(panel);
            document.removeEventListener('keypress', handleKeyPress);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    
    document.addEventListener('keypress', handleKeyPress);
    document.addEventListener('keydown', handleEscape);
}

// Función para manejar el comando "terms" - mostrar términos y condiciones
function handleTermsCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para mostrar los términos y condiciones', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para mostrar los términos', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
    
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Marcar el panel como contenedor de texto
    panel.hasText = true;
    
    // Crear texto con términos y condiciones extensos
    const termsText = `TÉRMINOS Y CONDICIONES DE USO DEL BIOMETRICS SYSTEM

IMPORTANTE: LEA DETENIDAMENTE ESTOS TÉRMINOS Y CONDICIONES ANTES DE USAR EL SISTEMA.

1. RECOPILACIÓN DE DATOS BIOMÉTRICOS
Al usar este sistema, usted acepta que podemos recopilar, procesar, almacenar y utilizar sus datos biométricos, incluyendo pero no limitado a: huellas dactilares, escaneos faciales, reconocimiento de voz, patrones de retina, muestras de ADN, y cualquier otro dato biológico único que pueda ser utilizado para crear un modelo biométrico personalizado.

2. USO DE LOS DATOS
Sus datos biométricos serán utilizados para:
   a. Desarrollar y mejorar modelos de aprendizaje automático
   b. Identificación y autenticación personalizada
   c. Investigación médica y científica
   d. Análisis estadístico y demográfico
   e. Desarrollo de productos y servicios nuevos
   f. Cualquier otro propósito que consideremos apropiado en el futuro

3. COMPARTIR DATOS
Nos reservamos el derecho de compartir sus datos biométricos con:
   a. Afiliados y socios comerciales
   b. Instituciones de investigación y universidades
   c. Agencias gubernamentales cuando sea requerido por ley
   d. Terceros que adquieran nuestra compañía o activos
   e. Proveedores de servicios que nos asisten en nuestras operaciones

4. SEGURIDAD DE DATOS
Aunque implementamos medidas de seguridad razonables, no podemos garantizar que sus datos biométricos estén completamente seguros contra accesos no autorizados, filtración de datos, alteración o destrucción.

5. ALMACENAMIENTO Y RETENCIÓN
Sus datos biométricos serán almacenados por tiempo indefinido, incluso después de que usted deje de utilizar nuestros servicios o solicite la eliminación de su cuenta.

6. CONSENTIMIENTO IRREVOCABLE
Al aceptar estos términos, usted otorga un consentimiento irrevocable para el uso de sus datos biométricos como se describe en este documento. Este consentimiento sobrevive a la terminación de su relación con nosotros.

7. CAMBIOS EN LA POLÍTICA
Nos reservamos el derecho de modificar estos términos en cualquier momento sin previo aviso. Su uso continuado del sistema constituye la aceptación de dichos cambios.

8. LIMITACIÓN DE RESPONSABILIDAD
No seremos responsables por ningún daño directo, indirecto, incidental, especial o consecuente que resulte del uso o la imposibilidad de usar nuestro sistema, o de la pérdida, mal uso o alteración de sus datos biométricos.

9. LEY APLICABLE
Estos términos se regirán e interpretarán de acuerdo con las leyes del país donde se encuentra nuestra sede principal, sin tener en cuenta sus principios de conflicto de leyes.

10. DISPUTAS
Cualquier disputa relacionada con estos términos o el uso de sus datos biométricos será resuelta exclusivamente mediante arbitraje vinculante en el lugar designado por nuestra compañía.

11. EXPERIMENTACIÓN
Usted reconoce y acepta que podemos utilizar sus datos biométricos para experimentos científicos, médicos o tecnológicos sin notificación adicional o compensación.

12. MODELOS DE IA
Los modelos de inteligencia artificial creados utilizando sus datos biométricos serán propiedad exclusiva de nuestra compañía y podrán ser utilizados para cualquier propósito, incluyendo la creación de réplicas digitales o físicas de sus características biológicas.

13. COMERCIALIZACIÓN
Podemos utilizar los resultados derivados del análisis de sus datos biométricos con fines comerciales, incluyendo pero no limitado a la venta de productos y servicios personalizados basados en sus características biológicas únicas.

14. TRANSFERENCIA INTERNACIONAL
Sus datos biométricos pueden ser transferidos y procesados en países distintos al suyo, que pueden tener leyes de protección de datos menos estrictas.

15. RENUNCIA DE DERECHOS
Al aceptar estos términos, usted renuncia a cualquier derecho a revisar, aprobar, detener o restringir el uso de sus datos biométricos por nuestra parte.

AL CONTINUAR USANDO ESTE SISTEMA, USTED CONFIRMA QUE HA LEÍDO, ENTENDIDO Y ACEPTADO ESTOS TÉRMINOS Y CONDICIONES EN SU TOTALIDAD.`;
    
    // Aplicar el texto al panel
    setPanelText(panel, termsText, currentGridParams.cellSize);
    
    // Mostrar mensaje de éxito
    showSuccess('Términos y condiciones cargados en el panel seleccionado', output);
}

// Exportar funciones para controlar los efectos desde la consola
window.setColorEffect = setColorEffect;

// Función para mostrar/ocultar todos los paneles de control
function toggleControlPanels(show) {
    const controlsPanel = document.getElementById('controls');
    const bioFXPanel = document.getElementById('bioFX-panel');
    const slotsPanel = document.getElementById('slots-panel'); // Obtener el panel de slots
    
    if (show === undefined) {
        // Si no se especifica, alternar basado en el estado actual
        show = controlsPanel.style.display === 'none';
    }
    
    controlsPanel.style.display = show ? 'block' : 'none';
    bioFXPanel.style.display = show ? 'block' : 'none';
    if (slotsPanel) slotsPanel.style.display = show ? 'block' : 'none'; // Mostrar/ocultar panel de slots
}

// Mostrar/ocultar paneles con la tecla V
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'v') {
        toggleControlPanels();
    }
});

// Ocultar paneles inicialmente
toggleControlPanels(false);

// Función auxiliar para verificar si un punto está dentro de un panel
function isPanelInSelectionBox(panel, left, right, top, bottom, camera) {
    if (!panel.group) return false;
    
    // Obtener las esquinas del panel en coordenadas de mundo
    const { minCellIndex, maxCellIndex } = panel;
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) return false;
    
    const { cellSize, halfWidth, halfHeight } = currentGridParams;
    
    // Convertir índices de celda a coordenadas de mundo
    const worldCorners = [
        new THREE.Vector3(
            -halfWidth + minCellIndex.x * cellSize,
            -halfHeight + minCellIndex.y * cellSize,
            0
        ),
        new THREE.Vector3(
            -halfWidth + maxCellIndex.x * cellSize,
            -halfHeight + maxCellIndex.y * cellSize,
            0
        ),
        new THREE.Vector3(
            -halfWidth + maxCellIndex.x * cellSize,
            -halfHeight + minCellIndex.y * cellSize,
            0
        ),
        new THREE.Vector3(
            -halfWidth + minCellIndex.x * cellSize,
            -halfHeight + maxCellIndex.y * cellSize,
            0
        )
    ];
    
    // Verificar si alguna esquina está dentro del área de selección
    for (const corner of worldCorners) {
        const screenPos = corner.clone().project(camera);
        const x = (screenPos.x + 1) * window.innerWidth / 2;
        const y = (-screenPos.y + 1) * window.innerHeight / 2;
        
        if (x >= left && x <= right && y >= top && y <= bottom) {
            return true;
        }
    }
    
    return false;
}

// Función para empujar paneles que están en conflicto
function pushOverlappingPanels(movingPanel, gridParams) {
    const { cellsX, cellsY } = gridParams;
    const pushedPanels = new Set();
    let somethingMoved;
    
    do {
        somethingMoved = false;
        
        // Verificar cada panel para ver si necesita ser empujado
        panels.forEach(panel => {
            if (panel === movingPanel || pushedPanels.has(panel)) return;
            
            // Verificar solapamiento
            const conflictX = !(movingPanel.maxCellIndex.x < panel.minCellIndex.x - 1 || 
                              movingPanel.minCellIndex.x > panel.maxCellIndex.x + 1);
            const conflictY = !(movingPanel.maxCellIndex.y < panel.minCellIndex.y - 1 || 
                              movingPanel.minCellIndex.y > panel.maxCellIndex.y + 1);
            
            if (conflictX && conflictY) {
                // Calcular la dirección de empuje
                const centerX1 = (movingPanel.minCellIndex.x + movingPanel.maxCellIndex.x) / 2;
                const centerY1 = (movingPanel.minCellIndex.y + movingPanel.maxCellIndex.y) / 2;
                const centerX2 = (panel.minCellIndex.x + panel.maxCellIndex.x) / 2;
                const centerY2 = (panel.minCellIndex.y + panel.maxCellIndex.y) / 2;
                
                const dx = centerX2 - centerX1;
                const dy = centerY2 - centerY1;
                
                // Determinar la dirección principal de empuje
                let pushX = 0, pushY = 0;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                    // Empujar horizontalmente
                    pushX = dx > 0 ? 2 : -2;
                } else {
                    // Empujar verticalmente
                    pushY = dy > 0 ? 2 : -2;
                }
                
                // Calcular nueva posición
                const newMinX = panel.minCellIndex.x + pushX;
                const newMaxX = panel.maxCellIndex.x + pushX;
                const newMinY = panel.minCellIndex.y + pushY;
                const newMaxY = panel.maxCellIndex.y + pushY;
                
                // Verificar límites del grid
                if (newMinX >= 0 && newMaxX < cellsX && newMinY >= 0 && newMaxY < cellsY) {
                    // Actualizar posición
                    panel.minCellIndex.x = newMinX;
                    panel.maxCellIndex.x = newMaxX;
                    panel.minCellIndex.y = newMinY;
                    panel.maxCellIndex.y = newMaxY;
                    
                    // Actualizar visualización
                    updatePanelGeometryAndPosition(panel, gridParams);
                    
                    // Marcar que hubo movimiento
                    somethingMoved = true;
                    pushedPanels.add(panel);
                    
                    // Iniciar animación de flash
                    panel.flashProgress = 0;
                    panel.shouldFlash = true;
                    panelsFlashing.add(panel);
                }
            }
        });
    } while (somethingMoved);
    
    return pushedPanels.size > 0;
}

// Modificar la sección de colisión en el evento mouseup
renderer.domElement.addEventListener('mouseup', (event) => {
    // ... existing code ...
    
    // Verificar colisiones usando la función checkCollisions en lugar de hasCollision
    if (draggedPanel && checkCollisions(draggedPanel)) {
        // En lugar de restaurar la posición, intentar empujar los paneles
        const pushed = pushOverlappingPanels(draggedPanel, currentGridParams);
        
        if (!pushed) {
            // Si no se pudo empujar, restaurar posición original
            draggedPanel.group.position.set(
                dragStartPanelPosition.x, 
                dragStartPanelPosition.y, 
                draggedPanel.group.position.z
            );
            draggedPanel.minCellIndex.x = dragStartCellIndices.minX;
            draggedPanel.minCellIndex.y = dragStartCellIndices.minY;
            draggedPanel.maxCellIndex.x = dragStartCellIndices.maxX;
            draggedPanel.maxCellIndex.y = dragStartCellIndices.maxY;
        }
    }
    
    // ... existing code ...
});

// Variables para touch
let touchStartTime = 0;
let touchStartPosition = { x: 0, y: 0 };
const TOUCH_CLICK_THRESHOLD = 10; // píxeles de tolerancia para considerar un click
const TOUCH_CLICK_TIME = 300; // milisegundos máximos para considerar un click

// Variables para two-finger drag (equivalente a click derecho)
let isTwoFingerDrag = false;
let twoFingerStartPosition = { x: 0, y: 0 };
let previousTouchDistance = 0;
let touchStartTimes = new Map(); // Para rastrear el tiempo de inicio de cada toque
const TWO_FINGER_THRESHOLD = 100; // ms para considerar dos toques como simultáneos

// Desactivar completamente los controles táctiles por defecto
controls.enableTouchMovement = false;
controls.touches = {
    ONE: null,
    TWO: null
}

// Configuración adicional para prevenir gestos táctiles
controls.enablePan = false;
controls.enableRotate = false;
controls.enableZoom = false;

// Manejar eventos táctiles
renderer.domElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
    const currentTime = Date.now();
    
    // Registrar tiempo de inicio para cada toque
    Array.from(event.touches).forEach(touch => {
        touchStartTimes.set(touch.identifier, currentTime);
    });
    
    if (event.touches.length === 2) {
        // Verificar si los dos toques son casi simultáneos
        const touchTimes = Array.from(touchStartTimes.values());
        const timeDiff = Math.abs(touchTimes[0] - touchTimes[1]);
        
        if (timeDiff < TWO_FINGER_THRESHOLD) {
            // Two-finger drag - equivalente a click derecho
            isTwoFingerDrag = true;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Calcular el punto medio entre los dos dedos
            twoFingerStartPosition = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            
            // Calcular distancia inicial entre dedos
            previousTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Simular evento de mousedown con botón derecho
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: twoFingerStartPosition.x,
                clientY: twoFingerStartPosition.y,
                button: 2, // 2 = botón derecho
                buttons: 2,
                bubbles: true,
                cancelable: true
            });
            event.target.dispatchEvent(mouseEvent);
        }
    } else if (event.touches.length === 1) {
        // Single touch - click normal
        const touch = event.touches[0];
        touchStartPosition = { x: touch.clientX, y: touch.clientY };
        touchStartTime = currentTime;
        
        // Simular evento de mousedown con botón izquierdo
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0, // 0 = botón izquierdo
            buttons: 1,
            bubbles: true,
            cancelable: true
        });
        event.target.dispatchEvent(mouseEvent);
    }
}, { passive: false });

// Función para manejar el comando splice
async function handleSpliceCommand(output) {
    try {
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length === 0) {
            showError("Debes seleccionar al menos un panel para el proceso de splice.", output);
        return;
    }
    
    const panel = selectedPanels[0];
        const currentGridParams = getCurrentGridParams();
        
        // Marcar el panel como contenedor de texto
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
        
        // Crear panel de progreso
        const progressPanel = createProgressPanel(panel, currentGridParams);
        panels.push(progressPanel);
        updatePanelGeometryAndPosition(progressPanel, currentGridParams);
        
        // Mensajes detallados sobre ingeniería bioquímica
    const SELECTED_MESSAGES = [
        "Iniciando análisis preliminar del genoma...",
        "Cargando bases de datos genómicas locales...",
        "Conectando con servidores de referencia genómica...",
        "Verificando integridad de secuencias de ADN...",
        "Analizando estructura primaria del genoma...",
        "Identificando regiones codificantes...",
        "Escaneando secuencias reguladoras...",
        "Detectando elementos transponibles...",
        "Analizando contenido GC...",
        "Identificando islas CpG...",
        "Mapeando sitios de metilación...",
        "Verificando modificaciones epigenéticas...",
        "Analizando estructura de la cromatina...",
        "Identificando regiones hipersensibles a DNasa...",
        "Detectando fronteras de dominios topológicos...",
        "Analizando interacciones cromosómicas...",
        "Verificando organización nuclear...",
        "Identificando territorios cromosómicos...",
        "Calibrando enzimas de restricción...",
        "Optimizando temperatura de reacción...",
        "Ajustando concentraciones iónicas...",
        "Verificando pH del buffer...",
        "Analizando cofactores necesarios...",
        "Optimizando condiciones de reacción...",
        "Preparando solución tampón...",
        "Verificando estabilidad enzimática...",
        "Analizando sitios de corte potenciales...",
        "Identificando secuencias palindrómicas...",
        "Verificando especificidad de corte...",
        "Analizando productos secundarios...",
        "Optimizando eficiencia de corte...",
        "Verificando compatibilidad de extremos...",
        "Analizando topología del ADN...",
        "Identificando superenrollamiento...",
        "Verificando tensión torsional...",
        "Analizando estructura terciaria...",
        "Identificando regiones promotoras...",
        "Analizando elementos reguladores proximales...",
        "Verificando enhancers distales...",
        "Identificando silenciadores...",
        "Analizando elementos de respuesta...",
        "Verificando cajas TATA...",
        "Identificando iniciadores...",
        "Analizando elementos downstream...",
        "Verificando secuencias consenso...",
        "Identificando motivos conservados...",
        "Analizando factores de transcripción...",
        "Verificando sitios de unión...",
        "Identificando cofactores reguladores...",
        "Analizando complejos proteicos...",
        "Verificando marcos de lectura...",
        "Identificando codones de inicio...",
        "Analizando secuencias Kozak...",
        "Verificando codones de terminación...",
        "Identificando señales de poliadenilación...",
        "Analizando sitios de splicing...",
        "Verificando branch points...",
        "Identificando secuencias ESE/ESS...",
        "Analizando estructura secundaria...",
        "Verificando estabilidad de horquillas...",
        "Identificando pseudonudos...",
        "Analizando motivos estructurales...",
        "Verificando interacciones de base...",
        "Identificando regiones de apareamiento...",
        "Analizando estabilidad térmica...",
        "Verificando temperatura de fusión...",
        "Identificando regiones de alta estabilidad...",
        "Analizando contenido energético...",
        "Verificando energía libre de Gibbs...",
        "Identificando estados conformacionales...",
        "Analizando dinámica molecular...",
        "Verificando flexibilidad estructural...",
        "Identificando dominios funcionales...",
        "Analizando interfaces de interacción...",
        "Verificando sitios alostéricos...",
        "Identificando bolsillos catalíticos...",
        "Analizando residuos conservados...",
        "Verificando puentes de hidrógeno...",
        "Identificando interacciones hidrofóbicas...",
        "Analizando redes de contacto...",
        "Verificando empaquetamiento...",
        "Identificando centros activos...",
        "Analizando especificidad de sustrato...",
        "Verificando mecanismo catalítico...",
        "Identificando estados de transición...",
        "Analizando productos intermedios...",
        "Verificando eficiencia catalítica...",
        "Identificando inhibidores potenciales...",
        "Analizando modificaciones post-traduccionales...",
        "Verificando sitios de fosforilación...",
        "Identificando señales de localización...",
        "Analizando topología proteica...",
        "Verificando plegamiento proteico...",
        "Identificando dominios transmembrana...",
        "Analizando péptidos señal...",
        "Verificando secuencias de retención...",
        "Identificando motivos de sorting...",
        "Analizando estabilidad proteica...",
        "Verificando vida media...",
        "Identificando degrones...",
        "Analizando ubiquitinación...",
        "Verificando degradación...",
        "Preparando ligasa de ADN...",
        "Optimizando condiciones de ligación...",
        "Verificando compatibilidad de extremos...",
        "Analizando eficiencia de ligación...",
        "Monitoreando formación de enlaces...",
        "Verificando integridad del producto...",
        "Completando proceso de empalme..."
    ];

        // Inicializar estado del texto
        const state = panelTextState.get(panel);
        state.lines = ["Iniciando proceso de splice genético avanzado..."];
        setPanelText(panel, state.lines.join('\n'), currentGridParams.cellSize);

        let isRunning = true;
        let currentCycle = 0;

        // Función para manejar la tecla Escape
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                isRunning = false;
                cleanupProgressPanel(progressPanel, scene, panels);
                state.lines = ["Proceso de splice interrumpido."];
                setPanelText(panel, state.lines.join('\n'), currentGridParams.cellSize);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        document.addEventListener('keydown', handleEscape);

        function updateProgress() {
            if (!isRunning) return;

            const startTime = Date.now();
            const duration = 25000; // 25 segundos
            let lastProgress = 0;
            let lastMessageIndex = 0;
            let lastPulseTime = 0;

            function animate() {
                if (!isRunning) return;

            const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(100, (elapsed / duration) * 100);
            
            // Actualizar barra de progreso
                if (progress !== lastProgress) {
                    const pulse = Math.sin((currentTime - lastPulseTime) / 200) * 0.2;
                progressPanel.drawProgress(progress, pulse);
                    lastProgress = progress;
                }
                
                // Actualizar mensajes
                const messageIndex = Math.floor((progress / 100) * SELECTED_MESSAGES.length);
                if (messageIndex !== lastMessageIndex) {
                    state.lines = [SELECTED_MESSAGES[messageIndex]];
                    setPanelText(panel, state.lines.join('\n'), currentGridParams.cellSize);
                    lastMessageIndex = messageIndex;
                }
                
                if (progress < 100) {
                    requestAnimationFrame(animate);
                } else {
                    currentCycle++;
                    state.lines = [`Ciclo ${currentCycle} completado. Iniciando nuevo ciclo...`];
                    setPanelText(panel, state.lines.join('\n'), currentGridParams.cellSize);
                    setTimeout(() => updateProgress(), 1000);
                }
            }

            animate();
        }

        updateProgress();
        
    } catch (error) {
        console.error("Error en el comando splice:", error);
        showError("Error durante el proceso de splice: " + error.message, output);
    }
}

// Función para reindexar los paneles
function reindexPanels() {
    // Filtrar solo los paneles de usuario (no los del teclado)
    const userPanels = panels.filter(panel => !panel.isKeyboardKey);

    // Ordenar paneles de usuario por su número actual
    userPanels.sort((a, b) => parseInt(a.orderNumber) - parseInt(b.orderNumber));

    let currentNumber = 1; // Los paneles de usuario comienzan en P1
    let updatedCount = 0;

    userPanels.forEach(panel => {
        if (parseInt(panel.orderNumber) !== currentNumber) {
            panel.orderNumber = currentNumber;
            if (panel.showOrderNumber) {
                // Recrear la etiqueta con el nuevo número y prefijo "P"
                createPanelOrderLabel(panel); 
            }
            updatedCount++;
        }
        currentNumber++;
    });

    // Actualizar el contador global para el próximo panel de USUARIO
    // Se basa en la cantidad de paneles de usuario + 1
    panelOrderCounter = userPanels.length + 1; 
    
    if (updatedCount > 0) {
        console.log(`${updatedCount} paneles de usuario reindexados. Próximo panel de usuario será P${panelOrderCounter}`);
    }
    return updatedCount;
}

// Función para manejar el comando pass (campo de contraseña)
function handlePassCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para crear el campo de contraseña', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para el campo de contraseña', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
    
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Marcar el panel como contenedor de texto
    panel.hasText = true;
    
    // Crear o actualizar el contenedor de texto
    createPanelText(panel, currentGridParams.cellSize);
    
    // Configurar el estado del texto para modo contraseña
    const state = panelTextState.get(panel);
    if (state) {
        state.isPassword = true; // Marcar como campo de contraseña
        state.realText = ''; // Almacenar el texto real
        state.lines = [''];  // Inicializar con una línea vacía
        state.cursorPosition = 0;
    }
    
    // Activar modo de edición
    startTextEditing(panel, currentGridParams.cellSize);
    
    // Agregar listeners de teclado
    const handleKeyPress = (event) => {
        if (!currentEditingPanel) return;
        
        // Si la tecla es un carácter imprimible
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            
            // Guardar el carácter real en el estado
            const state = panelTextState.get(currentEditingPanel);
            if (state) {
                state.realText = (state.realText || '') + event.key;
            }
            
            // Dejar que handleTextInput maneje la visualización del asterisco
            handleTextInput(currentEditingPanel, event, currentGridParams.cellSize);
        } else {
            // Para teclas especiales (Backspace, etc.), actualizar también el texto real
            if (event.key === 'Backspace' && state && state.realText) {
                state.realText = state.realText.slice(0, -1);
            }
            handleTextInput(currentEditingPanel, event, currentGridParams.cellSize);
        }
    };
    
    const handleEscape = (event) => {
        if (event.key === 'Escape' && currentEditingPanel) {
            document.removeEventListener('keydown', handleKeyPress);
            document.removeEventListener('keydown', handleEscape);
            stopTextEditing(currentEditingPanel);
            currentEditingPanel = null;
        }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('keydown', handleEscape);
    
    showSuccess('Campo de contraseña creado. Presione ESC para finalizar.', output);
}

// Función para eliminar solo los paneles del teclado bioKeyb
function clearBioKeybOnly() {
    console.log("Eliminando solo el teclado bioKeyb...");
    
    // Filtrar los paneles que no son del teclado
    const nonKeyboardPanels = panels.filter(panel => !panel.isKeyboardKey);
    
    // Eliminar solo los paneles del teclado
    panels.forEach(panel => {
        if (panel.isKeyboardKey) {
            if (panel.group) {
                scene.remove(panel.group);
                // Limpiar geometrías de los hijos
                while(panel.group.children.length > 0) {
                    const child = panel.group.children[0]; 
                    panel.group.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            }
        }
    });

    // Reemplazar el array de paneles con los que no son del teclado
    panels = nonKeyboardPanels;
    
    // Actualizar el estado de visibilidad del teclado
    bioKeybVisible = false;
    
    // Flash de confirmación visual
    gridAnimationInProgress = true;
    gridAnimationStep = 2;
    gridAnimationProgress = 0;
    gridFlashCount = 0;
    
    // Guardar configuración
    saveConfiguration();
}

// Función para cargar el teclado bioKeyb
async function loadBioKeyb(skipSave = false) { // Convertir a async
    await ensureBioKeybModuleInitialized(); // ESPERAR a que la fuente y el estado estén listos

    console.log("Cargando teclado bioKeyb en la escena...");
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        console.error("No se pudieron obtener los parámetros del grid.");
        return;
    }
    
    // Obtener los paneles del teclado
    const keyboardPanels = createKeyboard();
    
    // Crear cada panel del teclado
    keyboardPanels.forEach(panelInfo => {
        const panelData = {
            group: null,
            minCellIndex: { x: panelInfo.minCellIndex.x, y: panelInfo.minCellIndex.y },
            maxCellIndex: { x: panelInfo.maxCellIndex.x, y: panelInfo.maxCellIndex.y },
            orderNumber: panelInfo.orderNumber,
            showOrderNumber: false,
            hasText: false,
            selected: false, // Asegurar que inicie no seleccionado
            hovered: false, // Asegurar que inicie no hover
            isKeyboardKey: true, // Marcar como tecla del teclado
            behavior: panelInfo.behavior, // Copiar el behavior completo
            materials: panelInfo.materials // Usar los materiales compartidos
        };

        // Personalizar el comportamiento del panel 55 (CTRL antes de F5)
        if (panelInfo.orderNumber === 55) {
            panelData.onPress = () => {
                console.log("Borrando teclado bioKeyb...");
                clearBioKeybOnly(); // Solo borrar los paneles del teclado
            };
    } else {
            panelData.onPress = panelInfo.onPress; // Mantener el comportamiento original para otras teclas
        }

        updatePanelGeometryAndPosition(panelData, currentGridParams);
        
        if(panelData.group) {
            // Asignar referencia al panel en los elementos del grupo
            panelData.group.children.forEach(child => {
                child.userData.panelDataRef = panelData;
            });
            
            scene.add(panelData.group);
            panels.push(panelData);
            
            // Mostrar el texto de la tecla
            createKeyLabel(panelData);
            
            // Animar aparición
                    panelData.flashProgress = 0;
                    panelData.shouldFlash = true;
                    panelsFlashing.add(panelData);
        }
    });
    
    console.log(`Teclado bioKeyb cargado: ${keyboardPanels.length} teclas creadas.`);
    
    // Centrar el teclado en pantalla
    centerGridInCamera();
    
    // Actualizar estado de visibilidad
    bioKeybVisible = true;
    
    // Guardar la configuración actual sólo si no se especifica lo contrario
    if (!skipSave) {
    saveConfiguration();
    }
}

// Función para detectar colisiones entre paneles
function detectCollision(panel1, panel2) {
    return !(panel1.maxCellIndex.x < panel2.minCellIndex.x || 
             panel1.minCellIndex.x > panel2.maxCellIndex.x ||
             panel1.maxCellIndex.y < panel2.minCellIndex.y ||
             panel1.minCellIndex.y > panel2.maxCellIndex.y);
}

// Función para verificar colisiones con todos los paneles
function checkCollisions(panelToCheck) {
    return panels.some(panel => 
        panel !== panelToCheck && 
        !panel.isBeingDeleted && 
        detectCollision(panelToCheck, panel)
    );
}

// Agregar un nuevo manejador de eventos mouseup que utilice checkCollisions
renderer.domElement.addEventListener('mouseup', (event) => {
    if (!draggedPanel) return;
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) return;
    
    // Verificar colisiones usando la función checkCollisions
    const hasCollisions = checkCollisions(draggedPanel);
    
    if (hasCollisions) {
        // Intentar empujar los paneles superpuestos
        const pushed = pushOverlappingPanels(draggedPanel, currentGridParams);
        
        if (!pushed && dragStartPanelPosition && dragStartCellIndices) {
            // Si no se pudo empujar, restaurar posición original
            draggedPanel.group.position.set(
                dragStartPanelPosition.x, 
                dragStartPanelPosition.y, 
                draggedPanel.group.position.z
            );
            draggedPanel.minCellIndex.x = dragStartCellIndices.minX;
            draggedPanel.minCellIndex.y = dragStartCellIndices.minY;
            draggedPanel.maxCellIndex.x = dragStartCellIndices.maxX;
            draggedPanel.maxCellIndex.y = dragStartCellIndices.maxY;
        }
    }
    
    // Limpiar variables de arrastre
    draggedPanel = null;
    dragStartPanelPosition = null;
    dragStartCellIndices = null;
});

// Agregar listener para imprimir teclas presionadas
document.addEventListener('keydown', (event) => {
    console.log(`Tecla presionada: ${event.key}`);
});

renderer.domElement.addEventListener('mouseup', (event) => {
    // Ignorar eventos táctiles
    if (event.pointerType === 'touch') return;

    // Convertir coordenadas del mouse a coordenadas normalizadas
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Recopilar todos los objetos seleccionables
    const allSelectable = [];
    panels.forEach(panel => {
        if (panel.group) {
            if (panel.fillMesh && !panel.fillMesh.userData.ignoreRaycast) {
                allSelectable.push(panel.fillMesh);
            }
            if (panel.borderLines) {
                panel.borderLines.forEach(line => {
                    if (!line.userData.ignoreRaycast) {
                        allSelectable.push(line);
        }
    });
}
        }
    });
    
    const intersects = raycaster.intersectObjects(allSelectable, false);
    
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let panelData = null;

        // Buscar el panel al que pertenece el objeto clickeado
        if (clickedObject.userData.panelDataRef) {
            panelData = clickedObject.userData.panelDataRef;
        } else {
            // Buscar en la jerarquía
            let currentObject = clickedObject;
            while (currentObject && !panelData) {
                if (currentObject.userData && currentObject.userData.panelDataRef) {
                    panelData = currentObject.userData.panelDataRef;
                    break;
                }
                currentObject = currentObject.parent;
            }
        }

        if (panelData) {
            // NUEVA LÓGICA: Verificar si el panel está asignado para navegar a un slot
            if (!panelData.isKeyboardKey && typeof panelData.navigateToSlot === 'number') {
                console.log(`Panel P${panelData.orderNumber} clickeado. Navegando a Slot ${panelData.navigateToSlot}.`);
                loadFromSlot(panelData.navigateToSlot);
                // Deseleccionar el panel después de la navegación para evitar acciones no deseadas si el slot carga paneles seleccionados.
                panelData.selected = false;
                updatePanelColor(panelData);
                return; // Terminar el procesamiento aquí para no interferir con la selección normal
            }

            if (panelData.isKeyboardKey && panelData.behavior && panelData.behavior.character) {
                // Es una tecla del teclado, solo ejecutar onPress y flash
                if (panelData.onPress) {
                    panelData.onPress();
                    console.log(`Tecla bioKeyb presionada: ${panelData.behavior.character}`);
                    
                    // Asegurar que no quede seleccionada
                    panelData.selected = false;
                    
                    // Efecto visual de flash
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelsFlashing.add(panelData);
                }
            } else {
                // Comportamiento normal para paneles regulares
                if (event.shiftKey) {
                    panelData.selected = !panelData.selected;
                } else {
                    // Deseleccionar otros paneles (excepto teclas del teclado)
                    panels.forEach(p => {
                        if (p !== panelData && !p.isKeyboardKey) {
                            p.selected = false;
                            updatePanelColor(p);
                        }
                    });
                    panelData.selected = true;
                }
                updatePanelColor(panelData);
            }
        }
    } else {
        // Click en el fondo
        if (!event.shiftKey) {
            panels.forEach(p => {
                if (p.selected) {
                    p.selected = false;
                    updatePanelColor(p);
                }
            });
        }
    }

    // Resto del código existente para manejo de selección y arrastre...
    if (isSelecting) {
        isSelecting = false;
        controls.enabled = true;
        selectionBox.style.display = 'none';

        const start3D = get3DPointOnGrid({clientX: startPoint.x, clientY: startPoint.y});
        const end3D = get3DPointOnGrid({clientX: endPoint.x, clientY: endPoint.y});

        const dragDistance = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
        );
        
        if (start3D && end3D && dragDistance > 5) {
            createPanelFromSelection(start3D, end3D);
        }
    }
    
    // Limpiar estados de arrastre
    if (isDraggingPanel) {
        isDraggingPanel = false;
        draggedPanel = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'auto';
    }
});

// ... existing code ...
// Eliminar todas las referencias a localStorage y configuración
function initializeKeyboard() {
    const defaultConfig = {
        divisions: 50,
        size: {
            width: 48.35257082896117,
            height: 24,
            maxSize: 24,
            cellSize: 0.48,
            cellsX: 101,
            cellsY: 50,
            adjustedWidth: 48.48,
            adjustedHeight: 24
        }
    };
    
    return defaultConfig;
}

// Usar configuración por defecto siempre
const keyboardConfig = initializeKeyboard();

// Eliminar todas las referencias a:
// localStorage.setItem('gridConfig', ...)
// localStorage.getItem('gridConfig')
// localStorage.setItem('gridConfig_backup', ...)
// localStorage.getItem('gridConfig_backup')
// saveKeyboardConfig
// loadKeyboardConfig
// saveBackup
// restoreFromBackup

// ... existing code ...

async function handleModelCommand(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para agregar el modelo', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para agregar el modelo', output);
        return;
    }
    
    if (args.length === 0) {
        showError('Especifique el nombre del modelo sin extensión (ej: corazon, hueso, dog, axolotl, discus)', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const modelName = args[0].toLowerCase();
    
    // Construir la ruta del modelo
    const modelUrl = `./models/${modelName}.obj`;
    
    try {
        // Verificar si ya existe un modelo en el panel
        const hasExistingModel = panel.group && panel.group.children.some(child => 
            child.userData && child.userData.isModel);

        // Mostrar mensaje de carga
        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = hasExistingModel 
            ? `Reemplazando modelo existente con ${modelName}...` 
            : `Cargando modelo ${modelName}...`;
        output.appendChild(loadingMessage);

        const success = await loadModelToPanel(panel, modelUrl, currentGrid.userData.cellSize);
        
        if (success) {
            // NO llamar a toggleModelRotation aquí, ya que invierte el estado
            // y el modelo ya está configurado para rotar en loadModelToPanel
            
            // Actualizar mensaje de carga a éxito
            loadingMessage.className = 'terminal-success';
            loadingMessage.textContent = hasExistingModel
                ? `Modelo ${modelName} reemplazado exitosamente en el panel #${panel.orderNumber}`
                : `Modelo ${modelName} cargado exitosamente en el panel #${panel.orderNumber}`;
            
            // Añadir información sobre controles
            const infoDiv = document.createElement('div');
            infoDiv.innerHTML = `
                <br>Controles disponibles:
                <br>- model rotate : Alternar rotación
                <br>- model speed [0.001-0.1] : Ajustar velocidad
            `;
            output.appendChild(infoDiv);

            // Guardar referencia del modelo en el panel
            panel.modelData = {
                name: modelName,
                url: modelUrl,
                isRotating: true,
                rotationSpeed: 0.01
            };
        } else {
            // Actualizar mensaje de carga a error
            loadingMessage.className = 'terminal-error';
            loadingMessage.textContent = `Error al cargar el modelo ${modelName}. Asegúrese de que el archivo ${modelName}.obj existe en la carpeta models/`;
        }
    } catch (error) {
        showError(`Error al cargar el modelo: ${error.message}`, output);
        console.error('Error detallado:', error);
    }
}

function handleModelRotation(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para modificar la rotación del modelo', output);
        return;
    }
    
    const panel = selectedPanels[0];
    
    // Verificar si hay un modelo cargado
    if (!panel.modelData || !panel.modelData.url) {
        showError('No hay un modelo cargado en el panel seleccionado', output);
        return;
    }
    
    const isRotating = toggleModelRotation(panel);
    
    // Actualizar el estado en panel.modelData
    panel.modelData.isRotating = isRotating;
    
    if (isRotating) {
        showSuccess('Rotación de modelo activada', output);
    } else {
        showInfo('Rotación de modelo desactivada', output);
    }
}

function handleModelSpeed(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para ajustar la velocidad de rotación', output);
        return;
    }
    
    const panel = selectedPanels[0];
    
    // Verificar si hay un modelo cargado
    if (!panel.modelData || !panel.modelData.url) {
        showError('No hay un modelo cargado en el panel seleccionado', output);
        return;
    }
    
    if (args.length === 0) {
        showError('Especifique la velocidad de rotación (entre 0.001 y 0.1)', output);
        return;
    }
    
    // Validar y convertir el argumento a número
    const speed = parseFloat(args[0]);
    if (isNaN(speed)) {
        showError('La velocidad debe ser un número entre 0.001 y 0.1', output);
        return;
    }
    
    // Establecer la velocidad
    setModelRotationSpeed(panel, speed);
    
    // Asegurarse de que la rotación esté activada
    if (!panel.modelData.isRotating) {
        toggleModelRotation(panel);
        panel.modelData.isRotating = true;
    }
    
    // Actualizar el valor en panel.modelData
    panel.modelData.rotationSpeed = speed;
    
    showSuccess(`Velocidad de rotación ajustada a ${speed}`, output);
}

// Función para manejar el comando genom
async function handleGenomCommand(output) {
    try {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para generar la red de proteínas', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para generar la red de proteínas', output);
        return;
    }
    
    const panel = selectedPanels[0];
        const currentGridParams = getCurrentGridParams();
        
        if (!currentGridParams) {
            showError('Error: No se pudo obtener la configuración del grid', output);
            return;
        }
        
        const success = await loadGenomToPanel(panel, currentGridParams.cellSize);
    
    if (success) {
        showSuccess(`Red de proteínas generada exitosamente en el panel #${panel.orderNumber}`, output);
    } else {
        showError('Error al generar la red de proteínas', output);
        }
    } catch (error) {
        console.error('Error en handleGenomCommand:', error);
        showError('Error inesperado al generar la red de proteínas', output);
    }
}

// Función para manejar el comando GATC
function handleGATCCommand(output) {
    try {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para mostrar la secuencia GATC', output);
        return false;
    }
    
    const panel = selectedPanels[0];
    
        // Limpiar intervalo existente si lo hay
    if (gatcIntervals.has(panel)) {
        clearInterval(gatcIntervals.get(panel));
    }
    
    panel.hasText = true;
        const currentGridParams = getCurrentGridParams();
        
        if (!currentGridParams) {
            showError('Error: No se pudo obtener la configuración del grid', output);
            return false;
        }
        
        // Calcular dimensiones
    const width = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
    const height = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
    const charsPerLine = Math.max(1, Math.floor(width * 1.8) - 2);
    const maxLines = Math.floor(height * 1.2);
    
    // Inicializar buffer circular
    panel.lineBuffer = Array(maxLines).fill('');
    let currentLine = '';
    
    function writeChar() {
            try {
        // Generar nuevo carácter
        const char = DNA_BASES[Math.floor(Math.random() * 4)];
        currentLine += char;
        
        // Si la línea está completa, agregarla al buffer
        if (currentLine.length >= charsPerLine) {
            panel.lineBuffer.shift();
            panel.lineBuffer.push(currentLine);
            currentLine = '';
            
            // Actualizar texto visible
            const visibleText = panel.lineBuffer.join('\n');
                    setPanelText(panel, visibleText, currentGridParams.cellSize);
                }
            } catch (error) {
                console.error('Error en writeChar:', error);
                clearInterval(gatcIntervals.get(panel));
        }
    }
    
    // Escribir caracteres cada 50ms
    const interval = setInterval(writeChar, 50);
    gatcIntervals.set(panel, interval);
    
    return true;
    } catch (error) {
        console.error('Error en handleGATCCommand:', error);
        showError('Error inesperado al activar la secuencia GATC', output);
        return false;
    }
}

// Función para manejar el comando codon
async function handleCodonCommand(output) {
    try {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
            showError('Seleccione un panel para mostrar el modelo de transcripción', output);
        return;
    }
    
        if (selectedPanels.length > 1) {
            showError('Seleccione solo un panel para mostrar el modelo de transcripción', output);
            return;
        }
        
        const panel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
        
        if (!currentGridParams) {
            showError('Error: No se pudo obtener la configuración del grid', output);
            return;
        }
        
        const success = await loadCodonToPanel(panel, currentGridParams.cellSize);
        
        if (success) {
            showSuccess(`Modelo de transcripción genética generado exitosamente en el panel #${panel.orderNumber}`, output);
        } else {
            showError('Error al generar el modelo de transcripción', output);
        }
    } catch (error) {
        console.error('Error en handleCodonCommand:', error);
        showError('Error inesperado al generar el modelo de transcripción', output);
    }
}

// En la función cleanupModels, antes del final:
    // Limpiar modelos de codón
    cleanupCodonModels();

async function handleStackCommand(output) {
    try {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length === 0) {
            showError("Debes seleccionar al menos un panel para el proceso de stack.", output);
            return;
        }

        const panel = selectedPanels[0];
        const currentGridParams = getCurrentGridParams();
        
        // Marcar el panel como contenedor de texto
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
        
        // Crear panel de progreso
        const progressPanel = createProgressPanel(panel, currentGridParams);
        panels.push(progressPanel);
        updatePanelGeometryAndPosition(progressPanel, currentGridParams);
        
        // Mensajes detallados sobre ingeniería bioquímica
        const SELECTED_MESSAGES = [
            "Iniciando análisis preliminar del genoma...",
            "Identificando secuencias de interés...",
            "Analizando patrones de expresión génica...",
            "Evaluando posibles sitios de inserción...",
            "Calculando parámetros de optimización...",
            "Preparando reactivos de edición...",
            "Inicializando sistema CRISPR-Cas9...",
            "Diseñando guías de ARN específicas...",
            "Sintetizando oligonucleótidos...",
            "Preparando vectores de expresión...",
            "Optimizando condiciones de cultivo...",
            "Iniciando proceso de transformación...",
            "Monitoreando eficiencia de transfección...",
            "Analizando integración del transgén...",
            "Evaluando expresión del gen reportero...",
            "Realizando PCR de confirmación...",
            "Secuenciando productos de PCR...",
            "Analizando alineamientos de secuencias...",
            "Verificando especificidad de edición...",
            "Evaluando efectos fuera del objetivo...",
            "Optimizando protocolo de selección...",
            "Aplicando presión selectiva...",
            "Monitoreando crecimiento celular...",
            "Analizando fenotipos resultantes...",
            "Evaluando estabilidad genómica...",
            "Realizando análisis de expresión...",
            "Cuantificando niveles de proteína...",
            "Evaluando actividad enzimática...",
            "Analizando interacciones proteicas...",
            "Estudiando vías de señalización...",
            "Evaluando respuesta celular...",
            "Analizando metabolismo celular...",
            "Monitoreando producción de metabolitos...",
            "Optimizando condiciones de fermentación...",
            "Escalando proceso de producción...",
            "Validando pureza del producto...",
            "Evaluando actividad biológica...",
            "Realizando pruebas de estabilidad...",
            "Optimizando formulación final...",
            "Completando documentación técnica...",
            "Proceso de stack completado exitosamente."
        ];

        // Inicializar estado del texto
        const state = panelTextState.get(panel);
        state.lines = ["Iniciando proceso de stack genético avanzado..."];
        state.scrollOffset = 0;
        setPanelText(panel, state.lines.join('\n'), currentGridParams.cellSize);

        // Calcular número máximo de líneas visibles basado en la altura del panel
        const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1) * currentGridParams.cellSize;
        const lineHeight = currentGridParams.cellSize * 0.8; // Altura aproximada de cada línea
        const maxVisibleLines = Math.floor(panelHeight / lineHeight) - 1; // -1 para dejar espacio para el borde

        let isRunning = true;
        let currentCycle = 0;

        // Función para manejar la tecla Escape
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                isRunning = false;
                cleanupProgressPanel(progressPanel, scene, panels);
                state.lines.push("Proceso de stack interrumpido.");
                if (state.lines.length > maxVisibleLines) {
                    state.scrollOffset = state.lines.length - maxVisibleLines;
                }
                const visibleLines = state.lines.slice(state.scrollOffset, state.scrollOffset + maxVisibleLines);
                setPanelText(panel, visibleLines.join('\n'), currentGridParams.cellSize);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        document.addEventListener('keydown', handleEscape);

        function updateProgress() {
            if (!isRunning) return;

            const startTime = Date.now();
            const duration = 25000; // 25 segundos
            let lastProgress = 0;
            let lastMessageIndex = 0;
            let lastPulseTime = 0;

            function animate() {
                if (!isRunning) return;

            const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(100, (elapsed / duration) * 100);
            
            // Actualizar barra de progreso
                if (progress !== lastProgress) {
                    const pulse = Math.sin((currentTime - lastPulseTime) / 200) * 0.2;
                progressPanel.drawProgress(progress, pulse);
                    lastProgress = progress;
                }
                
                // Actualizar mensajes (apilando)
                const messageIndex = Math.floor((progress / 100) * SELECTED_MESSAGES.length);
                if (messageIndex !== lastMessageIndex) {
                    // Mantener los mensajes anteriores y agregar el nuevo
                    state.lines.push(SELECTED_MESSAGES[messageIndex]);
                    
                    // Calcular el desplazamiento necesario para mantener visible la última línea
                    if (state.lines.length > maxVisibleLines) {
                        state.scrollOffset = state.lines.length - maxVisibleLines;
                    }
                    
                    // Mostrar solo las líneas visibles
                    const visibleLines = state.lines.slice(state.scrollOffset, state.scrollOffset + maxVisibleLines);
                    setPanelText(panel, visibleLines.join('\n'), currentGridParams.cellSize);
                    
                    lastMessageIndex = messageIndex;
                }
                
                if (progress < 100) {
                    requestAnimationFrame(animate);
                } else {
                    currentCycle++;
                    state.lines.push(`Ciclo ${currentCycle} completado. Iniciando nuevo ciclo...`);
                    if (state.lines.length > maxVisibleLines) {
                        state.scrollOffset = state.lines.length - maxVisibleLines;
                    }
                    const visibleLines = state.lines.slice(state.scrollOffset, state.scrollOffset + maxVisibleLines);
                    setPanelText(panel, visibleLines.join('\n'), currentGridParams.cellSize);
                    setTimeout(() => updateProgress(), 1000);
                }
            }

            animate();
        }

        updateProgress();
        
    } catch (error) {
        console.error("Error en el comando stack:", error);
        showError("Error durante el proceso de stack: " + error.message, output);
    }
}

async function handleFlashCommand(output) {
    try {
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length === 0) {
            showError("Debes seleccionar un panel para el efecto flash.", output);
        return;
    }
    
        // Obtener solo el último panel seleccionado
        const panel = selectedPanels[selectedPanels.length - 1];
        
        // Deseleccionar todos los paneles excepto el que vamos a hacer parpadear
        panels.forEach(p => {
            if (p !== panel) {
                p.selected = false;
            }
        });

        let isVisible = true;
        let originalColor = panel.fillMesh.material.color.clone();
        let originalOpacity = panel.fillMesh.material.opacity;
        let originalTextColor = null;
        let originalTextBackground = null;

        // Guardar colores originales del texto si existe
        if (panel.isTextContainer) {
    const state = panelTextState.get(panel);
    if (state) {
                originalTextColor = state.textColor;
                originalTextBackground = state.backgroundColor;
            }
        }

        function flash() {
            if (isVisible) {
                // Ocultar panel
                panel.fillMesh.material.opacity = 0;
                
                if (panel.isTextContainer) {
                    const state = panelTextState.get(panel);
            if (state) {
                        // Invertir colores del texto
                        state.textColor = 'rgba(0, 0, 0, 1)';
                        state.backgroundColor = 'rgba(255, 255, 255, 1)';
                        setPanelText(panel, state.lines.join('\n'), getCurrentGridParams().cellSize);
            }
                }
        } else {
                // Mostrar panel
                panel.fillMesh.material.color.copy(originalColor);
                panel.fillMesh.material.opacity = originalOpacity;
                
                if (panel.isTextContainer) {
                    const state = panelTextState.get(panel);
                    if (state) {
                        // Restaurar colores originales del texto
                        state.textColor = originalTextColor;
                        state.backgroundColor = originalTextBackground;
                        setPanelText(panel, state.lines.join('\n'), getCurrentGridParams().cellSize);
                    }
                }
            }

            isVisible = !isVisible;
            setTimeout(flash, 400); // Intervalo de 0.4 segundos
        }

        flash();
        
    } catch (error) {
        console.error("Error en el comando flash:", error);
        showError("Error durante el efecto flash: " + error.message, output);
    }
}

// NUEVA función para asegurar que initBioKeyb (carga de fuente y estado) se ejecute una vez
async function ensureBioKeybModuleInitialized() {
    if (!bioKeybModuleInitialized) {
        // El consoleEl puede ser opcional o definido aquí si es necesario.
        // Pasamos null si no es esencial para la carga de la fuente/estado inicial.
        await initBioKeyb(null); 
        bioKeybModuleInitialized = true;
        console.log("Módulo bioKeyb (fuente y estado) inicializado.");
    }
}

// ... existing code ...
// Función para limpiar un slot específico
function clearSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido para limpiar.`);
        return;
    }
    if (slots[slotIndex]) {
        slots[slotIndex] = null;
        console.log(`Slot ${slotIndex} limpiado.`);
        persistSlotsToLocalStorage(); // Guardar cambios en localStorage
        updateSlotsPanelUI(); // Actualizar la interfaz del panel de slots

        // Efecto flash para confirmar
        gridAnimationInProgress = true;
        gridAnimationStep = 2; // Solo paso de flash
        gridAnimationProgress = 0;
        gridFlashCount = 0;
    } else {
        console.log(`Slot ${slotIndex} ya está vacío.`);
    }
}

// Función para actualizar la interfaz del panel de slots
function updateSlotsPanelUI() {
    const slotsContainer = document.getElementById('slots-container');
    if (!slotsContainer) return;
    console.log('Actualizando UI del panel de slots. Datos actuales de slots:', slots);

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slotEntry = slotsContainer.querySelector(`.slot-entry[data-slot-index="${i}"]`);
        if (slotEntry) {
            const statusElement = slotEntry.querySelector('.slot-status');
            if (slots[i]) {
                try {
                    const config = JSON.parse(slots[i]);
                    const date = new Date(config.date || Date.now());
                    statusElement.textContent = `Guardado: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                    statusElement.title = `Guardado: ${date.toLocaleString()}\nPaneles: ${config.panels?.length || 0}, Divisiones: ${config.grid?.divisions || 'N/A'}`;
                } catch (e) {
                    statusElement.textContent = 'Error en datos';
                    statusElement.title = 'Los datos de este slot parecen corruptos.';
                }
            } else {
                statusElement.textContent = 'Vacío';
                statusElement.title = 'Este slot está vacío.';
            }
        }
    }
}

// Función para inicializar el panel de slots
function initSlotsPanel() {
    const slotsContainer = document.getElementById('slots-container');
    if (!slotsContainer) {
        console.error('El contenedor del panel de slots (slots-container) no fue encontrado.');
        return;
    }
    slotsContainer.innerHTML = ''; // Limpiar contenido previo

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slotEntry = document.createElement('div');
        slotEntry.className = 'slot-entry';
        slotEntry.setAttribute('data-slot-index', i);

        const label = document.createElement('span');
        label.className = 'slot-label';
        label.textContent = `Slot ${i}:`;
        slotEntry.appendChild(label);

        const status = document.createElement('span');
        status.className = 'slot-status';
        status.textContent = 'Vacío'; // Estado inicial
        slotEntry.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'slot-actions';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Guardar';
        saveBtn.addEventListener('click', () => saveToSlot(i));
        actions.appendChild(saveBtn);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Cargar';
        loadBtn.addEventListener('click', () => loadFromSlot(i));
        actions.appendChild(loadBtn);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Limpiar';
        clearBtn.className = 'clear-btn';
        clearBtn.addEventListener('click', () => clearSlot(i));
        actions.appendChild(clearBtn);

        slotEntry.appendChild(actions);
        slotsContainer.appendChild(slotEntry);
    }
    updateSlotsPanelUI(); // Actualizar con los estados actuales al inicializar
}

// Carga Inicial y UI relacionada con slots
window.addEventListener('load', () => {
    // ... (código existente de initTerminalConsole, toggleControlPanels, etc.)
    initSlotsPanel(); // Inicializar el panel de slots después de que el DOM esté listo
    loadSlotsFromLocalStorage(); // Asegurarse que slots está cargado ANTES de actualizar la UI
    updateSlotsPanelUI(); 
});

// Si el documento ya está cargado (para casos donde el script se carga después del evento load)
if (document.readyState === 'complete') {
    // ... (código existente de initTerminalConsole, toggleControlPanels, etc.)
    initSlotsPanel();
    loadSlotsFromLocalStorage(); // Asegurarse que slots está cargado ANTES de actualizar la UI
    updateSlotsPanelUI();
}

// Configuración de los iconos en la imagen
const ICON_GRID = {
    COLS: 5,
    ROWS: 4,
    ICON_SIZE: 1/5  // Cada icono ocupa 1/5 del ancho ya que tenemos 5 columnas
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
    
    // Materiales para las líneas de los paneles
    const lineMaterials = {
        normal: panelLineMaterialNormal,
        hover: panelLineMaterialHover,
        selected: panelLineMaterialSelected
    };
    
    // Llamar a la función del módulo bioApps
    createAppGrid(
        containerPanel,                // Panel contenedor
        createPanelFromBoundingBox,    // Función para crear paneles
        getCurrentGridParams,          // Función para obtener parámetros del grid
        lineMaterials,                 // Materiales para las líneas
        (createdPanels) => {           // Callback de éxito
            // Deseleccionar el panel contenedor
            containerPanel.selected = false;
            updatePanelColor(containerPanel);
            
            showSuccess(`¡Iconos de apps mapeados exitosamente! Se crearon ${createdPanels.length} paneles.`, output);
            
            // Forzar actualización de la escena
            if (typeof render === 'function') {
                render();
            }
        },
        (errorMessage) => {            // Callback de error
            showError(errorMessage, output);
        }
    );
}
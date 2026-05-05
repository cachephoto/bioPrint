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
import { initBioFX, setColorEffect, render as renderBioFX, setBloomEffect, setGlitchEffect, updateGlitchTime, setGlitchParameters, disableGlitch } from './bioFX.js';
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
import { handleLogoCommand, updateOnPanelMove, hasLogo, getLogoPanel, toggleLogo, createLogo, logoMeshExists } from './bioLOGO.js';
import { loadCodonToPanel, animateCodons, cleanupCodonModels } from './codonModel.js';
import { createProgressPanel, cleanupProgressPanel } from './bioLoad.js';
import { createAppGrid } from './bioApps.js';
import {
    MAX_SLOTS,
    loadSlotsFromLocalStorage,
    persistSlotsToLocalStorage,
    getSlots,
    getCurrentSlotIndex,
    setCurrentSlotIndex,
    saveToSlot as bioSlotsSaveToSlot,
    loadFromSlot as bioSlotsLoadFromSlot,
    clearSlot as bioSlotsClearSlot,
    navigateToNextSlot,
    navigateToPreviousSlot,
    hasSlotData,
    getSlotInfo
} from './bioSlots.js';
import { 
    initBioHUD, 
    createHUD, 
    destroyHUD, 
    isHUDActive, 
    getHUDScene, 
    getHUDGrid, 
    getHUDPanels, 
    addHUDPanel, 
    removeHUDPanel, 
    clearHUDPanels, 
    getHUDGridParams, 
    updateHUDGrid, 
    adjustHUDResolution, 
    setUpdateHUDPanelsCallback, 
    getHUDPlaneZ,
    HUD_PLANE_Z,
    updateDarkeningPlaneSize
} from './bioHUD.js';
import { 
    handleModalCommand, 
    updateModalPercentage, 
    getModalState, 
    cleanupModal, 
    cleanupAllModals,
    getModalBehaviorData,
    restoreModalFromBehavior
} from './bioModal.js';

/**
 * MÓDULO PRINCIPAL (main.js)
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Punto de entrada de la aplicación
 * - Gestión del ciclo de vida de la escena 3D (Scene, Camera, Renderer)
 * - Orquestación de todos los subsistemas (Texto, Modelos, FX, Teclado)
 * - Manejo de la terminal de comandos
 * - Loop principal de renderizado
 * 
 * Conexiones:
 * - Importa y coordina TODOS los módulos del sistema
 * - panelText.js: Gestión de texto editable en paneles
 * - panelModel.js: Carga y visualización de modelos 3D
 * - bioFX.js: Efectos post-procesamiento (Glitch, Bloom, Color)
 * - bioKeyb.js: Teclado virtual 3D
 * - bioLoad.js: Indicadores de carga
 * - bioApps.js: Grid de aplicaciones
 * - genomModel.js / codonModel.js: Modelos biológicos específicos
 * -----------------------------------------------------------------------------
 */

// Variables globales para controlar la visibilidad del teclado
let bioKeybVisible = false; // Controla si el teclado está visible o no
let bioKeybModuleInitialized = false; // NUEVA variable para rastrear la inicialización del módulo

// Mapeo de nombres científicos para los modelos
const modelScientificNames = {
    corazon: "HOMO SAPIENS SAPIENS",
    hueso: "BONE", 
    axolotl: "AMBYSTOMA MEXICANUM",
    discus: "DISK FISH",
    dog: "CANIS LUPUS FAMILIARIS",
    acot: "CRAY FISH",
    tort: "TRACHEMYS SCRIPTA ELEGANS",
    ham: "HAM",
    pollo: "FRIED CHICKEN",
    burg: "BURGUER MEAT"
};

// Variable global para controlar el estado de impresión
let isPrintingActive = false; // Controla si el proceso de impresión está activo

// Mapa para almacenar los intervalos de GATC
const gatcIntervals = new Map(); // Para gestionar los intervalos de animación GATC

// 🔥 CRITICAL FIX: Declarar variables del grid ANTES de usarlas
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

            // 🔥 CRITICAL FIX: Esperar a que el grid esté completamente listo antes de cargar
            // Esperar a que termine cualquier animación del grid y que esté en su escala correcta
            const waitForGridReady = () => {
                // Verificar que:
                // 1. El grid existe
                // 2. No hay animación en progreso
                // 3. Las divisiones están en 48 (escala final)
                // 4. El grid está en su escala final (scale = 1)
                const gridIsReady = currentGrid && 
                                   !gridAnimationInProgress && 
                                   currentDivisions === 48 &&
                                   Math.abs(currentGrid.scale.x - 1) < 0.01; // Escala final
                
                if (gridIsReady) {
                    console.log("Grid completamente listo, cargando slot 0...");
                    
                    // HUD desactivado por defecto - se activa con tecla P
                    
                    // Cargar el bioKeyb y luego el slot 0
                    setTimeout(async () => {
                        await loadBioKeyb(true); // Cargar teclado sin guardar configuración
                        bioKeybVisible = true; // Asegurar que el teclado esté marcado como visible
                        
                        // 🔥 Cargar estilo visual de bioFX (incluyendo resolución del grid)
                        loadBioFXVisualStyle();
                        
                        // Cargar slot 0 por defecto
                        const output = document.getElementById('terminal-output');
                        if (output) {
                            showInfo('Cargando slot 0 por defecto...', output);
                        }
                        loadFromSlot(0);
                    }, 100);
                } else {
                    // Reintentar después de un breve delay
                    setTimeout(waitForGridReady, 50);
                }
            };
            
            // Iniciar espera después de un pequeño delay para asegurar que el grid se haya actualizado
            setTimeout(waitForGridReady, 200);
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

// Hacer la cámara accesible globalmente para ajustes de clip plane
window.camera = camera;

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
// 🔥 CRITICAL FIX: Manejo de errores para WebGL context
let renderer;
try {
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000);
    document.body.appendChild(renderer.domElement);
    
    // Inicializar efectos bioFX
    initBioFX(renderer, scene, camera);
    
    // Inicializar módulo de HUD con referencias necesarias
    // Función para actualizar paneles del HUD cuando cambia la resolución
    function updateHUDPanelsAfterGridChange() {
        const hudGridParams = getHUDGridParams();
        if (!hudGridParams) {
            console.warn('updateHUDPanelsAfterGridChange: No se pueden obtener parámetros del grid HUD');
            return;
        }
        
        const hudPanels = getHUDPanels();
        console.log(`Actualizando ${hudPanels.length} paneles del HUD para la nueva resolución`);
        
        // Actualizar cada panel del HUD usando updatePanelGeometryAndPosition
        hudPanels.forEach(panelData => {
            if (panelData.group) {
                // Guardar estados antes de actualizar
                const wasSelected = panelData.selected;
                const wasHovered = panelData.hovered;
                
                // Actualizar geometría y posición del panel con los nuevos parámetros del grid
                updatePanelGeometryAndPosition(panelData, hudGridParams);
                
                // Asegurar que el panel esté en el hudScene y tenga la Z correcta
                const hudScene = getHUDScene();
                if (hudScene && panelData.group) {
                    // Asegurar que el panel esté en hudScene
                    if (!hudScene.children.includes(panelData.group)) {
                        // Si está en scene principal, removerlo
                        if (scene.children.includes(panelData.group)) {
                            scene.remove(panelData.group);
                        }
                        hudScene.add(panelData.group);
                    }
                    
                    // Asegurar posición Z correcta (relativa a hudScene)
                    panelData.group.position.z = 0.02;
                    // Asegurar renderOrder alto para que esté por encima de la cortina
                    panelData.group.renderOrder = 200;
                    panelData.group.traverse((child) => {
                        // Asegurar que todos los hijos, especialmente los bordes, tengan renderOrder alto
                        if (child.renderOrder !== undefined) {
                            child.renderOrder = 200;
                        }
                    });
                    // Asegurar explícitamente que los borderLines tengan renderOrder alto y posición Z correcta
                    if (panelData.borderLines) {
                        panelData.borderLines.forEach(borderLine => {
                            borderLine.renderOrder = 200;
                            borderLine.position.z = 0.1; // Posición Z mayor para estar por delante de la cortina (z=7)
                        });
                    }
                }
                
                // Restaurar estados
                panelData.selected = wasSelected;
                panelData.hovered = wasHovered;
                
                // Actualizar color y etiqueta
                updatePanelColor(panelData);
                createPanelOrderLabel(panelData);
            }
        });
        
        console.log(`Paneles del HUD actualizados exitosamente`);
    }
    
    initBioHUD({
        scene: scene,
        camera: camera,
        createGridSimple: createGridSimple,
        getCurrentGridParams: getCurrentGridParams,
        calculateGridSize: calculateGridSize,
        updatePanelGeometryAndPosition: updatePanelGeometryAndPosition,
        updatePanelColor: updatePanelColor,
        createPanelOrderLabel: createPanelOrderLabel
    });
    
    // Configurar callback para actualizar paneles del HUD cuando cambia la resolución
    setUpdateHUDPanelsCallback(updateHUDPanelsAfterGridChange);
} catch (error) {
    console.error('❌ Error crítico al crear WebGL Renderer:', error);
    console.error('Posibles causas:');
    console.error('1. WebGL no está disponible en este navegador');
    console.error('2. El contexto WebGL se perdió');
    console.error('3. Problemas con drivers de gráficos');
    
    // Mostrar mensaje de error al usuario
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,0,0,0.9); color: white; padding: 20px; border-radius: 8px; z-index: 10000; font-family: monospace; letter-spacing: 0.5px; text-align: center;';
    errorDiv.innerHTML = `
        <h2>❌ Error de WebGL</h2>
        <p>No se pudo inicializar el renderizador WebGL.</p>
        <p>Por favor, recarga la página o verifica que tu navegador soporte WebGL.</p>
        <p style="font-size: 12px; margin-top: 10px;">Error: ${error.message}</p>
    `;
    document.body.appendChild(errorDiv);
    
    // Intentar crear un renderer básico como fallback (aunque probablemente no funcione)
    throw error;
}

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

// 🔥 NUEVO: Funciones para guardar y cargar estilo visual de bioFX
function saveBioFXVisualStyle() {
    try {
        const visualStyle = {
            color: colorPicker.value,
            blendType: blendTypePicker.value,
            intensity: intensitySlider.value,
            glowIntensity: glowSlider.value,
            glowRadius: glowRadiusSlider.value,
            glowThreshold: glowThresholdSlider.value,
            gridDivisions: currentDivisions, // 🔥 NUEVO: Incluir resolución del grid
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('bioFX_visualStyle', JSON.stringify(visualStyle));
        console.log('✅ Estilo visual de bioFX guardado en localStorage:', visualStyle);
        
        // Feedback visual en el botón
        const saveButton = document.getElementById('bioFX-save-style');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = '✓ Guardado!';
            saveButton.style.backgroundColor = '#0ff';
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.backgroundColor = '#0f0';
            }, 1500);
        }
    } catch (error) {
        console.error('Error al guardar estilo visual de bioFX:', error);
        const saveButton = document.getElementById('bioFX-save-style');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = '✗ Error';
            saveButton.style.backgroundColor = '#f00';
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.backgroundColor = '#0f0';
            }, 1500);
        }
    }
}

function loadBioFXVisualStyle() {
    try {
        const savedStyle = localStorage.getItem('bioFX_visualStyle');
        if (!savedStyle) {
            console.log('No hay estilo visual guardado de bioFX');
            return false;
        }
        
        const visualStyle = JSON.parse(savedStyle);
        console.log('Cargando estilo visual de bioFX desde localStorage:', visualStyle);
        
        // 🔥 NUEVO: Restaurar resolución del grid primero (si existe y es diferente)
        // Solo actualizar si el grid ya está inicializado
        if (visualStyle.gridDivisions && typeof visualStyle.gridDivisions === 'number' && currentGrid) {
            const savedDivisions = visualStyle.gridDivisions;
            // Validar que esté en rango válido (2-50)
            if (savedDivisions >= 2 && savedDivisions <= 50 && savedDivisions !== currentDivisions) {
                console.log(`Restaurando resolución del grid: ${currentDivisions} → ${savedDivisions}`);
                currentDivisions = savedDivisions;
                updateGrid(savedDivisions);
            }
        }
        
        // Aplicar valores guardados de bioFX
        if (visualStyle.color) colorPicker.value = visualStyle.color;
        if (visualStyle.blendType) blendTypePicker.value = visualStyle.blendType;
        if (visualStyle.intensity) intensitySlider.value = visualStyle.intensity;
        if (visualStyle.glowIntensity) glowSlider.value = visualStyle.glowIntensity;
        if (visualStyle.glowRadius) glowRadiusSlider.value = visualStyle.glowRadius;
        if (visualStyle.glowThreshold) glowThresholdSlider.value = visualStyle.glowThreshold;
        
        // Aplicar los efectos bioFX
        updateBioFXEffect();
        
        console.log('✅ Estilo visual de bioFX (incluyendo resolución del grid) cargado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al cargar estilo visual de bioFX:', error);
        return false;
    }
}

// Event listener para el botón de guardar
const saveStyleButton = document.getElementById('bioFX-save-style');
if (saveStyleButton) {
    saveStyleButton.addEventListener('click', saveBioFXVisualStyle);
}

// Cargar estilo visual automáticamente al inicio (después de que los elementos estén listos)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(loadBioFXVisualStyle, 100);
    });
} else {
    setTimeout(loadBioFXVisualStyle, 100);
}

// 🔥 FUNCIONES DEL SISTEMA GLITCH
function startGlitchEffect(panel) {
    if (glitchActive) {
        stopGlitchEffect(); // Detener glitch anterior si existe
    }
    
    glitchActive = true;
    glitchPanel = panel;
    
    // Guardar estado actual de los efectos bioFX
    originalColorState = {
        color: parseInt(colorPicker.value.substring(1), 16),
        intensity: parseFloat(intensitySlider.value),
        blendType: parseInt(blendTypePicker.value)
    };
    
    console.log(`🔥 GLITCH ACTIVADO en panel #${panel.orderNumber}`);
    console.log(`💾 Estado original guardado:`, originalColorState);
    
    // Crear efecto flash optimizado en el panel
    startFlash(panel);
    
    // 🔥 CONFIGURAR PARÁMETROS DE REFRACCIÓN ROJA
    setGlitchParameters({
        rgbShift: 0.010,        // Desplazamiento RGB moderado
        scanlines: 0.6,         // Scanlines moderadas
        pixelation: 1.0,        // Sin pixelación, solo refracción
        digitalNoise: 0.3,      // Ruido digital sutil
        blockSize: 16.0,        // Bloques medianos para refracción
        distortion: 0.15        // Distorsión horizontal moderada
    });
    
    // Aplicar efecto rojo intenso constante
    setColorEffect(0xff0000, 1.2, 1); // Rojo, intensidad alta, multiply
    
    // Iniciar glitch tradicional de post-procesado
    let frameCount = 0;
    let glitchTime = 0;
    
    glitchInterval = setInterval(() => {
        frameCount++;
        glitchTime += 0.033; // Incrementar tiempo para el shader
        
        // 🔥 INTENSIDAD ALTA PARA EFECTO BLOCKY
        const baseIntensity = 0.8; // Aumentado para más blocky
        const variation = Math.sin(frameCount * 0.05) * 0.3; // Variación más amplia
        const currentIntensity = baseIntensity + variation;
        
        // 🔥 ACTUALIZAR TIEMPO DEL SHADER PARA ANIMACIONES
        updateGlitchTime(glitchTime);
        
        // 🔥 ACTIVAR EFECTO GLITCH DE POST-PROCESADO
        setGlitchEffect(currentIntensity, glitchTime);
        
        // 🔥 VARIAR PARÁMETROS PARA REFRACCIÓN DINÁMICA
        if (frameCount % 90 === 0) { // Cada 3 segundos para variaciones suaves
            // Cambiar intensidad de RGB shift aleatoriamente
            const newRgbShift = 0.008 + Math.random() * 0.010; // 0.008 a 0.018
            
            // Mantener sin pixelación, solo refracción
            const newPixelation = 1.0; // Sin pixelación
            
            // Cambiar tamaño de bloques de refracción
            const newBlockSize = 12 + Math.random() * 16; // 12 a 28 para refracción
            
            setGlitchParameters({
                rgbShift: newRgbShift,
                pixelation: newPixelation,
                blockSize: newBlockSize
            });
            
            console.log(`🔥 GLITCH: Parámetros actualizados - RGB: ${newRgbShift.toFixed(3)}, Pixel: ${newPixelation.toFixed(1)}, Bloques: ${newBlockSize.toFixed(1)}`);
        }
        
        // 🔥 PICOS DE DISTORSIÓN OCASIONALES
        if (frameCount % 180 === 0) { // Cada 6 segundos
            const spikeIntensity = 0.9 + Math.random() * 0.3; // 0.9 a 1.2
            setGlitchEffect(spikeIntensity, glitchTime);
            console.log(`🚨 PICO DE GLITCH - Intensidad: ${spikeIntensity.toFixed(2)}`);
            
            // Volver a normal después de 1 segundo
            setTimeout(() => {
                if (glitchActive) {
                    setGlitchEffect(currentIntensity, glitchTime);
                }
            }, 1000);
        }
        
        // 🔥 LOGS PERIÓDICOS (MENOS FRECUENTES)
        if (frameCount % 300 === 0) { // Cada 10 segundos
            console.log(`🔥 GLITCH TRADICIONAL Frame ${frameCount} - Post-procesado activo`);
        }
        
    }, 33); // ~30 FPS para suavidad
    
    console.log(`🚨 GLITCH TRADICIONAL INICIADO - Panel #${panel.orderNumber} - Post-procesado con RGB shift, scanlines y corrupción digital`);
}

function stopGlitchEffect() {
    if (!glitchActive) return;
    
    console.log(`🛑 DETENIENDO GLITCH CON ARTEFACTOS en panel #${glitchPanel?.orderNumber || 'desconocido'}`);
    
    glitchActive = false;
    
    // Detener el intervalo de glitch
    if (glitchInterval) {
        clearInterval(glitchInterval);
        glitchInterval = null;
    }
    
    // 🔥 DESACTIVAR EFECTO GLITCH DE POST-PROCESADO
    disableGlitch();
    
    // Restaurar estado original de color
    const colorHex = '#' + originalColorState.color.toString(16).padStart(6, '0');
    colorPicker.value = colorHex;
    blendTypePicker.value = originalColorState.blendType.toString();
    intensitySlider.value = originalColorState.intensity.toString();
    
    // Aplicar efectos restaurados
    setColorEffect(originalColorState.color, originalColorState.intensity, originalColorState.blendType);
    updateBioFXEffect();
    
    console.log(`✅ Estado bioFX y geometría restaurados:`, originalColorState);
    
    // Limpiar referencia al panel
    if (glitchPanel) {
        // Detener flash del panel
        glitchPanel.shouldFlash = false;
        panelsFlashing.delete(glitchPanel);
        glitchPanel = null;
    }
    
    console.log(`🔄 Glitch tradicional desactivado - post-procesado restaurado a estado original`);
}

function handleGlitchCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para preparar el efecto glitch', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para el efecto glitch', output);
        return;
    }
    
    const panel = selectedPanels[0];
    
    if (panel.glitchReady) {
        // Si el panel ya está preparado para glitch, desactivar
        panel.glitchReady = false;
        panel.shouldFlash = false;
        panelsFlashing.delete(panel);
        showSuccess(`Panel #${panel.orderNumber} - Glitch DESARMADO`, output);
    } else {
        // Preparar panel para glitch (modo durmiente)
        panel.glitchReady = true;
        
        // Efecto visual sutil optimizado para indicar que está preparado
        startFlash(panel);
        
        console.log(`🔥 Panel #${panel.orderNumber} PREPARADO para glitch (durmiente)`);
        showSuccess(`Panel #${panel.orderNumber} - Glitch ARMADO y durmiente`, output);
        
        // Mostrar instrucciones
        const instructionsDiv = document.createElement('div');
        instructionsDiv.innerHTML = `
            <br>🔥 <b>GLITCH DE REFRACCIÓN ROJA PREPARADO:</b>
            <br>• <b>Activación:</b> Haz CLICK en el panel #${panel.orderNumber}
            <br>• <b>Efecto:</b> Refracción en bloques + tinte rojo multiplicado
            <br>• <b>Duración:</b> INFINITA hasta click externo
            <br>• <b>Características:</b> Bloques que se desplazan, todo rojo, sin pixelación
            <br>• <b>Desactivar:</b> Click fuera del panel o tecla
            <br>• <b>Restauración:</b> Automática del post-procesado
        `;
        instructionsDiv.style.color = '#ff6666';
        output.appendChild(instructionsDiv);
    }
}

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
    if (event.key && event.key.toLowerCase() === 'v') {
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
    transparent: false, // Los bordes no son transparentes
    depthTest: true, // Respetar depth buffer
    depthWrite: true // Escribir en depth buffer para estar por encima
});
const panelLineMaterialHover = new THREE.LineBasicMaterial({ 
    color: 0xcccccc, // Gris claro
    linewidth: 1,
    transparent: false,
    depthTest: true,
    depthWrite: true
});
const panelLineMaterialSelected = new THREE.LineBasicMaterial({ 
    color: 0xffffff, // Blanco
    linewidth: 2, // Más grueso al seleccionar
    transparent: false,
    depthTest: true,
    depthWrite: true
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

// Variables para la animación del grid (ya declaradas arriba al inicio del archivo)

// Variables para la animación de paneles
const panelsFlashing = new Set(); // Conjunto de paneles actualmente en animación flash
const panelsResizing = new Set(); // Conjunto de paneles en animación de cambio de forma
let doubleFlashPending = new Map(); // Map para controlar el doble flash

// Función helper para iniciar flash (optimizada)
function startFlash(panelData) {
    if (!panelData) return;
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelData.flashMaterialsCloned = false; // Resetear flag al iniciar nuevo flash
    panelsFlashing.add(panelData);
}

// Función para iniciar un doble flash en un panel
function startDoubleFlash(panelData) {
    startFlash(panelData);
    doubleFlashPending.set(panelData, 1); // Indica que queda 1 flash adicional después del primero
}

// Función para manejar doble click/tap en un panel
function handlePanelDoubleClick(panelData) {
    if (panelData) {
        // MANEJO DE BOTONES MODAL: + y - (doble click/tap)
        if (panelData.isModalPlusButton || panelData.isModalMinusButton) {
            const currentGridParams = getCurrentGridParams();
            if (currentGridParams && panelData.containerPanel) {
                // Buscar el panel de porcentaje correspondiente
                const modalData = getModalState(panelData.containerPanel);
                if (modalData && modalData.divisions[panelData.modalIndex]) {
                    const percentagePanel = modalData.divisions[panelData.modalIndex].percentagePanel;
                    if (percentagePanel) {
                        // Determinar el cambio (+10 o -10)
                        const delta = panelData.isModalPlusButton ? 10 : -10;
                        updateModalPercentage(percentagePanel, delta, currentGridParams);
                        
                        // Flash visual SOLO en el botón clickeado (no en todos los paneles)
                        panelData.flashProgress = 0;
                        panelData.shouldFlash = true;
                        panelsFlashing.add(panelData);
                        
                        return; // Salir inmediatamente para evitar cualquier otro procesamiento
                    }
                }
            }
        }
        
        // Handle print buttons double tap
        if (panelData.isPrintButton && panelData.printButtonAction) {
            panelData.printButtonAction();
            return;
        }
        if (panelData.isPrintContinueButton && panelData.printButtonAction) {
            panelData.printButtonAction();
            return;
        }
        if (panelData.isPrintCancelButton && panelData.printButtonAction) {
            panelData.printButtonAction();
            return;
        }
        
        // NUEVA FUNCIONALIDAD: Doble click en botón I AGREE avanza scroll
        if (panelData.isAgreeButton && panelData.termsPanel) {
            const termsPanel = panelData.termsPanel;
            const textState = panelTextState.get(termsPanel);
            if (textState && textState.useWhiteScrollIndicators) {
                const currentGridParams = getCurrentGridParams();
                if (currentGridParams) {
                    // Calcular dimensiones del panel de términos
                    const panelHeight = (termsPanel.maxCellIndex.y - termsPanel.minCellIndex.y + 1);
                    const panelWidth = (termsPanel.maxCellIndex.x - termsPanel.minCellIndex.x + 1);
                    const width = panelWidth * currentGridParams.cellSize;
                    const height = panelHeight * currentGridParams.cellSize;
                    const paddingSize = currentGridParams.cellSize;
                    const textAreaHeight = height - (paddingSize * 2);
                    
                    // Calcular número máximo de líneas visibles
                    const isUniline = panelHeight <= 3;
                    const isTooSmall = textAreaHeight < (currentGridParams.cellSize * TEXT_CONFIG.fontSize * 0.8);
                    
                    let effectiveLineHeight;
                    if (isTooSmall || isUniline) {
                        effectiveLineHeight = panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                             panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                             panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                             TEXT_CONFIG.lineHeight;
                    } else {
                        effectiveLineHeight = TEXT_CONFIG.lineHeight;
                    }
                    
                    const maxVisibleLines = isUniline ? 1 : Math.max(1, Math.floor(textAreaHeight / (currentGridParams.cellSize * effectiveLineHeight)));
                    
                    // Avanzar scrollOffset en una pantalla
                    const newScrollOffset = Math.min(
                        textState.scrollOffset + maxVisibleLines,
                        Math.max(0, textState.lines.length - maxVisibleLines)
                    );
                    
                    // 🔥 CRITICAL: Asegurar que el panel de términos NO flashee al actualizar texto
                    const wasFlashing = termsPanel.shouldFlash;
                    const wasInFlashingSet = panelsFlashing.has(termsPanel);
                    
                    if (newScrollOffset !== textState.scrollOffset) {
                        textState.scrollOffset = newScrollOffset;
                        createPanelText(termsPanel, currentGridParams.cellSize);
                        console.log(`📜 Scroll de términos avanzado (doble click I AGREE): ${textState.scrollOffset}/${textState.lines.length - maxVisibleLines}`);
                    } else {
                        // Si ya está al final, volver al inicio
                        textState.scrollOffset = 0;
                        createPanelText(termsPanel, currentGridParams.cellSize);
                        console.log(`📜 Scroll de términos reiniciado al inicio (doble click I AGREE)`);
                    }
                    
                    // 🔥 CRITICAL: Flash visual en el botón I AGREE y el panel de términos
                    // Solo estos dos paneles deben flashear, no todos los paneles
                    startFlash(panelData);
                    
                    // También hacer flash en el panel de términos
                    termsPanel.flashProgress = 0;
                    termsPanel.shouldFlash = true;
                    panelsFlashing.add(termsPanel);
                    
                    return; // Salir para evitar otros comportamientos
                }
            }
        }
        
        // 🔥 NUEVA FUNCIONALIDAD: Doble click/tap en panel con modelo carga en viewer
        if (panelData.modelData && panelData.modelData.url && 
            !panelData.modelData.isViewer && !panelData.isViewer &&
            !panelData.isKeyboardKey) {
            
            // Buscar paneles viewer activos
            const viewerPanels = panels.filter(p => 
                p !== panelData && 
                p.isViewer && 
                p.modelData && 
                p.modelData.isViewer &&
                !p.isKeyboardKey
            );
            
            if (viewerPanels.length > 0) {
                const viewerPanel = viewerPanels[0];
                const sourceModelData = panelData.modelData;
                const currentGridParams = getCurrentGridParams();
                
                if (currentGridParams && sourceModelData.url) {
                    loadModelToPanel(viewerPanel, sourceModelData.url, currentGridParams.cellSize).then((success) => {
                        if (success) {
                            viewerPanel.modelData.name = sourceModelData.name;
                            viewerPanel.modelData.url = sourceModelData.url;
                            viewerPanel.modelData.isRotating = true;
                            viewerPanel.modelData.rotationSpeed = sourceModelData.rotationSpeed || 0.005;
                            viewerPanel.modelData.scientificName = sourceModelData.scientificName || modelScientificNames[sourceModelData.name] || null; // 🔥 NUEVO: Preservar o asignar nombre científico
                            
                            console.log(`🖼️ Modelo ${sourceModelData.name} cargado en viewer #${viewerPanel.orderNumber} (doble click/tap)`);
                            
                            // Flash visual en el panel con modelo y el viewer
                            panelData.flashProgress = 0;
                            panelData.shouldFlash = true;
                            panelsFlashing.add(panelData);
                            
                            viewerPanel.flashProgress = 0;
                            viewerPanel.shouldFlash = true;
                            panelsFlashing.add(viewerPanel);
                            
                            // Mostrar nombre científico en el panel libre más cercano al viewer
                            const closestFreePanel = findClosestFreePanel(viewerPanel);
                            if (closestFreePanel) {
                                const scientificName = modelScientificNames[sourceModelData.name];
                                
                                if (scientificName) {
                                    closestFreePanel.hasText = true;
                                    closestFreePanel.speciesPanel = true;
                                    closestFreePanel.speciesName = scientificName;
                                    createPanelText(closestFreePanel, currentGridParams.cellSize);
                                    setPanelText(closestFreePanel, scientificName, currentGridParams.cellSize);
                                    
                                    // Flash visual en el panel de especie
                                    closestFreePanel.flashProgress = 0;
                                    closestFreePanel.shouldFlash = true;
                                    panelsFlashing.add(closestFreePanel);
                                    
                                    console.log(`📄 Nombre científico "${scientificName}" mostrado en panel #${closestFreePanel.orderNumber} (doble click/tap, más cercano al viewer)`);
                                }
                            }
                        }
                    });
                    
                    return; // Salir para evitar otros comportamientos
                }
            } else {
                // Si no hay viewer, mostrar mensaje en consola
                console.log(`⚠️ No hay viewer activo. Usa el comando 'viewer' para crear uno.`);
            }
        }
        
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

// Variables globales para mantener estado de teclas modificadoras durante selección
let selectionModifierKeys = {
    shiftKey: false,
    ctrlKey: false,
    altKey: false
};

// Variable global para almacenar el último modelo clickeado desde la rejilla de "models"
let lastClickedModelFromGrid = {
    name: 'corazon', // Modelo por defecto
    url: './models/corazon.obj',
    scientificName: 'HOMO SAPIENS'
};

// 🔥 SISTEMA DE GLITCH INTENSO
let glitchActive = false;
let glitchInterval = null;
let glitchPanel = null;
let originalColorState = {
    color: 0x0096ff,
    intensity: 1.0,
    blendType: 1
};

// Variable para controlar la visibilidad de los controles
let controlsVisible = true;

// Variable para controlar la visibilidad de la consola terminal
let terminalVisible = false;

// Variables para almacenar estados de pantalla
let savedScreenStates = new Array(10).fill(null); // 10 slots para estados (0-9)
let lastSavedStateIndex = -1; // Último estado guardado

// NUEVAS variables y funciones para el sistema de SLOTS (Ctrl+Shift+Num y Ctrl+Num)
// Ahora usando bioSlots.js - MAX_SLOTS aumentado a 30
let slots; // Variable local que apunta a getSlots() del módulo
let currentSlotIndex = 0; // Variable local sincronizada con el módulo

// Wrapper para obtener slots (compatibilidad con código existente)
function getSlotsLocal() {
    if (!slots) {
        slots = getSlots();
    }
    return slots;
}

// Cargar slots persistentes al iniciar la aplicación (migración automática incluida)
loadSlotsFromLocalStorage();
slots = getSlots(); // Inicializar variable local
currentSlotIndex = getCurrentSlotIndex(); // Sincronizar índice

// Función para guardar el estado en un slot (Ctrl+Shift+Numero)
// Ahora usando bioSlots.js
async function saveToSlot(slotIndex) {
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
    
    // Función para trigger flash
    const triggerFlash = () => {
    gridAnimationInProgress = true;
    gridAnimationStep = 2; 
    gridAnimationProgress = 0;
    gridFlashCount = 0;
    };
    
    // Guardar usando el módulo bioSlots.js
    const success = bioSlotsSaveToSlot(slotIndex, config, updateSlotsPanelUI, triggerFlash);
    
    if (success) {
        slots = getSlots(); // Actualizar referencia local
    }
}

// Función para cargar el estado desde un slot (Ctrl+Numero)
// Ahora usando bioSlots.js con soporte para popups
async function loadFromSlot(slotIndex) {
    // Cargar configuración usando el módulo bioSlots.js
    const config = bioSlotsLoadFromSlot(slotIndex);
    
    if (!config) {
        console.warn(`Slot ${slotIndex} está vacío.`);
        // Indicación visual en el panel de slots
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
        console.log(`Cargando configuración desde Slot ${slotIndex}:`, JSON.parse(JSON.stringify(config)));
        
        // Cargar como configuración normal en grid principal
        const success = await applyConfigurationFromData(config); 

        if (success) {
            setCurrentSlotIndex(slotIndex);
            currentSlotIndex = slotIndex;
            console.log(`Slot ${slotIndex}: Estado cargado y aplicado desde Slot ${slotIndex}.`);
            // Flash de confirmación visual
            gridAnimationInProgress = true;
            gridAnimationStep = 2; // Solo paso de flash
            gridAnimationProgress = 0;
            gridFlashCount = 0;
            updateSlotsPanelUI(); // Asegurar que la UI refleje el estado cargado (por si hay fechas, etc)
        } else {
            console.error(`Error al aplicar la configuración del Slot ${slotIndex}.`);
            const slotEntryStatus = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
            if (slotEntryStatus) {
                slotEntryStatus.textContent = 'Error al Aplicar';
                slotEntryStatus.title = 'Hubo un problema al aplicar los datos de este slot.';
            }
        }

    } catch (error) {
        console.error(`Error al cargar datos del Slot ${slotIndex}:`, error);
        const slotEntryStatus = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
        if (slotEntryStatus) {
            slotEntryStatus.textContent = 'Error de Carga';
            slotEntryStatus.title = `Error: ${error.message}`;
        }
    }
}

// Función para cargar el estado desde un slot en el HUD (Ctrl+Numero con HUD activo)
async function loadFromSlotToHUD(slotIndex) {
    // Cargar configuración usando el módulo bioSlots.js
    const config = bioSlotsLoadFromSlot(slotIndex);
    
    if (!config) {
        console.warn(`Slot ${slotIndex} está vacío.`);
        // Indicación visual en el panel de slots
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
        console.log(`Cargando configuración en HUD desde Slot ${slotIndex}:`, JSON.parse(JSON.stringify(config)));
        
        // Limpiar paneles anteriores antes de cargar nuevo slot
        clearHUDPanels((panel) => {
                cleanupPanelText(panel);
                cleanupPanelModels(panel);
                cleanupGenomModels(panel);
                cleanupCodonModels(panel);
            });
            
        // IMPORTANTE: Ajustar el grid del HUD a las divisiones del slot guardado PRIMERO
        // y esperar a que esté completamente actualizado antes de cargar paneles
        const slotDivisions = config.grid?.divisions || currentDivisions;
        const currentHUDDivisions = getHUDGridParams()?.cellsX || currentDivisions;
        
        if (slotDivisions !== currentHUDDivisions) {
            console.log(`Ajustando grid HUD: ${currentHUDDivisions} → ${slotDivisions} divisiones (del slot)`);
            updateHUDGrid(slotDivisions);
            // Esperar múltiples frames para asegurar que el grid esté completamente actualizado
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Verificar que el grid se actualizó correctamente
            const updatedGridParams = getHUDGridParams();
            if (updatedGridParams && updatedGridParams.cellsX === slotDivisions) {
                console.log(`Grid HUD verificado: ${updatedGridParams.cellsX} divisiones`);
            } else {
                console.warn(`Grid HUD puede no haberse actualizado correctamente. Esperado: ${slotDivisions}, Obtenido: ${updatedGridParams?.cellsX}`);
                // Esperar otro frame por si acaso
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }
        
        // Obtener parámetros del grid HUD DESPUÉS de asegurar que está actualizado
        const hudGridParams = getHUDGridParams();
        if (!hudGridParams) {
            console.error('No se pueden obtener parámetros del grid HUD después de actualizarlo');
            return;
        }
        console.log(`Parámetros del grid HUD obtenidos: ${hudGridParams.cellsX} divisiones, cellSize: ${hudGridParams.cellSize}`);
        
        // Cargar paneles del slot - REPLICAR EXACTAMENTE EL COMPORTAMIENTO DEL GRID ORIGINAL
        if (config.panels && Array.isArray(config.panels)) {
            for (const panelInfo of config.panels) {
                // IMPORTANTE: Usar los parámetros que ya obtuvimos, no volver a obtenerlos
                if (!hudGridParams) {
                    console.error('No se pueden obtener parámetros del grid HUD');
                    continue;
                }
                
                // Asegurar que el número de orden es un entero válido (igual que en applyConfigurationFromData)
                const orderNumber = parseInt(panelInfo.orderNumber);
                if (isNaN(orderNumber)) {
                    console.warn('PanelInfo con número de orden inválido, omitiendo:', panelInfo.orderNumber);
                    continue;
                }
                
                // CRÍTICO: Usar los MISMOS índices de celda que el slot guardado
                // NO convertir índices - dejar que updatePanelGeometryAndPosition calcule las posiciones
                // usando los parámetros del grid del HUD (igual que en el grid original)
                const panelData = {
                    group: null,
                    minCellIndex: panelInfo.minCellIndex, // USAR ÍNDICES ORIGINALES SIN CONVERSIÓN
                    maxCellIndex: panelInfo.maxCellIndex, // USAR ÍNDICES ORIGINALES SIN CONVERSIÓN
                    orderNumber: orderNumber,
                    showOrderNumber: panelInfo.showOrderNumber !== undefined ? panelInfo.showOrderNumber : false,
                    hasText: panelInfo.behavior?.hasText || false,
                    selected: panelInfo.selected || false,
                    hovered: false,
                    borderLines: []
                };
                
                console.log(`Panel P${panelData.orderNumber}: Usando índices originales (${panelInfo.minCellIndex.x},${panelInfo.minCellIndex.y})-(${panelInfo.maxCellIndex.x},${panelInfo.maxCellIndex.y}) con parámetros HUD: cellSize=${hudGridParams.cellSize}, cellsX=${hudGridParams.cellsX}, halfWidth=${hudGridParams.halfWidth}, halfHeight=${hudGridParams.halfHeight}`);
                
                // IMPORTANTE: Actualizar geometría y posición usando los parámetros del HUD
                // Esto calculará las posiciones correctas basándose en los índices y los parámetros del grid
                updatePanelGeometryAndPosition(panelData, hudGridParams);
                
                if (panelData && panelData.group) {
                    // Ajustar posición Z al plano HUD (relativo al hudScene que ya está en HUD_PLANE_Z)
                    panelData.group.position.z = 0.02;
                    
                    // Asegurar que todos los hijos tengan Z relativo correcto
                    panelData.group.traverse((child) => {
                        if (child.position && child !== panelData.group) {
                            // Los hijos deben tener Z relativo al grupo, no absoluto
                            if (Math.abs(child.position.z - HUD_PLANE_Z) < 0.1) {
                                child.position.z = 0;
                            }
                        }
                    });
                    
                    // Añadir directamente al HUD (no a la escena principal)
                    const hudScene = getHUDScene();
                    if (hudScene) {
                        // Asegurar que no esté en la escena principal
                        if (scene.children.includes(panelData.group)) {
                            scene.remove(panelData.group);
                        }
                        hudScene.add(panelData.group);
                        addHUDPanel(panelData);
                        console.log(`Panel P${panelData.orderNumber} añadido directamente al HUD con parámetros: cellSize=${hudGridParams.cellSize}, halfWidth=${hudGridParams.halfWidth}, halfHeight=${hudGridParams.halfHeight}`);
                    } else {
                        console.error('No se pudo obtener hudScene para añadir panel');
                        continue;
                    }
                    
                    // Restaurar comportamiento
                    if (panelInfo.behavior) {
                        await restorePanelBehaviorFromData(panelData, panelInfo.behavior, hudGridParams);
                    }
                    
                    updatePanelColor(panelData);
                    createPanelOrderLabel(panelData);
                } else {
                    console.error('Error: panelData o panelData.group es null después de updatePanelGeometryAndPosition');
                }
            }
            
        setCurrentSlotIndex(slotIndex);
        currentSlotIndex = slotIndex;
        console.log(`Ctrl+${slotIndex}: HUD cargado desde Slot ${slotIndex}.`);
        // Flash de confirmación visual
        gridAnimationInProgress = true;
        gridAnimationStep = 2;
        gridAnimationProgress = 0;
        gridFlashCount = 0;
        updateSlotsPanelUI();
            // IMPORTANTE: Usar cellsX del hudGridParams, que debería ser igual a las divisiones del slot
            // NO usar currentDivisions como fallback, usar las divisiones del slot
            const popupDivisions = hudGridParams.cellsX || slotDivisions;
            
            console.log(`Divisiones: Slot original=${originalDivisions}, Popup=${popupDivisions}, Grid principal=${currentDivisions}`);
            
            // CRÍTICO: Si el popup y el grid principal tienen las mismas divisiones,
            // NO debemos convertir índices, incluso si el slot tiene divisiones diferentes.
            // En su lugar, usamos los índices originales y el cellSize del popup se ajustará automáticamente.
            const shouldConvertIndices = (popupDivisions !== currentDivisions) && (originalDivisions !== popupDivisions);
            
            // Función para convertir índices de celda del grid original al grid popup
            const convertCellIndices = (minIndex, maxIndex, fromDivisions, toDivisions) => {
                if (!shouldConvertIndices || fromDivisions === toDivisions) {
                    console.log(`  No conversión necesaria: divisiones iguales o popup=principal (${fromDivisions}→${toDivisions})`);
                    return { min: minIndex, max: maxIndex };
                }
                const ratio = toDivisions / fromDivisions;
                const newMin = Math.round(minIndex * ratio);
                const newMax = Math.round(maxIndex * ratio);
                console.log(`  Conversión: ratio=${ratio.toFixed(2)}, ${minIndex}-${maxIndex} → ${newMin}-${newMax}`);
                // Asegurar que los índices estén dentro de los límites del grid popup
                const clampedMin = Math.max(0, Math.min(toDivisions - 1, newMin));
                const clampedMax = Math.max(0, Math.min(toDivisions - 1, newMax));
                if (clampedMin !== newMin || clampedMax !== newMax) {
                    console.log(`  Ajustado por límites: ${newMin}-${newMax} → ${clampedMin}-${clampedMax}`);
                }
                return { min: clampedMin, max: clampedMax };
            };
            
            if (shouldConvertIndices) {
                console.log(`Ajustando resolución: Grid original ${originalDivisions} divisiones → Popup ${popupDivisions} divisiones`);
            } else {
                console.log(`Sin conversión: Popup y grid principal tienen las mismas divisiones (${popupDivisions}), usando índices originales del slot`);
            }
            
            // Cargar paneles en el popup usando los parámetros del grid popup actual
            // Los paneles se escalarán/adaptarán al grid del popup
            // REFACTORIZADO: Seguir el mismo patrón que applyConfigurationFromData
            if (config.panels && Array.isArray(config.panels)) {
                for (const panelInfo of config.panels) {
                    try {
                        // Convertir índices de celda del grid original al grid popup
                        const convertedX = convertCellIndices(
                            panelInfo.minCellIndex.x,
                            panelInfo.maxCellIndex.x,
                            originalDivisions,
                            popupDivisions
                        );
                        const convertedY = convertCellIndices(
                            panelInfo.minCellIndex.y,
                            panelInfo.maxCellIndex.y,
                            originalDivisions,
                            popupDivisions
                        );
                        
                        console.log(`Panel P${panelInfo.orderNumber}: Índices originales (${panelInfo.minCellIndex.x},${panelInfo.minCellIndex.y})-(${panelInfo.maxCellIndex.x},${panelInfo.maxCellIndex.y}) → Convertidos (${convertedX.min},${convertedY.min})-(${convertedX.max},${convertedY.max})`);
                        console.log(`  - Tamaño original: ${panelInfo.maxCellIndex.x - panelInfo.minCellIndex.x + 1}x${panelInfo.maxCellIndex.y - panelInfo.minCellIndex.y + 1} celdas`);
                        console.log(`  - Tamaño convertido: ${convertedX.max - convertedX.min + 1}x${convertedY.max - convertedY.min + 1} celdas`);
                        console.log(`  - cellSize popup: ${hudGridParams.cellSize}, cellSize principal: ${getCurrentGridParams()?.cellSize}`);
                        
                        // Crear panel base (igual que en applyConfigurationFromData)
                        const orderNumber = parseInt(panelInfo.orderNumber);
                        if (isNaN(orderNumber)) {
                            console.warn('PanelInfo con número de orden inválido, omitiendo:', panelInfo.orderNumber);
                            continue;
                        }
                        
                        const panel = {
                            group: null,
                            minCellIndex: { x: convertedX.min, y: convertedY.min },
                            maxCellIndex: { x: convertedX.max, y: convertedY.max },
                            orderNumber: orderNumber,
                            showOrderNumber: panelInfo.showOrderNumber !== undefined ? panelInfo.showOrderNumber : false,
                            hasText: panelInfo.behavior?.hasText || false,
                            selected: panelInfo.selected || false,
                            isModelingPanel: panelInfo.isModelingPanel || false,
                            navigateToSlot: typeof panelInfo.navigateToSlot === 'number' ? panelInfo.navigateToSlot : undefined,
                            loadToHUDSlot: typeof panelInfo.loadToHUDSlot === 'number' ? panelInfo.loadToHUDSlot : undefined, // 🔥 NUEVO: Restaurar trigger HUD
                            speciesPanel: panelInfo.behavior?.isSpeciesPanel || false,
                            speciesName: panelInfo.behavior?.speciesName || null
                        };
                        
                        // Usar updatePanelGeometryAndPosition para crear la geometría (igual que applyConfigurationFromData)
                        // IMPORTANTE: updatePanelGeometryAndPosition puede añadir el panel a scene, así que lo removemos después
                        updatePanelGeometryAndPosition(panel, hudGridParams);
                        
                        // Ajustar posición Z al plano popup
                        if (panel.group) {
                            // IMPORTANTE: hudScene ya está en Z=HUD_PLANE_Z.
                            // Los hijos deben estar en Z=0 (o ligeramente elevados) relativo al padre.
                            // La posición X e Y ya está calculada correctamente por updatePanelGeometryAndPosition
                            // Solo ajustamos Z
                            panel.group.position.z = 0.02; // Ligeramente por encima del grid del popup (que está en 0 relativo)
                            
                            panel.group.traverse((child) => {
                                if (child.position) {
                                    // No cambiar la Z de los hijos si ya es relativa correcta
                                    // Solo asegurar que no tengan Z=HUD_PLANE_Z acumulado
                                    // child.position.z = 0; 
                                }
                            });
                            
                            // Añadir al popup en lugar del grid principal
                            const hudScene = getHUDScene();
                            if (hudScene) {
                                // Verificar que el hudScene esté visible
                                if (!hudScene.visible) {
                                    console.warn(`HUDScene no está visible, activándolo...`);
                                    hudScene.visible = true;
                                }
                                
                                // Remover de la escena principal si se añadió ahí (updatePanelGeometryAndPosition puede haberlo añadido)
                                if (scene.children.includes(panel.group)) {
                                    scene.remove(panel.group);
                                }
                                
                                // Añadir al popup
                                if (!hudScene.children.includes(panel.group)) {
                                    hudScene.add(panel.group);
                                    console.log(`Panel P${panel.orderNumber} añadido al hudScene (${hudScene.children.length} hijos totales)`);
                                }
                                
                                // Asegurar que el panel.group sea visible
                                panel.group.visible = true;
                                // Asegurar renderOrder alto para que esté por encima de la cortina
                                panel.group.renderOrder = 200;
                                panel.group.traverse((child) => {
                                    child.visible = true;
                                    if (child.renderOrder !== undefined) {
                                        child.renderOrder = 200;
                                    }
                                });
                                
                                addHUDPanel(panel);
                                
                                // 🔥 CRITICAL: Actualizar materiales de las líneas de borde después de añadir al HUD
                                if (panel.borderLines && panel.borderLines.length > 0) {
                                    panel.borderLines.forEach(borderLine => {
                                        // Crear material brillante para HUD
                                        const hudMaterial = panelLineMaterialNormal.clone();
                                        hudMaterial.color.setHex(0xffffff);
                                        hudMaterial.depthTest = false;
                                        hudMaterial.depthWrite = false;
                                        hudMaterial.transparent = false;
                                        borderLine.material = hudMaterial;
                                        borderLine.renderOrder = 200;
                                        borderLine.position.z = 0.1; // Posición Z mayor para estar por delante de la cortina
                                        borderLine.visible = true;
                                    });
                                }
                                
                                // Actualizar color del panel para asegurar materiales correctos
                                updatePanelColor(panel);
                                
                                // 🔥 CRITICAL: Actualizar materiales de las líneas de borde después de añadir al HUD
                                if (panel.borderLines && panel.borderLines.length > 0) {
                                    panel.borderLines.forEach(borderLine => {
                                        // Crear material brillante para HUD
                                        const hudMaterial = panelLineMaterialNormal.clone();
                                        hudMaterial.color.setHex(0xffffff);
                                        hudMaterial.depthTest = false;
                                        hudMaterial.depthWrite = false;
                                        hudMaterial.transparent = false;
                                        borderLine.material = hudMaterial;
                                        borderLine.renderOrder = 200;
                                        borderLine.position.z = 0.1; // Posición Z mayor para estar por delante de la cortina
                                        borderLine.visible = true;
                                    });
                                }
                                
                                // Actualizar color del panel para asegurar materiales correctos
                                updatePanelColor(panel);
                                
                                console.log(`Panel P${panel.orderNumber} añadido al HUD en Z local=0.02 (Mundo=${HUD_PLANE_Z}), visible: ${panel.group.visible}`);
                            } else {
                                console.error('No se pudo obtener hudScene para añadir panel');
                                continue;
                            }
                            
                            // Restaurar comportamiento del panel
                            if (panelInfo.behavior) {
                                await restorePanelBehaviorFromData(panel, panelInfo.behavior, hudGridParams);
                            }
                            
                            // Actualizar colores
                            updatePanelColor(panel);
                            
                            // Crear etiqueta con número de orden
                            createPanelOrderLabel(panel);
                        } else {
                            console.error('Error: panel.group es null después de updatePanelGeometryAndPosition');
                        }
                    } catch (error) {
                        console.error('Error al restaurar panel en popup:', error);
                    }
                }
            }
            
            setCurrentSlotIndex(slotIndex);
            currentSlotIndex = slotIndex;
            console.log(`Ctrl+${slotIndex}: Configuración cargada en popup desde Slot ${slotIndex}.`);
            // Flash de confirmación visual
            gridAnimationInProgress = true;
            gridAnimationStep = 2;
            gridAnimationProgress = 0;
            gridFlashCount = 0;
            updateSlotsPanelUI();
        }

    } catch (error) {
        console.error(`Error al cargar datos del Slot ${slotIndex} en popup:`, error);
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
    // Efecto flash para confirmar
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelsFlashing.add(panelData);
}

// Función para navegar al siguiente slot (avanzar)
// Ahora usando bioSlots.js
function navigateToNextSlotLocal() {
    const nextSlot = navigateToNextSlot((slotIndex) => {
        loadFromSlot(slotIndex);
    });
    if (nextSlot !== null) {
        currentSlotIndex = nextSlot;
        setCurrentSlotIndex(nextSlot);
    }
}

// Función para navegar al slot anterior (retroceder)
// Ahora usando bioSlots.js
function navigateToPreviousSlotLocal() {
    const prevSlot = navigateToPreviousSlot((slotIndex) => {
        loadFromSlot(slotIndex);
    });
    if (prevSlot !== null) {
        currentSlotIndex = prevSlot;
        setCurrentSlotIndex(prevSlot);
    }
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

// Función para identificar paneles libres o reutilizables para especies
function findFreePanels() {
    // Primero buscar paneles de especies existentes (reutilizables)
    const speciesPanels = panels.filter(panel => {
        return panel.speciesPanel && panel.hasText && !panel.isKeyboardKey;
    });
    
    // Si hay paneles de especies, devolver el primero
    if (speciesPanels.length > 0) {
        return speciesPanels;
    }
    
    // Si no hay paneles de especies, buscar paneles completamente libres
    return panels.filter(panel => {
        // Excluir paneles del teclado
        if (panel.isKeyboardKey) return false;
        
        // Excluir paneles con modelos (incluyendo viewers)
        if (panel.modelData && (panel.modelData.isModelButton || panel.modelData.isModelDisplay || panel.modelData.isViewer)) return false;
        
        // Excluir paneles viewer
        if (panel.isViewer) return false;
        
        // Excluir paneles con texto (que no sean de especies)
        if (panel.hasText && !panel.speciesPanel) return false;
        
        // Excluir paneles con genomas
        if (panel.genomData) return false;
        
        // Excluir paneles con codones
        if (panel.codonData) return false;
        
        // Excluir paneles con navegación asignada
        if (panel.navigateToSlot) return false;
        
        // Excluir paneles con comportamientos especiales
        if (panel.behavior && (panel.behavior.hasText || panel.behavior.isGATCActive)) return false;
        
        // Es un panel libre
        return true;
    });
}

// 🔥 NUEVA FUNCIÓN: Encontrar el panel libre más cercano a un panel de referencia
function findClosestFreePanel(referencePanel) {
    if (!referencePanel || !referencePanel.group) return null;
    
    const freePanels = findFreePanels();
    if (freePanels.length === 0) return null;
    
    const referencePos = referencePanel.group.position;
    let closestPanel = null;
    let minDistance = Infinity;
    
    freePanels.forEach(panel => {
        if (!panel.group) return;
        
        const panelPos = panel.group.position;
        const dx = panelPos.x - referencePos.x;
        const dy = panelPos.y - referencePos.y;
        const dz = panelPos.z - referencePos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestPanel = panel;
        }
    });
    
    return closestPanel;
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
let doubleTapDetected = false; // 🔥 CRITICAL: Bandera para prevenir que el segundo tap se procese como single tap

renderer.domElement.addEventListener('touchstart', (event) => {
    // 🔥 DETENER GLITCH AL HACER TOUCH EN PANTALLA
    if (glitchActive) {
        stopGlitchEffect();
        event.preventDefault();
        return; // Salir temprano para evitar otras acciones mientras el glitch está activo
    }
    
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
        
        // PRIORIDAD ABSOLUTA: Si el HUD está activo, verificar solo paneles del HUD primero
        let intersects = [];
        
        if (isHUDActive()) {
            // Cuando el HUD está activo, solo permitir clics en elementos del HUD
            // NO permitir clics en elementos del fondo
            const hudPanelsList = getHUDPanels();
            const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
            const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
            const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
            intersects = raycaster.intersectObjects(hudSelectable, false);
            // NO verificar grid principal cuando HUD está activo - elementos del fondo no son clicables
        } else {
            const allSelectable = [];
            panels.forEach(panel => {
                if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                    allSelectable.push(panel.fillMesh);
                }
                if (panel.borderLines) {
                    panel.borderLines.forEach(line => {
                        if (!line.userData || !line.userData.ignoreRaycast) {
                            allSelectable.push(line);
                        }
                    });
                }
            });
            intersects = raycaster.intersectObjects(allSelectable, false);
        }
        
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
                // 🔥 CRITICAL: Marcar que se detectó un double tap para prevenir que el segundo tap se procese como single tap
                doubleTapDetected = true;
                
                // 🔥 CRITICAL: Prevenir que el double tap cause que todos los paneles flasheen
                // Solo ejecutar handlePanelDoubleClick sin crear eventos sintéticos
                handlePanelDoubleClick(panelData);
                event.preventDefault();
                lastTapTime = 0; // Resetear para evitar triple tap
                
                // 🔥 CRITICAL: Resetear la bandera después de un delay para permitir que el touchend se procese correctamente
                // Aumentar el delay para asegurar que cubra todo el ciclo del doble tap y prevenga que todos los paneles flasheen
                setTimeout(() => {
                    doubleTapDetected = false;
                }, 400); // Aumentado de 100ms a 400ms para cubrir todo el ciclo del doble tap
                
                return;
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
    // PRIORIDAD ABSOLUTA: Si el HUD está activo, verificar solo paneles del HUD primero
    let intersects = [];
    
    if (isHUDActive()) {
        // Cuando el HUD está activo, solo permitir clics en elementos del HUD
        // NO permitir clics en elementos del fondo
        const hudPanelsList = getHUDPanels();
        const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
        const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
        const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
        intersects = raycaster.intersectObjects(hudSelectable, false);
        // NO verificar grid principal cuando HUD está activo - elementos del fondo no son clicables
    } else {
            const allSelectable = [];
            panels.forEach(panel => {
                if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                    allSelectable.push(panel.fillMesh);
                }
                if (panel.borderLines) {
                    panel.borderLines.forEach(line => {
                        if (!line.userData || !line.userData.ignoreRaycast) {
                            allSelectable.push(line);
                        }
                    });
                }
            });
        intersects = raycaster.intersectObjects(allSelectable, false);
    }
    
    // 🔥 CRITICAL: Guardar si hay intersección para usar en touchend
    const hasIntersection = intersects.length > 0;
    
    if (intersects.length === 0 && !event.touches[1]) {
        // Si no hay intersección con paneles existentes, iniciar selección
        // 🔥 CRITICAL: Deseleccionar todos los paneles existentes al iniciar selección (igual que con ratón)
        let deselectedSomething = false;
        panels.forEach(p => {
            if (p.selected) {
                p.selected = false;
                updatePanelColor(p);
                deselectedSomething = true;
            }
        });
        
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
    
    // 🔥 CRITICAL: NO crear evento mousedown sintético si hay intersección con un panel
    // Esto evita que se ejecute código que actualiza todos los paneles
    // El evento mousedown sintético solo se necesita para interacciones que no son con paneles
    if (!hasIntersection) {
        // Simular mousedown solo si NO hay intersección con paneles
        // 🔥 CRITICAL: Marcar como touch para que sea ignorado por listeners de mouse
        const mouseDownEvent = new MouseEvent('mousedown', {
            clientX: touchStartPosition.x,
            clientY: touchStartPosition.y,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
        });
        // Establecer pointerType manualmente ya que MouseEvent no lo soporta directamente
        Object.defineProperty(mouseDownEvent, 'pointerType', { value: 'touch', writable: false });
        event.target.dispatchEvent(mouseDownEvent);
    }
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
    // 🔥 CRITICAL: Marcar como touch para que sea ignorado por listeners de mouse
    if (distance > 0) {
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: currentPosition.x,
            clientY: currentPosition.y,
            bubbles: true,
            cancelable: true,
            view: window
        });
        // Establecer pointerType manualmente ya que MouseEvent no lo soporta directamente
        Object.defineProperty(mouseMoveEvent, 'pointerType', { value: 'touch', writable: false });
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
        
        // 🔥 CRITICAL: Solo procesar selección si realmente hubo un arrastre significativo
        // (no un tap simple que podría tener un pequeño movimiento)
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
                    panelsInSelection = true;
                } else if (!event.shiftKey) {
                    // Deseleccionar si no se presiona Shift
                    panel.selected = false;
                }
            });
            
            // 🔥 CRITICAL: Solo refrescar colores si realmente hubo una selección de área significativa
            // (no en taps simples que podrían tener movimiento mínimo)
            if (panelsInSelection || dragDistance > TOUCH_CLICK_THRESHOLD * 2) {
                refreshAllPanelColors();
            }
            
            // Si no hay paneles en la selección, crear uno nuevo
            if (!panelsInSelection && start3D && end3D) {
                createPanelFromSelection(start3D, end3D);
            }
        } else {
            // 🔥 CRITICAL: Si fue un tap simple (dragDistance <= threshold), no refrescar todos los paneles
            // Solo deseleccionar si no hay intersección con ningún panel
        }
        
        isTouchSelecting = false;
    }
    
    // Procesar click normal si fue un toque rápido
    // 🔥 CRITICAL: Ignorar si se detectó un double tap (el segundo tap no debe procesarse como single tap)
    if (doubleTapDetected) {
        doubleTapDetected = false; // Resetear la bandera
        touchStartTime = 0;
        return; // Salir para evitar procesar el segundo tap del double tap como single tap
    }
    
    // 🔥 CRITICAL: Asegurar que isTouchSelecting se haya desactivado antes de procesar el tap
    const wasTouchSelecting = isTouchSelecting;
    isTouchSelecting = false; // Desactivar antes de procesar el tap
    
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < TOUCH_CLICK_TIME && touchStartTime !== 0 && !wasTouchSelecting) {
        // 🔥 CRITICAL: Detectar panel tocado para botón I AGREE (touch)
        const touch = event.changedTouches[0] || { clientX: touchStartPosition.x, clientY: touchStartPosition.y };
        const mouseForRaycast = new THREE.Vector2(
            (touch.clientX / window.innerWidth) * 2 - 1,
            -(touch.clientY / window.innerHeight) * 2 + 1
        );
        
        raycaster.setFromCamera(mouseForRaycast, camera);
        
        let intersects = [];
        if (isHUDActive()) {
            // Cuando el HUD está activo, solo permitir clics en elementos del HUD
            // NO permitir clics en elementos del fondo
            const hudPanelsList = getHUDPanels();
            const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
            const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
            const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
            intersects = raycaster.intersectObjects(hudSelectable, false);
        } else {
            const allSelectable = [];
            panels.forEach(panel => {
                if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                    allSelectable.push(panel.fillMesh);
                }
                if (panel.borderLines) {
                    panel.borderLines.forEach(line => {
                        if (!line.userData || !line.userData.ignoreRaycast) {
                            allSelectable.push(line);
                        }
                    });
                }
            });
            intersects = raycaster.intersectObjects(allSelectable, false);
        }
        
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
            
            // 🔥 CRITICAL: Si se detectó un panel, NO crear eventos sintéticos para evitar que se ejecute
            // código que actualiza todos los paneles. Manejar el panel directamente aquí.
            if (panelData) {
                // 🔥 CRITICAL: Manejar botones modal PRIMERO, antes de cualquier otra lógica
                // Esto previene que se ejecute código adicional que pueda causar que todos los paneles flasheen
                if (panelData.isModalPlusButton || panelData.isModalMinusButton) {
                    const currentGridParams = getCurrentGridParams();
                    if (currentGridParams && panelData.containerPanel) {
                        // Buscar el panel de porcentaje correspondiente
                        const modalData = getModalState(panelData.containerPanel);
                        if (modalData && modalData.divisions[panelData.modalIndex]) {
                            const percentagePanel = modalData.divisions[panelData.modalIndex].percentagePanel;
                            if (percentagePanel) {
                                // Determinar el cambio (+10 o -10)
                                const delta = panelData.isModalPlusButton ? 10 : -10;
                                updateModalPercentage(percentagePanel, delta, currentGridParams);
                                
                                // Flash visual SOLO en el botón clickeado (no en todos los paneles)
                                panelData.flashProgress = 0;
                                panelData.shouldFlash = true;
                                panelsFlashing.add(panelData);
                                
                                event.preventDefault();
                                touchStartTime = 0;
                                return; // Salir inmediatamente para evitar cualquier otro procesamiento
                            }
                        }
                    }
                }
                // 🔥 NUEVA FUNCIONALIDAD: Avanzar scroll de términos al hacer tap en botón AGREE (touch)
                if (panelData.isAgreeButton && panelData.termsPanel) {
                    const termsPanel = panelData.termsPanel;
                    const textState = panelTextState.get(termsPanel);
                    if (textState && textState.useWhiteScrollIndicators) {
                        // Este es el botón AGREE, avanzar scroll del panel de términos
                        const currentGridParams = getCurrentGridParams();
                        if (currentGridParams) {
                            // Calcular dimensiones del panel de términos
                            const panelHeight = (termsPanel.maxCellIndex.y - termsPanel.minCellIndex.y + 1);
                            const panelWidth = (termsPanel.maxCellIndex.x - termsPanel.minCellIndex.x + 1);
                            const width = panelWidth * currentGridParams.cellSize;
                            const height = panelHeight * currentGridParams.cellSize;
                            const paddingSize = currentGridParams.cellSize;
                            const textAreaHeight = height - (paddingSize * 2);
                            
                            // Calcular número máximo de líneas visibles
                            const isUniline = panelHeight <= 3;
                            const isTooSmall = textAreaHeight < (currentGridParams.cellSize * TEXT_CONFIG.fontSize * 0.8);
                            
                            let effectiveLineHeight;
                            if (isTooSmall || isUniline) {
                                effectiveLineHeight = panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                                     panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                                     panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                                     TEXT_CONFIG.lineHeight;
                            } else {
                                effectiveLineHeight = TEXT_CONFIG.lineHeight;
                            }
                            
                            const maxVisibleLines = isUniline ? 1 : Math.max(1, Math.floor(textAreaHeight / (currentGridParams.cellSize * effectiveLineHeight)));
                            
                            // Avanzar scrollOffset en una pantalla
                            const newScrollOffset = Math.min(
                                textState.scrollOffset + maxVisibleLines,
                                Math.max(0, textState.lines.length - maxVisibleLines)
                            );
                            
                            // Actualizar el texto del panel de términos
                            if (newScrollOffset !== textState.scrollOffset) {
                                textState.scrollOffset = newScrollOffset;
                                createPanelText(termsPanel, currentGridParams.cellSize);
                                console.log(`📜 Scroll de términos avanzado (AGREE touch): ${textState.scrollOffset}/${textState.lines.length - maxVisibleLines}`);
                            } else {
                                // Si ya está al final, volver al inicio
                                textState.scrollOffset = 0;
                                createPanelText(termsPanel, currentGridParams.cellSize);
                                console.log(`📜 Scroll de términos reiniciado al inicio (AGREE touch)`);
                            }
                            
                            // 🔥 CRITICAL: Flash visual SOLO en el botón I AGREE y el panel de términos
                            // NO actualizar otros paneles para evitar que todos flasheen
                            panelData.flashProgress = 0;
                            panelData.shouldFlash = true;
                            panelsFlashing.add(panelData);
                            
                            // También hacer flash en el panel de términos
                            termsPanel.flashProgress = 0;
                            termsPanel.shouldFlash = true;
                            panelsFlashing.add(termsPanel);
                            
                            // 🔥 CRITICAL: Asegurar que NO se ejecute código adicional que actualice otros paneles
                            // Retornar inmediatamente después de configurar el flash
                            
                            event.preventDefault();
                            touchStartTime = 0;
                            return; // Salir para evitar crear eventos sintéticos
                        }
                    }
                }
                
                // MANEJO DE BOTONES MODAL: + y - (touch)
                if (panelData.isModalPlusButton || panelData.isModalMinusButton) {
                    const currentGridParams = getCurrentGridParams();
                    if (currentGridParams && panelData.containerPanel) {
                        // Buscar el panel de porcentaje correspondiente
                        const modalData = getModalState(panelData.containerPanel);
                        if (modalData && modalData.divisions[panelData.modalIndex]) {
                            const percentagePanel = modalData.divisions[panelData.modalIndex].percentagePanel;
                            if (percentagePanel) {
                            // Determinar el cambio (+10 o -10)
                            const delta = panelData.isModalPlusButton ? 10 : -10;
                            updateModalPercentage(percentagePanel, delta, currentGridParams);
                            
                            // Flash visual SOLO en el botón clickeado (no en todos los paneles)
                            panelData.flashProgress = 0;
                            panelData.shouldFlash = true;
                            panelsFlashing.add(panelData);
                            
                            // NO agregar el panel de porcentaje al flash, solo el botón
                            
                            event.preventDefault();
                            touchStartTime = 0;
                            return; // Salir inmediatamente para evitar cualquier otro procesamiento
                            }
                        }
                    }
                }
                
                // 🔥 CRITICAL: Para cualquier otro panel tocado, manejar la selección (single tap)
                // Similar a como lo hace el click de mouse, pero sin crear eventos sintéticos
                // 🔥 CRITICAL: NO ejecutar selección si el panel es un botón modal y el tiempo desde el último tap es corto
                // (esto previene que el primer tap del doble tap ejecute selección cuando se hace doble tap en botones modal)
                const timeSinceLastTap = Date.now() - lastTapTime;
                const isPotentialDoubleTap = timeSinceLastTap < DOUBLE_TAP_DELAY && (panelData.isModalPlusButton || panelData.isModalMinusButton);
                
                if (!panelData.isAgreeButton && !panelData.isModalPlusButton && !panelData.isModalMinusButton && !isPotentialDoubleTap) {
                    // Seleccionar el panel (single tap = selección)
                    // Deseleccionar todos los demás paneles
                    panels.forEach(p => {
                        if (p !== panelData && p.selected) {
                            p.selected = false;
                            updatePanelColor(p);
                        }
                    });
                    
                    // Seleccionar el panel tocado
                    panelData.selected = true;
                    updatePanelColor(panelData);
                    
                    console.log(`✅ Panel P${panelData.orderNumber} seleccionado (touch)`);
                }
                
                event.preventDefault();
                touchStartTime = 0;
                return; // Salir para evitar crear eventos sintéticos
            }
        }
        
        // 🔥 CRITICAL: Si NO se detectó ningún panel, deseleccionar todos los paneles (tap en el grid)
        // Esto evita que se ejecute código que actualiza todos los paneles cuando se toca un panel específico
        if (intersects.length === 0) {
            // Tap en el grid (fondo) - deseleccionar todos los paneles
            let deselectedSomething = false;
            panels.forEach(p => {
                if (p.selected) {
                    p.selected = false;
                    updatePanelColor(p);
                    deselectedSomething = true;
                }
            });
            
            if (deselectedSomething) {
                console.log(`✋ Todos los paneles deseleccionados (tap en grid)`);
            }
            
            // NO crear eventos sintéticos para evitar que se ejecute código adicional
            // que podría causar problemas
            event.preventDefault();
            touchStartTime = 0;
            return;
        }
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
    // 🔥 CRITICAL FIX: updatePanelGeometryAndPosition ahora preserva automáticamente las UVs personalizadas
    // y restaura la textura correctamente, por lo que no necesitamos código adicional aquí
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
    // 🔥 DETENER GLITCH AL PRESIONAR CUALQUIER TECLA
    if (glitchActive) {
        stopGlitchEffect();
        return; // Salir temprano para evitar otras acciones mientras el glitch está activo
    }
    
    const key = event.key;
    const activelyWritingText = keyboardState.isWriting; // Cachear para consistencia en esta ejecución

    // DEBUG: console.log(`Keydown: '${key}', activelyWritingText: ${activelyWritingText}, Ctrl: ${event.ctrlKey}, Shift: ${event.shiftKey}, Target:`, event.target);

    if (activelyWritingText) {
        // Si estamos en modo escritura:
        // 1. panelText.js (a través de preventTerminalInput) ahora maneja Escape para llamar a stopTextEditing
        //    y también llama a event.stopPropagation() para el Escape.
        // 2. Para otras teclas que NO son Escape Y NO tienen modificadores Ctrl/Alt/Meta Y NO son F-keys,
        //    hacemos un return aquí para asegurar que se deleguen al input de texto y no activen atajos globales.
        if (key && key !== 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey && !key.startsWith("F")) {
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

    // IMPORTANTE: Permitir que las teclas de resolución del HUD funcionen incluso en modo escritura
    // para que el usuario pueda controlar las resoluciones independientemente
    // Solo procesar si no estamos escribiendo texto y el HUD está activo
    if ((key === 'm' || key === 'M' || key === 'n' || key === 'N') && !activelyWritingText && !terminalIsEffectivelyActive) {
        if (isHUDActive()) {
            if (key === 'm' || key === 'M') {
                console.log('Tecla M presionada: Aumentando resolución del HUD');
                const success = adjustHUDResolution(1);
                if (success) {
                    event.preventDefault();
                    return;
                }
            } else if (key === 'n' || key === 'N') {
                console.log('Tecla N presionada: Disminuyendo resolución del HUD');
                const success = adjustHUDResolution(-1);
                if (success) {
                    event.preventDefault();
                    return;
                }
            }
        }
    }

    // Atajos Globales
    let newDivisions = currentDivisions;
    let resolutionChanged = false;
    let moveDelta = { dx: 0, dy: 0 };
    let deleteTriggered = false;

    switch (key) {
        case '+':
        case '=':
            // Ajustar resolución del grid base - INDEPENDIENTE del popup
            if (!activelyWritingText && !terminalIsEffectivelyActive) {
            newDivisions = Math.min(currentDivisions + 1, 50);
            resolutionChanged = true;
            }
            break;
        case '-':
        case '_':
            // Ajustar resolución del grid base - INDEPENDIENTE del popup
            if (!activelyWritingText && !terminalIsEffectivelyActive) {
            newDivisions = Math.max(currentDivisions - 1, 2);
            resolutionChanged = true;
            }
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
        case 'PageUp':
            // Navegar al slot anterior
            if (!activelyWritingText && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                navigateToPreviousSlotLocal();
                event.preventDefault();
            }
            return;
        case 'PageDown':
            // Navegar al siguiente slot
            if (!activelyWritingText && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                navigateToNextSlotLocal();
                event.preventDefault();
            }
            return;
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
            toggleControlPanels(); // Restaurar función original: mostrar/ocultar panel de slots
            return;
        case 'p':
        case 'P':
            // Toggle HUD: si está activo, destruirlo; si no, crearlo
            if (isHUDActive()) {
                destroyHUD();
                console.log('HUD desactivado');
            } else {
                // IMPORTANTE: El HUD debe mantener su propia resolución independiente del grid base
                // Si hay un slot cargado, usar su resolución; si no, usar una resolución por defecto
                // NO usar currentDivisions para evitar que se sincronice con el grid base
                const hudDivisions = currentSlotIndex >= 0 ? 
                    (bioSlotsLoadFromSlot(currentSlotIndex)?.grid?.divisions || 24) : 24;
                const success = createHUD(hudDivisions);
                if (success) {
                    console.log(`HUD activado con ${hudDivisions} divisiones (independiente del grid base)`);
                } else {
                    console.error('Error al activar HUD');
                }
            }
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
                    }
                });
                // 🔥 REFRESCAR TODOS LOS COLORES DESPUÉS DE DESELECCIONAR
                refreshAllPanelColors();
            }
            return;
        // 🔥 NUEVO: Cargar slots con números del teclado (0-9)
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
                const slotIndex = parseInt(key);
            
            // Ctrl+Numero: SIEMPRE cargar slot en HUD (activar HUD si no está activo)
            if (!activelyWritingText && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                // Función async interna para manejar la carga
                (async () => {
                    // Si el HUD no está activo, activarlo primero
                    if (!isHUDActive()) {
                        console.log(`Ctrl+${slotIndex}: HUD no está activo, activándolo primero...`);
                        // IMPORTANTE: Obtener las divisiones del slot antes de crear el HUD
                        const slotConfig = bioSlotsLoadFromSlot(slotIndex);
                        const slotDivisions = slotConfig?.grid?.divisions || currentDivisions;
                        console.log(`Ctrl+${slotIndex}: Creando HUD con ${slotDivisions} divisiones del slot`);
                        const hudCreated = createHUD(slotDivisions);
                        if (!hudCreated) {
                            console.error('Error al crear HUD. Cargando en grid principal como fallback.');
                            loadFromSlot(slotIndex);
                            return;
                        }
                        // Esperar un frame para asegurar que el HUD esté completamente inicializado
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                    
                    // Verificar que el HUD esté activo y visible antes de cargar
                    const hudScene = getHUDScene();
                    if (hudScene) {
                        hudScene.visible = true;
                        hudScene.traverse((child) => {
                            child.visible = true;
                        });
                        console.log(`Ctrl+${slotIndex}: HUDScene verificado, visible: ${hudScene.visible}, hijos: ${hudScene.children.length}`);
                    }
                    
                    console.log(`Ctrl+${slotIndex}: Cargando slot ${slotIndex} en HUD`);
                    loadFromSlotToHUD(slotIndex);
                })();
                event.preventDefault();
                return;
            }
            
            // Alt+Numero: cargar slot desde el 10 en adelante (Alt+0 = slot 10, Alt+1 = slot 11, etc.)
            if (!activelyWritingText && event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
                const altSlotIndex = slotIndex + 10; // Alt+0 = slot 10, Alt+1 = slot 11, etc.
                if (altSlotIndex < MAX_SLOTS) {
                    console.log(`Alt+${slotIndex}: Cargando slot ${altSlotIndex} desde teclado numérico`);
                    loadFromSlot(altSlotIndex);
                } else {
                    console.warn(`Alt+${slotIndex}: Slot ${altSlotIndex} está fuera del rango (máximo: ${MAX_SLOTS - 1})`);
                }
                event.preventDefault();
                return;
            }
            
            // Solo número sin modificadores: cargar en grid principal
            if (!activelyWritingText && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                console.log(`Cargando slot ${slotIndex} desde teclado numérico`);
                loadFromSlot(slotIndex);
                event.preventDefault();
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
    
    // Actualizar el tamaño del plano de oscurecimiento si existe
    updateDarkeningPlaneSize();
    
    // Actualizar el grid y adaptar paneles existentes
    updateGrid(currentDivisions);
}

window.addEventListener('resize', handleResize);

// Manejar cambios de pantalla completa
document.addEventListener('fullscreenchange', handleResize);

// Exportar funciones para controlar el grid desde la consola
window.updateGrid = updateGrid;

// Función para obtener la posición 3D en el plano del grid o popup
function get3DPointOnGrid(event, usePopup = false) {
    // Calcular coordenadas precisas del mouse
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Configurar raycaster con la cámara y las coordenadas del mouse
    raycaster.setFromCamera(mouse, camera);
    
    // Si el HUD está activo, siempre usar HUD (a menos que se presione Shift para forzar grid principal)
    const shouldUseHUD = usePopup || (isHUDActive() && !(event && event.shiftKey));
    const planeZ = shouldUseHUD ? HUD_PLANE_Z : 0;
    
    // Crear un plano imaginario en z correspondiente para la intersección
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const intersectionPoint = new THREE.Vector3();
    
    // Calcular intersección con mayor precisión
    const didIntersect = raycaster.ray.intersectPlane(plane, intersectionPoint);
    
    // Aplicar redondeo controlado para evitar imprecisiones por punto flotante
    if (didIntersect) {
        // Mantener 4 decimales de precisión
        intersectionPoint.x = Math.round(intersectionPoint.x * 10000) / 10000;
        intersectionPoint.y = Math.round(intersectionPoint.y * 10000) / 10000;
        intersectionPoint.z = planeZ; // Asegurar que Z es exactamente el plano correspondiente
    }
    
    return intersectionPoint;
}

// Función para crear paneles (en HUD si está activo, sino en grid principal)
function createPanelFromSelection(start3D, end3D) {
    // Si el HUD está activo, siempre crear en HUD (a menos que se presione Shift)
    // Verificar si el punto está cerca del HUD o si el HUD está activo
    const createInHUD = isHUDActive() && (Math.abs(start3D.z - HUD_PLANE_Z) < 0.1 || Math.abs(end3D.z - HUD_PLANE_Z) < 0.1);
    const gridParams = createInHUD ? getHUDGridParams() : getCurrentGridParams();
    
    if (!gridParams) return;
    const { cellSize, cellsX, cellsY, halfWidth, halfHeight } = gridParams;

    // Deseleccionar todos los paneles existentes (del contexto correspondiente)
    const panelsToDeselect = createInHUD ? getHUDPanels() : panels;
    panelsToDeselect.forEach(panel => {
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

    // *** NUEVA LÓGICA: Detección de conflictos para selección inteligente ***
    const conflictingPanels = [];
    
    // Si estamos creando en popup, verificar conflictos con paneles del popup
    // Si estamos creando en grid principal, verificar conflictos con paneles del grid principal
    const panelsToCheck = createInHUD ? getHUDPanels() : panels;
    
    for (const existingPanel of panelsToCheck) {
        const eMinX = existingPanel.minCellIndex.x;
        const eMaxX = existingPanel.maxCellIndex.x;
        const eMinY = existingPanel.minCellIndex.y;
        const eMaxY = existingPanel.maxCellIndex.y;

        // Comprobar si los rectángulos de índices se solapan (sin margen para detección más precisa)
        const conflictX = !(pMaxX < eMinX || pMinX > eMaxX);
        const conflictY = !(pMaxY < eMinY || pMinY > eMaxY);

        if (conflictX && conflictY) {
            conflictingPanels.push(existingPanel);
        }
    }
    
    // Si hay paneles en conflicto, seleccionarlos en lugar de crear nuevo panel
    if (conflictingPanels.length > 0) {
        console.log(`🎯 Selección inteligente: ${conflictingPanels.length} panel(es) detectado(s) en el área`);
        
        // 🔥 USAR ESTADO CAPTURADO DE TECLAS MODIFICADORAS
        const maintainSelection = selectionModifierKeys.shiftKey || selectionModifierKeys.ctrlKey;
        
        console.log(`🎯 Selección inteligente - Teclas: Shift=${selectionModifierKeys.shiftKey}, Ctrl=${selectionModifierKeys.ctrlKey}, Alt=${selectionModifierKeys.altKey}`);
        
        if (!maintainSelection) {
            // Sin Shift/Ctrl: Deseleccionar todos los demás paneles (del contexto correspondiente)
            panelsToCheck.forEach(panel => {
                if (!conflictingPanels.includes(panel) && panel.selected) {
                    panel.selected = false;
                    updatePanelColor(panel);
                }
            });
        }
        
        // Seleccionar los paneles en conflicto
        conflictingPanels.forEach(panel => {
            if (maintainSelection) {
                // Con Shift/Ctrl: Alternar selección
                panel.selected = !panel.selected;
            } else {
                // Sin Shift/Ctrl: Seleccionar siempre
                panel.selected = true;
            }
        });
        
        // 🔥 ACTUALIZAR VISUAL DE TODOS LOS PANELES SELECCIONADOS
        refreshSelectedPanelsColors();
        
        // Mostrar información sobre la selección
        const selectedPanels = conflictingPanels.filter(p => p.selected);
        if (selectedPanels.length > 0) {
            const panelNumbers = selectedPanels.map(p => `P${p.orderNumber}`).join(', ');
            console.log(`✅ Panel(es) seleccionado(s): ${panelNumbers}`);
        }
        
        return; // Salir sin crear panel nuevo
    }
    // *** Fin: Nueva lógica de selección inteligente ***

    // Asegurar que el número de orden sea el siguiente disponible
    // Considerar paneles del contexto correspondiente (popup o grid principal)
    const panelsForOrder = createInHUD ? getHUDPanels() : panels;
    const maxCurrentNumber = Math.max(...panelsForOrder.map(p => parseInt(p.orderNumber) || 0), 0);
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
    updatePanelGeometryAndPosition(panelData, gridParams);
    
    // Ajustar posición Z según si es popup o grid principal
    if (createInHUD) {
        panelData.group.position.z = HUD_PLANE_Z;
        // Asegurar que todos los hijos también estén en el plano popup
        panelData.group.traverse((child) => {
            if (child.position) {
                child.position.z = HUD_PLANE_Z;
            }
        });
    } else {
        panelData.group.position.z = 0;
    }

    if(panelData.group) {
        if (createInHUD) {
            // Añadir al popup
            const hudScene = getHUDScene();
            if (hudScene) {
                // Asegurar renderOrder alto para que esté por encima de la cortina
                panelData.group.renderOrder = 200;
                panelData.group.traverse((child) => {
                    if (child.renderOrder !== undefined) {
                        child.renderOrder = 200;
                    }
                });
                // Asegurar explícitamente que los borderLines tengan renderOrder alto
                if (panelData.borderLines) {
                    panelData.borderLines.forEach(borderLine => {
                        borderLine.renderOrder = 200;
                    });
                }
                hudScene.add(panelData.group);
                addHUDPanel(panelData);
                
                // 🔥 CRITICAL: Actualizar materiales de las líneas de borde después de añadir al HUD
                if (panelData.borderLines && panelData.borderLines.length > 0) {
                    panelData.borderLines.forEach(borderLine => {
                        // Crear material brillante para HUD
                        const hudMaterial = panelLineMaterialNormal.clone();
                        hudMaterial.color.setHex(0xffffff);
                        hudMaterial.depthTest = false; // Desactivar depth test para estar siempre visible
                        hudMaterial.depthWrite = false; // No escribir en depth buffer
                        hudMaterial.transparent = false;
                        borderLine.material = hudMaterial;
                        borderLine.renderOrder = 200;
                        borderLine.position.z = 0.1; // Posición Z mayor para estar por delante de la cortina
                        borderLine.visible = true;
                    });
                }
                
                // Actualizar color del panel para asegurar materiales correctos
                updatePanelColor(panelData);
            }
        } else {
            // Añadir al grid principal
        scene.add(panelData.group);
        panels.push(panelData);
        }
        
        // Reindexar después de añadir (solo para grid principal)
        if (!createInHUD) {
        reindexPanels();
        }
        
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

    // 🔥 CRITICAL FIX: Preservar información de textura y UVs personalizadas
    let preservedTextureInfo = null;
    if (panelData.hasTexture && panelData.fillMesh && panelData.fillMesh.geometry) {
        const oldGeometry = panelData.fillMesh.geometry;
        const oldUVs = oldGeometry.attributes.uv;
        const texture = panelData.fillMesh.material?.map;
        
        if (oldUVs && oldUVs.count > 0 && texture) {
            // Guardar las UVs actuales
            const savedUVs = [];
            for (let i = 0; i < oldUVs.count; i++) {
                savedUVs.push({
                    u: oldUVs.getX(i),
                    v: oldUVs.getY(i)
                });
            }
            
            preservedTextureInfo = {
                hasTexture: true,
                textureType: panelData.textureType || 'unknown',
                texturePath: panelData.texturePath || null,
                savedUVs: savedUVs,
                imageAspect: texture.image ? (texture.image.width / texture.image.height) : null,
                material: panelData.fillMesh.material, // Preservar referencia al material
                textureMaterials: panelData.textureMaterials // Preservar materiales de estados
            };
        }
    }

    // Preservar el modelo si existe
    const modelData = preserveModel(panelData);

    const panelCellsX = maxCellIndex.x - minCellIndex.x + 1;
    const panelCellsY = maxCellIndex.y - minCellIndex.y + 1;

    const panelWidth = panelCellsX * cellSize;
    const panelHeight = panelCellsY * cellSize;
    
    // Calcular centro basado en índices y tamaño de celda actual
    // IMPORTANTE: Esta fórmula calcula el centro del panel basándose en:
    // - halfWidth/halfHeight: mitad del ancho/alto total del grid
    // - minCellIndex: índice de la celda más a la izquierda/abajo
    // - panelCellsX/panelCellsY: número de celdas que ocupa el panel
    // - cellSize: tamaño de cada celda
    const panelCenterX = -halfWidth + (minCellIndex.x + panelCellsX / 2) * cellSize;
    const panelCenterY = -halfHeight + (minCellIndex.y + panelCellsY / 2) * cellSize;
    
    // Debug: Log para paneles en popup
    if (panelData.group && panelData.group.parent && panelData.group.parent.userData && panelData.group.parent.userData.isPopup) {
        console.log(`Panel P${panelData.orderNumber} centro calculado:`, {
            panelCenterX,
            panelCenterY,
            halfWidth,
            halfHeight,
            minCellIndex: `${minCellIndex.x},${minCellIndex.y}`,
            maxCellIndex: `${maxCellIndex.x},${maxCellIndex.y}`,
            panelCellsX,
            panelCellsY,
            cellSize
        });
    }

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
    
    // 🔥 CRITICAL FIX: Solo generar UVs por defecto si NO hay textura personalizada
    // Si hay textura personalizada, preservaremos las UVs originales para mantener la escala
    if (!preservedTextureInfo || !preservedTextureInfo.savedUVs) {
        // Generar UVs que cubran todo el panel uniformemente (solo para paneles sin textura)
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
    }
    
    // 🔥 CRITICAL FIX: Restaurar textura y UVs personalizadas si existían
    let fillMaterial = panelFillMaterialNormal;
    if (preservedTextureInfo && preservedTextureInfo.material) {
        // Usar el material preservado (que tiene la textura)
        fillMaterial = preservedTextureInfo.material;
        panelData.hasTexture = true;
        panelData.textureType = preservedTextureInfo.textureType;
        panelData.texturePath = preservedTextureInfo.texturePath;
        panelData.textureMaterials = preservedTextureInfo.textureMaterials;
    }
    
    panelData.fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    panelData.fillMesh.userData.panelDataRef = panelData;
    panelData.fillMesh.userData.isPanel = true;
    panelData.fillMesh.renderOrder = 0; // Renderizar primero (debajo)
    panelData.group.add(panelData.fillMesh);
    
    // 🔥 CRITICAL FIX: Restaurar UVs personalizadas si existían
    // IMPORTANTE: Preservar las UVs originales para mantener la escala de la textura
    // cuando cambia el tamaño del panel (por cambio de escala del grid)
    if (preservedTextureInfo && preservedTextureInfo.savedUVs) {
        const uvAttribute = fillGeometry.attributes.uv;
        const savedUVs = preservedTextureInfo.savedUVs;
        
        // Si el número de vértices coincide, restaurar directamente las UVs originales
        if (uvAttribute.count === savedUVs.length) {
            for (let i = 0; i < savedUVs.length; i++) {
                uvAttribute.setXY(i, savedUVs[i].u, savedUVs[i].v);
            }
            uvAttribute.needsUpdate = true;
            console.log(`✅ UVs personalizadas restauradas para panel P${orderNumber} (escala preservada)`);
        } else {
            // Si el número de vértices cambió (geometría diferente), intentar mapear proporcionalmente
            // pero manteniendo la escala relativa de la textura
            console.warn(`⚠️ Número de vértices cambió para panel P${orderNumber} (${savedUVs.length} -> ${uvAttribute.count}). Intentando preservar escala...`);
            
            // Si la geometría cambió significativamente, usar las UVs por defecto pero ajustadas
            // para mantener la proporción de la textura original
            const texture = preservedTextureInfo.material?.map;
            if (texture && texture.image && preservedTextureInfo.imageAspect) {
                // Calcular las UVs basándose en la proporción original de la textura
                // pero aplicadas a la nueva geometría
                const imageAspect = preservedTextureInfo.imageAspect;
                const panelAspect = panelWidth / panelHeight;
                const ratio = panelAspect / imageAspect;
                
                // Usar las UVs por defecto de la nueva geometría como base
                const positions = fillGeometry.attributes.position;
                for (let i = 0; i < uvAttribute.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    
                    // Calcular UVs base (0-1)
                    let u = (x + panelHalfWidth) / panelWidth;
                    let v = (y + panelHalfHeight) / panelHeight;
                    
                    // Aplicar el mismo ajuste "contain" que tenía la textura original
                    // para mantener la proporción
                    if (ratio < 1) {
                        v = 0.5 + (v - 0.5) / ratio;
                    } else {
                        u = 0.5 + (u - 0.5) * ratio;
                    }
                    
                    uvAttribute.setXY(i, u, v);
                }
                uvAttribute.needsUpdate = true;
                console.log(`✅ UVs ajustadas para preservar proporción de textura en panel P${orderNumber}`);
            } else {
                // Si no hay información de textura, usar UVs por defecto
                const positions = fillGeometry.attributes.position;
                for (let i = 0; i < uvAttribute.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const u = (x + panelHalfWidth) / panelWidth;
                    const v = (y + panelHalfHeight) / panelHeight;
                    uvAttribute.setXY(i, u, v);
                }
                uvAttribute.needsUpdate = true;
            }
        }
    }

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
    // 🔥 CRITICAL: Verificar si el panel está en el HUD de múltiples maneras
    // 1. Verificar por parent
    let isInHUD = panelData.group && panelData.group.parent && 
                  panelData.group.parent.userData && panelData.group.parent.userData.isHUD;
    // 2. Verificar si el panel está en la lista de paneles del HUD
    if (!isInHUD) {
        const hudPanelsList = getHUDPanels();
        isInHUD = hudPanelsList.includes(panelData);
    }
    
    // Para paneles del HUD, usar materiales más brillantes para que no se vean apagados
    let borderMaterial = panelLineMaterialNormal;
    if (isInHUD) {
        // Crear un material más brillante para los bordes del HUD
        borderMaterial = panelLineMaterialNormal.clone();
        borderMaterial.color.setHex(0xffffff); // Blanco brillante para HUD
        borderMaterial.depthTest = false; // Desactivar depth test para estar siempre visible
        borderMaterial.depthWrite = false; // No escribir en depth buffer
        borderMaterial.transparent = false; // Asegurar que no sea transparente
    }
    
    const borderLine = new THREE.Line(borderGeometry, borderMaterial);
    // Mejorar la detección para raycasting
    borderLine.userData.isPanel = true; // Marcador para identificar líneas de panel
    borderLine.userData.panelDataRef = panelData; // Referencia al panel
    
    // 🔥 CRITICAL: Si el panel está en el HUD, usar renderOrder alto y posición Z mayor para estar por encima de la cortina
    borderLine.renderOrder = isInHUD ? 200 : 10; // 200 para HUD, 10 para grid principal
    
    // Para HUD, posicionar las líneas más adelante para estar definitivamente por encima de la cortina (z=7)
    // El HUD está en z=8, así que las líneas deben estar en al menos z=8.1 o más para estar por delante
    borderLine.position.z = isInHUD ? 0.1 : 0.02; // 0.1 para HUD (absoluto: 8.1), 0.02 para grid principal
    borderLine.visible = true; // Asegurar que sea visible
    
    // Debug: Log para verificar que las líneas se están creando correctamente
    if (isInHUD) {
        console.log(`Línea de borde creada para panel HUD P${panelData.orderNumber}:`, {
            renderOrder: borderLine.renderOrder,
            positionZ: borderLine.position.z,
            materialColor: borderMaterial.color.getHexString(),
            visible: borderLine.visible,
            depthTest: borderMaterial.depthTest,
            depthWrite: borderMaterial.depthWrite
        });
    }
    
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
// 🔥 FUNCIÓN AUXILIAR PARA REFRESCAR TODOS LOS ESTADOS VISUALES
function refreshAllPanelColors() {
    panels.forEach(panel => {
        updatePanelColor(panel);
    });
}

// 🔥 FUNCIÓN AUXILIAR PARA REFRESCAR SOLO PANELES SELECCIONADOS
function refreshSelectedPanelsColors() {
    panels.forEach(panel => {
        if (panel.selected) {
            updatePanelColor(panel);
        }
    });
}

function updatePanelColor(panelData) {
    if (!panelData || !panelData.group) return;
    
    // 🔥 CRITICAL: Verificar si el panel está en el HUD
    const isInHUD = panelData.group && panelData.group.parent && 
                    panelData.group.parent.userData && panelData.group.parent.userData.isHUD;
    
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
        
        // Para las líneas usar los materiales normales, pero más brillantes si está en HUD
        if (isInHUD) {
            // Para HUD, usar materiales más brillantes
            if (panelData.selected) {
                targetLineMaterial = panelLineMaterialSelected.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
            } else if (panelData.hovered && !('ontouchstart' in window)) {
                targetLineMaterial = panelLineMaterialHover.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
            } else {
                targetLineMaterial = panelLineMaterialNormal.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
            }
        } else {
            // Para grid principal, usar materiales normales
            if (panelData.selected) {
                targetLineMaterial = panelLineMaterialSelected;
            } else if (panelData.hovered && !('ontouchstart' in window)) {
                targetLineMaterial = panelLineMaterialHover;
            } else {
                targetLineMaterial = panelLineMaterialNormal;
            }
        }
    } else {
        // Comportamiento normal para paneles sin textura
        if (isInHUD) {
            // Para HUD, usar materiales más brillantes
            if (panelData.selected) {
                targetLineMaterial = panelLineMaterialSelected.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
                targetFillMaterial = panelFillMaterialSelected;
            } else if (panelData.hovered && !('ontouchstart' in window)) {
                targetLineMaterial = panelLineMaterialHover.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
                targetFillMaterial = panelFillMaterialHover;
                
                // Imprimir el carácter en la consola cuando se hace hover
                if (panelData.behavior && panelData.behavior.character) {
                    console.log(`Tecla: ${panelData.behavior.character}`);
                }
            } else {
                targetLineMaterial = panelLineMaterialNormal.clone();
                targetLineMaterial.color.setHex(0xffffff); // Blanco brillante
                targetLineMaterial.depthTest = false;
                targetLineMaterial.depthWrite = false;
                targetFillMaterial = panelFillMaterialNormal;
            }
        } else {
            // Para grid principal, usar materiales normales
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
    
    // PRIORIDAD ABSOLUTA: Si el HUD está activo, verificar solo paneles del HUD primero
    let intersects = [];
    
    if (isHUDActive()) {
        // Cuando el HUD está activo, solo permitir clics en elementos del HUD
        // NO permitir clics en elementos del fondo
        const hudPanelsList = getHUDPanels();
        const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
        const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
        const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
        intersects = raycaster.intersectObjects(hudSelectable, false);
        // NO verificar grid principal cuando HUD está activo - elementos del fondo no son clicables
    } else {
        // Si el HUD no está activo, verificar solo grid principal
        const allSelectable = [];
        panels.forEach(panel => {
            if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                allSelectable.push(panel.fillMesh);
            }
            if (panel.borderLines) {
                panel.borderLines.forEach(line => {
                    if (!line.userData || !line.userData.ignoreRaycast) {
                        allSelectable.push(line);
                    }
                });
            }
        });
        intersects = raycaster.intersectObjects(allSelectable, false);
    }
    
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
    // 🔥 DETENER GLITCH AL HACER CLICK EN PANTALLA
    if (glitchActive) {
        stopGlitchEffect();
        return; // Salir temprano para evitar otras acciones mientras el glitch está activo
    }
    
    // Ignorar eventos táctiles
    if (event.pointerType === 'touch') return;
    
    // Permitir solo click izquierdo sin Ctrl
    if (event.button === 0 && !event.ctrlKey) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Configurar raycaster con posición precisa
        raycaster.setFromCamera(mouse, camera);

        // --- Raycast contra BORDES Y RELLENO --- 
        // PRIORIDAD ABSOLUTA: Si el HUD está activo, solo verificar paneles del HUD primero
        let intersects = [];
        
        if (isHUDActive()) {
            // PRIMERO: Verificar solo paneles del HUD
            const hudPanelsList = getHUDPanels();
            const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
            const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
            const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
            
            intersects = raycaster.intersectObjects(hudSelectable, false)
                .sort((a, b) => a.distance - b.distance);
            // NO verificar grid principal cuando HUD está activo - elementos del fondo no son clicables
        } else {
            // Si el HUD no está activo, verificar solo grid principal
            const allSelectable = [];
            panels.forEach(panel => {
                if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                    allSelectable.push(panel.fillMesh);
                }
                if (panel.borderLines) {
                    panel.borderLines.forEach(line => {
                        if (!line.userData || !line.userData.ignoreRaycast) {
                            allSelectable.push(line);
                        }
                    });
                }
            });
            intersects = raycaster.intersectObjects(allSelectable, false)
                .sort((a, b) => a.distance - b.distance);
        }

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
                // 🔥 NUEVO: Cargar slot en HUD si el panel tiene loadToHUDSlot asignado
                if (!clickedPanelData.isKeyboardKey && typeof clickedPanelData.loadToHUDSlot === 'number') {
                    console.log(`Panel P${clickedPanelData.orderNumber} clickeado. Cargando Slot ${clickedPanelData.loadToHUDSlot} en HUD.`);
                    (async () => {
                        // Si el HUD no está activo, activarlo primero
                        if (!isHUDActive()) {
                            console.log(`HUD no está activo, activándolo primero...`);
                            const slotConfig = bioSlotsLoadFromSlot(clickedPanelData.loadToHUDSlot);
                            const slotDivisions = slotConfig?.grid?.divisions || currentDivisions;
                            console.log(`Creando HUD con ${slotDivisions} divisiones del slot`);
                            const hudCreated = createHUD(slotDivisions);
                            if (!hudCreated) {
                                console.error('Error al crear HUD. Cargando en grid principal como fallback.');
                                loadFromSlot(clickedPanelData.loadToHUDSlot);
                                return;
                            }
                            // Esperar un frame para asegurar que el HUD esté completamente inicializado
                            await new Promise(resolve => requestAnimationFrame(resolve));
                        }
                        
                        // Verificar que el HUD esté activo y visible antes de cargar
                        const hudScene = getHUDScene();
                        if (hudScene) {
                            hudScene.visible = true;
                            hudScene.traverse((child) => {
                                child.visible = true;
                            });
                        }
                        
                        // Cargar el slot en el HUD
                        await loadFromSlotToHUD(clickedPanelData.loadToHUDSlot);
                    })();
                    // Deseleccionar el panel después de la carga
                    clickedPanelData.selected = false;
                    updatePanelColor(clickedPanelData);
                    return; // Terminar el procesamiento aquí para no interferir con la selección normal
                }
                
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
                        updatePanelColor(clickedPanelData);
                        
                        // Efecto visual de flash
                        clickedPanelData.flashProgress = 0;
                        clickedPanelData.shouldFlash = true;
                        panelsFlashing.add(clickedPanelData);
                    }
                } else {
                    // NUEVA FUNCIONALIDAD: Detectar click en BOTÓN de models y cargar en panel de DISPLAY
                    if (clickedPanelData.modelData && 
                        clickedPanelData.modelData.isModelButton && 
                        clickedPanelData.modelData.isFromModelsGrid) {
                        
                        // Este es un botón de la rejilla 3x3, buscar paneles de DISPLAY
                        const displayPanels = panels.filter(p => 
                            p !== clickedPanelData && 
                            p.modelData && 
                            p.modelData.isModelDisplay &&
                            p.modelData.isFromModelCommand &&
                            p.group && 
                            p.group.children.some(child => child.userData && child.userData.isModel)
                        );
                        
                        if (displayPanels.length > 0) {
                            // Encontramos paneles de DISPLAY, usar el primero
                            const targetDisplayPanel = displayPanels[0];
                            const sourceModelData = clickedPanelData.modelData;
                            
                            console.log(`Transfiriendo modelo ${sourceModelData.name} del BOTÓN #${clickedPanelData.orderNumber} al DISPLAY #${targetDisplayPanel.orderNumber}`);
                            
                            // 🔥 ACTUALIZAR EL ÚLTIMO MODELO CLICKEADO PARA EL COMANDO PRINT
                            lastClickedModelFromGrid = {
                                name: sourceModelData.name,
                                url: sourceModelData.url,
                                scientificName: modelScientificNames[sourceModelData.name] || 'MODELO DESCONOCIDO'
                            };
                            console.log(`📋 Último modelo para print actualizado: ${lastClickedModelFromGrid.name} (${lastClickedModelFromGrid.scientificName})`);
                            
                            // 🔥 BUSCAR Y ACTUALIZAR PANELES DE ESTADÍSTICAS GENÓMICAS (STATG)
                            const statgPanels = panels.filter(p => p.isStatgPanel && !p.isKeyboardKey);
                            if (statgPanels.length > 0) {
                                const currentGridParams = getCurrentGridParams();
                                if (currentGridParams) {
                                    statgPanels.forEach(statgPanel => {
                                        const updated = updateStatgPanelWithModel(statgPanel, sourceModelData.name, currentGridParams);
                                        if (updated) {
                                            console.log(`📊 Panel STATG #${statgPanel.orderNumber} actualizado con modelo ${sourceModelData.name}`);
                                        }
                                    });
                                    
                                    if (statgPanels.length > 0) {
                                        console.log(`🔄 ${statgPanels.length} panel(es) de estadísticas genómicas actualizados automáticamente`);
                                    }
                                }
                            }
                            
                            // Mostrar información en terminal solo si está disponible
                            const terminalOutput = document.querySelector('.terminal-output');
                            if (terminalOutput) {
                                showInfo(`Modelo ${lastClickedModelFromGrid.name} seleccionado para print`, terminalOutput);
                            }
                            
                            // Cargar el modelo del botón en el panel de display
                            loadModelToPanel(targetDisplayPanel, sourceModelData.url, currentGrid.userData.cellSize).then((success) => {
                                if (success) {
                                    // Actualizar datos del modelo en el panel de display (mantener que es display)
                                    targetDisplayPanel.modelData = {
                                        name: sourceModelData.name,
                                        url: sourceModelData.url,
                                        isRotating: true,
                                        rotationSpeed: sourceModelData.rotationSpeed || 0.005,
                                        isModelDisplay: true, // Mantener como display
                                        isFromModelCommand: true, // Mantener origen
                                        scientificName: sourceModelData.scientificName || modelScientificNames[sourceModelData.name] || null // 🔥 NUEVO: Preservar o asignar nombre científico
                                    };
                                    
                                    console.log(`Modelo ${sourceModelData.name} transferido exitosamente al DISPLAY #${targetDisplayPanel.orderNumber}`);
                                    
                                    // Flash visual en el panel de display para indicar la transferencia
                                    targetDisplayPanel.flashProgress = 0;
                                    targetDisplayPanel.shouldFlash = true;
                                    panelsFlashing.add(targetDisplayPanel);
                                } else {
                                    console.error(`Error al transferir modelo ${sourceModelData.name} al DISPLAY #${targetDisplayPanel.orderNumber}`);
                                }
                            }).catch(error => {
                                console.error(`Error al cargar modelo en panel destino:`, error);
                            });
                            
                            // Deseleccionar el panel de models después de la transferencia
                            clickedPanelData.selected = false;
                            updatePanelColor(clickedPanelData);
                            
                            // NUEVA FUNCIONALIDAD: Buscar panel libre para cargar nombre científico
                            const freePanels = findFreePanels();
                            console.log(`🔍 Buscando panel libre para nombre científico. Paneles libres encontrados: ${freePanels.length}`);
                            
                            if (freePanels.length > 0) {
                                const freePanel = freePanels[0];
                                const scientificName = modelScientificNames[sourceModelData.name];
                                
                                console.log(`📄 Modelo: ${sourceModelData.name}, Nombre científico: ${scientificName}`);
                                
                                if (scientificName) {
                                    // Marcar el panel como contenedor de especie (reutilizable)
                                    freePanel.hasText = true;
                                    freePanel.speciesPanel = true; // NUEVO: Marcar como panel de especie
                                    freePanel.speciesName = scientificName; // NUEVO: Guardar nombre de especie
                                    createPanelText(freePanel, currentGrid.userData.cellSize);
                                    setPanelText(freePanel, scientificName, currentGrid.userData.cellSize);
                                    
                                    console.log(`✅ Nombre científico "${scientificName}" cargado en panel de especie #${freePanel.orderNumber}`);
                                    
                                    // Flash visual en el panel de especie para indicar la carga
                                    freePanel.flashProgress = 0;
                                    freePanel.shouldFlash = true;
                                    panelsFlashing.add(freePanel);
                                } else {
                                    console.warn(`⚠️ No se encontró nombre científico para el modelo: ${sourceModelData.name}`);
                                }
                            } else {
                                console.warn(`⚠️ No hay paneles libres disponibles para mostrar el nombre científico`);
                            }
                            
                            return; // Salir temprano para evitar el comportamiento normal de selección
                        }
                    }

                    // NUEVA FUNCIONALIDAD: Avanzar scroll de términos al hacer click en botón AGREE
                    if (clickedPanelData.isAgreeButton && clickedPanelData.termsPanel) {
                        const termsPanel = clickedPanelData.termsPanel;
                        const textState = panelTextState.get(termsPanel);
                        if (textState && textState.useWhiteScrollIndicators) {
                            // Este es el botón AGREE, avanzar scroll del panel de términos
                            const currentGridParams = getCurrentGridParams();
                            if (currentGridParams) {
                                // Calcular dimensiones del panel de términos
                                const panelHeight = (termsPanel.maxCellIndex.y - termsPanel.minCellIndex.y + 1);
                                const panelWidth = (termsPanel.maxCellIndex.x - termsPanel.minCellIndex.x + 1);
                                const width = panelWidth * currentGridParams.cellSize;
                                const height = panelHeight * currentGridParams.cellSize;
                                const paddingSize = currentGridParams.cellSize;
                                const textAreaHeight = height - (paddingSize * 2);
                                
                                // Calcular número máximo de líneas visibles
                                const isUniline = panelHeight <= 3;
                                const isTooSmall = textAreaHeight < (currentGridParams.cellSize * TEXT_CONFIG.fontSize * 0.8);
                                
                                let effectiveLineHeight;
                                if (isTooSmall || isUniline) {
                                    effectiveLineHeight = panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                                         panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                                         panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                                         TEXT_CONFIG.lineHeight;
                                } else {
                                    effectiveLineHeight = TEXT_CONFIG.lineHeight;
                                }
                                
                                const maxVisibleLines = isUniline ? 1 : Math.max(1, Math.floor(textAreaHeight / (currentGridParams.cellSize * effectiveLineHeight)));
                                
                                // Avanzar scrollOffset en una pantalla
                                const newScrollOffset = Math.min(
                                    textState.scrollOffset + maxVisibleLines,
                                    Math.max(0, textState.lines.length - maxVisibleLines)
                                );
                                
                                // 🔥 CRITICAL: Asegurar que el panel de términos NO flashee al actualizar texto
                                const wasFlashing = termsPanel.shouldFlash;
                                const wasInFlashingSet = panelsFlashing.has(termsPanel);
                                
                                if (newScrollOffset !== textState.scrollOffset) {
                                    textState.scrollOffset = newScrollOffset;
                                    createPanelText(termsPanel, currentGridParams.cellSize);
                                    console.log(`📜 Scroll de términos avanzado (AGREE): ${textState.scrollOffset}/${textState.lines.length - maxVisibleLines}`);
                                } else {
                                    // Si ya está al final, volver al inicio
                                    textState.scrollOffset = 0;
                                    createPanelText(termsPanel, currentGridParams.cellSize);
                                    console.log(`📜 Scroll de términos reiniciado al inicio (AGREE)`);
                                }
                                
                                // 🔥 CRITICAL: Flash visual en el botón I AGREE y el panel de términos
                                // Solo estos dos paneles deben flashear, no todos los paneles
                                startFlash(clickedPanelData);
                                
                                // También hacer flash en el panel de términos
                                termsPanel.flashProgress = 0;
                                termsPanel.shouldFlash = true;
                                panelsFlashing.add(termsPanel);
                                
                                return; // Salir para evitar selección normal
                            }
                        }
                    }
                    
                    // 🔥 PRIORIDAD MÁXIMA: ACTIVAR GLITCH SI EL PANEL ESTÁ PREPARADO
                    if (clickedPanelData.glitchReady) {
                        console.log(`🔥 GLITCH ACTIVADO! Panel #${clickedPanelData.orderNumber} clickeado`);
                        startGlitchEffect(clickedPanelData);
                        
                        // Desmarcar el panel como preparado para glitch
                        clickedPanelData.glitchReady = false;
                        clickedPanelData.shouldFlash = false;
                        panelsFlashing.delete(clickedPanelData);
                        
                        return; // ¡IMPORTANTE! Salir para evitar selección normal
                    }
                    
                    // 🔥 COMPORTAMIENTO MEJORADO DE MULTISELECCIÓN
                    if (event.shiftKey || event.ctrlKey) {
                        // Con Shift/Ctrl: Alternar selección (multiselección)
                    clickedPanelData.selected = !clickedPanelData.selected; 
                        
                        // 🔥 ACTUALIZAR VISUAL DE TODOS LOS PANELES SELECCIONADOS
                        refreshSelectedPanelsColors();
                        
                        const selectedCount = panels.filter(p => p.selected).length;
                        const selectedNumbers = panels.filter(p => p.selected).map(p => `P${p.orderNumber}`).join(', ');
                        console.log(`🔄 Multiselección: Panel P${clickedPanelData.orderNumber} ${clickedPanelData.selected ? 'seleccionado' : 'deseleccionado'}. Total seleccionados: ${selectedCount} (${selectedNumbers})`);
                        
                        // Añadir efecto flash para confirmar la acción
                        clickedPanelData.flashProgress = 0;
                        clickedPanelData.shouldFlash = true;
                        panelsFlashing.add(clickedPanelData);
                        
                        // 🔥 NUEVA FUNCIONALIDAD: Si el panel seleccionado tiene modelo y hay un viewer activo, cargarlo en el viewer
                        if (clickedPanelData.selected && clickedPanelData.modelData && clickedPanelData.modelData.url && 
                            !clickedPanelData.modelData.isViewer && !clickedPanelData.isViewer) {
                            
                            // Buscar paneles viewer activos
                            const viewerPanels = panels.filter(p => 
                                p !== clickedPanelData && 
                                p.isViewer && 
                                p.modelData && 
                                p.modelData.isViewer &&
                                !p.isKeyboardKey
                            );
                            
                            if (viewerPanels.length > 0) {
                                const viewerPanel = viewerPanels[0];
                                const sourceModelData = clickedPanelData.modelData;
                                const currentGridParams = getCurrentGridParams();
                                
                                if (currentGridParams && sourceModelData.url) {
                                    loadModelToPanel(viewerPanel, sourceModelData.url, currentGridParams.cellSize).then((success) => {
                                        if (success) {
                                            viewerPanel.modelData.name = sourceModelData.name;
                                            viewerPanel.modelData.url = sourceModelData.url;
                                            viewerPanel.modelData.isRotating = true;
                                            viewerPanel.modelData.rotationSpeed = sourceModelData.rotationSpeed || 0.005;
                                            viewerPanel.modelData.scientificName = sourceModelData.scientificName || modelScientificNames[sourceModelData.name] || null; // 🔥 NUEVO: Preservar o asignar nombre científico
                                            
                                            console.log(`🖼️ Modelo ${sourceModelData.name} cargado en viewer #${viewerPanel.orderNumber} (multiselección)`);
                                            
                                            // Mostrar nombre científico en el panel libre más cercano al viewer
                                            const closestFreePanel = findClosestFreePanel(viewerPanel);
                                            if (closestFreePanel) {
                                                const scientificName = modelScientificNames[sourceModelData.name];
                                                
                                                if (scientificName) {
                                                    closestFreePanel.hasText = true;
                                                    closestFreePanel.speciesPanel = true;
                                                    closestFreePanel.speciesName = scientificName;
                                                    createPanelText(closestFreePanel, currentGridParams.cellSize);
                                                    setPanelText(closestFreePanel, scientificName, currentGridParams.cellSize);
                                                    
                                                    // Flash visual en el panel de especie
                                                    closestFreePanel.flashProgress = 0;
                                                    closestFreePanel.shouldFlash = true;
                                                    panelsFlashing.add(closestFreePanel);
                                                    
                                                    console.log(`📄 Nombre científico "${scientificName}" mostrado en panel #${closestFreePanel.orderNumber} (multiselección, más cercano al viewer)`);
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        }
                } else {
                    // --- Click Normal: Deseleccionar todos y seleccionar solo este --- 
                        let deselectedPanels = [];
                    panels.forEach(p => {
                        if (p !== clickedPanelData && p.selected) {
                            p.selected = false;
                            updatePanelColor(p);
                                deselectedPanels.push(`P${p.orderNumber}`);
                        }
                    });
                        
                       clickedPanelData.selected = true; 
                       updatePanelColor(clickedPanelData);
                        
                        if (deselectedPanels.length > 0) {
                            console.log(`✋ Selección única: Deseleccionados ${deselectedPanels.join(', ')}, seleccionado P${clickedPanelData.orderNumber}`);
                        } else {
                            console.log(`✅ Panel P${clickedPanelData.orderNumber} seleccionado`);
                        }
                        
                        // 🔥 NUEVA FUNCIONALIDAD: Si el panel seleccionado tiene modelo y hay un viewer activo, cargarlo en el viewer
                        if (clickedPanelData.modelData && clickedPanelData.modelData.url && 
                            !clickedPanelData.modelData.isViewer && !clickedPanelData.isViewer) {
                            
                            // Buscar paneles viewer activos
                            const viewerPanels = panels.filter(p => 
                                p !== clickedPanelData && 
                                p.isViewer && 
                                p.modelData && 
                                p.modelData.isViewer &&
                                !p.isKeyboardKey
                            );
                            
                            if (viewerPanels.length > 0) {
                                const viewerPanel = viewerPanels[0];
                                const sourceModelData = clickedPanelData.modelData;
                                const currentGridParams = getCurrentGridParams();
                                
                                if (currentGridParams && sourceModelData.url) {
                                    loadModelToPanel(viewerPanel, sourceModelData.url, currentGridParams.cellSize).then((success) => {
                                        if (success) {
                                            viewerPanel.modelData.name = sourceModelData.name;
                                            viewerPanel.modelData.url = sourceModelData.url;
                                            viewerPanel.modelData.isRotating = true;
                                            viewerPanel.modelData.rotationSpeed = sourceModelData.rotationSpeed || 0.005;
                                            viewerPanel.modelData.scientificName = sourceModelData.scientificName || modelScientificNames[sourceModelData.name] || null; // 🔥 NUEVO: Preservar o asignar nombre científico
                                            
                                            console.log(`🖼️ Modelo ${sourceModelData.name} cargado en viewer #${viewerPanel.orderNumber}`);
                                            
                                            // Mostrar nombre científico en el panel libre más cercano al viewer
                                            const closestFreePanel = findClosestFreePanel(viewerPanel);
                                            if (closestFreePanel) {
                                                const scientificName = modelScientificNames[sourceModelData.name];
                                                
                                                if (scientificName) {
                                                    closestFreePanel.hasText = true;
                                                    closestFreePanel.speciesPanel = true;
                                                    closestFreePanel.speciesName = scientificName;
                                                    createPanelText(closestFreePanel, currentGridParams.cellSize);
                                                    setPanelText(closestFreePanel, scientificName, currentGridParams.cellSize);
                                                    
                                                    // Flash visual en el panel de especie
                                                    closestFreePanel.flashProgress = 0;
                                                    closestFreePanel.shouldFlash = true;
                                                    panelsFlashing.add(closestFreePanel);
                                                    
                                                    console.log(`📄 Nombre científico "${scientificName}" mostrado en panel #${closestFreePanel.orderNumber} (más cercano al viewer)`);
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        }
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
                        deselectedSomething = true;
                    }
                });
                
                // 🔥 REFRESCAR VISUAL DESPUÉS DE DESELECCIONAR
                if (deselectedSomething) {
                    refreshAllPanelColors();
                }
    
                // Iniciar selección por arrastre
                    isSelecting = true;
                    controls.enabled = false; 
                    startPoint = { x: event.clientX, y: event.clientY };
                    endPoint = { x: event.clientX, y: event.clientY };
                    
                    // 🔥 CAPTURAR ESTADO DE TECLAS MODIFICADORAS AL INICIO DE LA SELECCIÓN
                    selectionModifierKeys.shiftKey = event.shiftKey;
                    selectionModifierKeys.ctrlKey = event.ctrlKey;
                    selectionModifierKeys.altKey = event.altKey;
                    
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

        // PRIORIDAD ABSOLUTA: Si el HUD está activo, verificar solo paneles del HUD primero
        let intersects = [];
        
        if (isHUDActive()) {
            const hudPanelsList = getHUDPanels();
            const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
            const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
            const hudHoverables = [...hudFillMeshes, ...hudBorderLines];
            intersects = raycaster.intersectObjects(hudHoverables, false)
                .sort((a, b) => a.distance - b.distance);
            // NO verificar grid principal cuando HUD está activo - elementos del fondo no son hoverables
        } else {
            const allHoverables = [];
            panels.forEach(panel => {
                if (panel.fillMesh && (!panel.fillMesh.userData || !panel.fillMesh.userData.ignoreRaycast)) {
                    allHoverables.push(panel.fillMesh);
                }
                if (panel.borderLines) {
                    panel.borderLines.forEach(line => {
                        if (!line.userData || !line.userData.ignoreRaycast) {
                            allHoverables.push(line);
                        }
                    });
                }
            });
            intersects = raycaster.intersectObjects(allHoverables, false)
                .sort((a, b) => a.distance - b.distance);
        }

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
                
                // 🔥 CRITICAL FIX: Detectar y guardar información de texturas (logo, apps)
                let textureInfo = null;
                if (panel.hasTexture && panel.fillMesh && panel.fillMesh.material && panel.fillMesh.material.map) {
                    const texture = panel.fillMesh.material.map;
                    // Intentar determinar el tipo de textura y su ruta
                    // Para logo: siempre es './public/img/bioprint_logo.png'
                    // Para apps: necesitamos guardar el índice del icono o la ruta completa
                    // Por ahora, guardamos la ruta si está disponible o inferimos del tipo
                    
                    // Guardar UVs personalizadas si existen (para logo con "contain")
                    const geometry = panel.fillMesh.geometry;
                    const uvAttribute = geometry.attributes.uv;
                    let customUVs = null;
                    if (uvAttribute && uvAttribute.count > 0) {
                        // Guardar solo si los UVs no son estándar (0-1 stretch)
                        // Verificamos si hay transformación "contain" aplicada
                        const firstU = uvAttribute.getX(0);
                        const firstV = uvAttribute.getY(1);
                        // Si los UVs están fuera del rango 0-1 o centrados, son custom
                        if (firstU < 0 || firstU > 1 || firstV < 0 || firstV > 1 || 
                            (Math.abs(firstU - 0.5) > 0.1 && Math.abs(firstV - 0.5) > 0.1)) {
                            customUVs = [];
                            for (let i = 0; i < uvAttribute.count; i++) {
                                customUVs.push({
                                    u: uvAttribute.getX(i),
                                    v: uvAttribute.getY(i)
                                });
                            }
                        }
                    }
                    
                    // Determinar tipo de textura
                    // Verificar si el panel tiene logo activo usando la función exportada
                    const hasLogoActive = hasLogo(panel);
                    let textureType = panel.textureType || 'unknown';
                    let texturePath = panel.texturePath || null;
                    
                    // Si tiene logo activo, marcar como logo
                    if (hasLogoActive) {
                        textureType = 'logo';
                        texturePath = './public/img/bioprint_logo.png';
                    } else if (panel.textureType === 'app' || texturePath?.includes('apps.png')) {
                        // Para apps, necesitamos guardar el índice del icono si está disponible
                        textureType = 'app';
                        texturePath = texturePath || './img/apps.png';
                        // Intentar inferir el índice del icono desde las UVs si es posible
                        // (esto se puede mejorar más adelante)
                    }
                    
                    textureInfo = {
                        hasTexture: true,
                        textureType: textureType, // 'logo', 'app', 'custom'
                        texturePath: texturePath, // Ruta de la textura
                        customUVs: customUVs, // UVs personalizadas para "contain" o mapeo de apps
                        // Guardar dimensiones de imagen para recalcular aspect ratio
                        imageAspect: texture.image ? (texture.image.width / texture.image.height) : null,
                        hasLogoActive: hasLogoActive // 🔥 NUEVO: Guardar si tiene logo activo
                    };
                } else if (hasLogo(panel)) {
                    // Si no tiene textura en fillMesh pero tiene logo activo, guardar info de logo
                    textureInfo = {
                        hasTexture: true,
                        textureType: 'logo',
                        texturePath: './public/img/bioprint_logo.png',
                        customUVs: null,
                        imageAspect: null,
                        hasLogoActive: true
                    };
                }
                
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
                    isModelingPanel: !!panel.isModelingPanel, // Marcar paneles de modeling
                    pendingModelingCommand: !!panel.pendingModelingCommand, // Guardar comando modeling pendiente
                    pendingPrintCommand: !!panel.pendingPrintCommand, // Guardar comando print pendiente
                    printCommandArgs: Array.isArray(panel.printCommandArgs) ? [...panel.printCommandArgs] : [], // Guardar argumentos del comando print
                    pendingPrintSimpleCommand: !!panel.pendingPrintSimpleCommand, // Guardar comando print simple pendiente
                    pendingPrintPercentCommand: !!panel.pendingPrintPercentCommand, // Guardar comando print percent pendiente
                    printPercentDuration: typeof panel.printPercentDuration === 'number' ? panel.printPercentDuration : undefined, // Guardar duración en milisegundos
                    navigateToSlot: typeof panel.navigateToSlot === 'number' ? panel.navigateToSlot : undefined, // Guardar navegación a slot
                    loadToHUDSlot: typeof panel.loadToHUDSlot === 'number' ? panel.loadToHUDSlot : undefined, // 🔥 NUEVO: Guardar trigger HUD
            behavior: {
                        hasText: !!panel.hasText,
                        textContent: typeof currentText === 'string' ? currentText : '',
                        messageBuffer: Array.isArray(textState?.lines) ? [...textState.lines] : [],
                        maxLines: typeof textState?.maxCharsPerLine === 'number' ? textState.maxCharsPerLine : 0,
                        isPassword: !!textState?.isPassword,
                        textAlign: textState?.textAlign || 'center', // Guardar alineación de texto
                        verticalAlign: textState?.verticalAlign || 'middle', // Guardar alineación vertical
                        useWhiteScrollIndicators: !!textState?.useWhiteScrollIndicators, // 🔥 NUEVO: Guardar indicadores de scroll blancos (para términos)
                isGATCActive: gatcIntervals.has(panel),
                        isSpeciesPanel: !!panel.speciesPanel, // NUEVO: Guardar si es panel de especie
                        speciesName: panel.speciesName || null, // NUEVO: Guardar nombre de especie
                modelData: panel.modelData ? {
                            modelUrl: typeof panel.modelData.url === 'string' ? panel.modelData.url : '',
                            modelName: typeof panel.modelData.name === 'string' ? panel.modelData.name : '', // 🔥 NUEVO: Guardar nombre del modelo
                            isRotating: !!panel.modelData.isRotating,
                            rotationSpeed: typeof panel.modelData.rotationSpeed === 'number' ? panel.modelData.rotationSpeed : 0.005,
                            isModelButton: !!panel.modelData.isModelButton, // Guardar tipo botón
                            isFromModelsGrid: !!panel.modelData.isFromModelsGrid, // Guardar origen rejilla
                            isModelDisplay: !!panel.modelData.isModelDisplay, // Guardar tipo display
                            isFromModelCommand: !!panel.modelData.isFromModelCommand, // Guardar origen comando
                            isViewer: !!panel.modelData.isViewer || !!panel.isViewer, // 🔥 NUEVO: Guardar tipo viewer (también desde panel.isViewer)
                            scientificName: typeof panel.modelData.scientificName === 'string' ? panel.modelData.scientificName : null // 🔥 NUEVO: Guardar nombre científico si existe
                } : (panel.isViewer ? {
                            // 🔥 NUEVO: Si el panel es viewer pero no tiene modelData, guardar la identidad de viewer
                            modelUrl: '',
                            modelName: '',
                            isRotating: false,
                            rotationSpeed: 0.005,
                            isModelButton: false,
                            isFromModelsGrid: false,
                            isModelDisplay: false,
                            isFromModelCommand: false,
                            isViewer: true,
                            scientificName: null
                } : null),
                    genomData: panel.genomData || null,
                    textureInfo: textureInfo, // 🔥 NUEVO: Guardar información de texturas
                    isAgreeButton: !!panel.isAgreeButton, // Guardar si es botón I AGREE
                    termsPanelOrderNumber: panel.isAgreeButton && panel.termsPanel ? panel.termsPanel.orderNumber : null, // Guardar referencia al panel de términos
                    modalData: getModalBehaviorData(panel) // 🔥 NUEVO: Guardar información del modal
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
        // 🔥 CRITICAL FIX: No cargar si la animación inicial aún está en progreso o el grid no está listo
        if (isFirstGridCreation || gridAnimationInProgress || !currentGrid) {
            console.log('Esperando a que termine la animación inicial y el grid esté listo...');
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
        
        // Reiniciar estado de modeling si estaba activo
        isPrintingActive = false;

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

            // Separar paneles de modeling del resto
            const modelingPanels = [];
            const regularPanels = [];
            
            config.panels.forEach(panelInfo => {
                if (panelInfo.isModelingPanel) {
                    modelingPanels.push(panelInfo);
                } else {
                    regularPanels.push(panelInfo);
                }
            });
            
            // Si hay paneles de modeling, restaurar la interfaz completa desde 0
            if (modelingPanels.length > 0) {
                console.log(`Detectados ${modelingPanels.length} paneles de modeling, restaurando interfaz completa desde 0`);
                restoreModelingInterface(modelingPanels, currentGridParams);
            }
            
            // Cargar solo los paneles que NO son teclas del teclado y NO son paneles de modeling
            regularPanels.forEach(panelInfo => {
                
                const panelData = {
                    group: null,
                    minCellIndex: { x: panelInfo.minCellIndex.x, y: panelInfo.minCellIndex.y },
                    maxCellIndex: { x: panelInfo.maxCellIndex.x, y: panelInfo.maxCellIndex.y },
                    orderNumber: panelInfo.orderNumber,
                    showOrderNumber: panelInfo.showOrderNumber,
                    hasText: panelInfo.behavior?.hasText || false,
                    // 🔥 NUEVO: Restaurar propiedades de identidad del panel ANTES de restaurar comportamiento
                    isModelingPanel: !!panelInfo.isModelingPanel,
                    pendingModelingCommand: !!panelInfo.pendingModelingCommand,
                    pendingPrintCommand: !!panelInfo.pendingPrintCommand,
                    printCommandArgs: Array.isArray(panelInfo.printCommandArgs) ? [...panelInfo.printCommandArgs] : [],
                    pendingPrintSimpleCommand: !!panelInfo.pendingPrintSimpleCommand,
                    pendingPrintPercentCommand: !!panelInfo.pendingPrintPercentCommand,
                    printPercentDuration: typeof panelInfo.printPercentDuration === 'number' ? panelInfo.printPercentDuration : undefined,
                    navigateToSlot: typeof panelInfo.navigateToSlot === 'number' ? panelInfo.navigateToSlot : undefined, // Restaurar navegación a slot
                    loadToHUDSlot: typeof panelInfo.loadToHUDSlot === 'number' ? panelInfo.loadToHUDSlot : undefined // 🔥 NUEVO: Restaurar trigger HUD
                };

                updatePanelGeometryAndPosition(panelData, currentGridParams);
                
                if(panelData.group) {
                    scene.add(panelData.group);
                    panels.push(panelData);

                    // 🔥 NUEVO: Restaurar identidad de viewer incluso sin modelo cargado
                    if (panelInfo.behavior && panelInfo.behavior.modelData && panelInfo.behavior.modelData.isViewer) {
                        if (!panelData.modelData) {
                            panelData.modelData = {};
                        }
                        panelData.modelData.isViewer = true;
                        panelData.isViewer = true;
                    }

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
                                realText: panelInfo.behavior.isPassword ? panelInfo.behavior.textContent : '',
                                textAlign: panelInfo.behavior.textAlign || 'center', // Restaurar alineación de texto
                                verticalAlign: panelInfo.behavior.verticalAlign || 'middle', // Restaurar alineación vertical
                                useWhiteScrollIndicators: !!panelInfo.behavior.useWhiteScrollIndicators // 🔥 NUEVO: Restaurar indicadores de scroll blancos (para términos)
                            };
                            panelTextState.set(panelData, textState);
                            
                            createPanelText(panelData, currentGridParams.cellSize);
                            if (textState.isPassword) {
                                setPanelText(panelData, '*'.repeat(textState.realText.length), currentGridParams.cellSize);
                            } else {
                                setPanelText(panelData, panelInfo.behavior.textContent, currentGridParams.cellSize);
                            }
                            
                            // Restaurar botón I AGREE si existe
                            if (panelInfo.behavior.isAgreeButton && panelInfo.behavior.termsPanelOrderNumber) {
                                panelData.isAgreeButton = true;
                                // Buscar el panel de términos por orderNumber (puede no estar cargado aún, buscar después)
                                setTimeout(() => {
                                    const termsPanel = panels.find(p => p.orderNumber === panelInfo.behavior.termsPanelOrderNumber);
                                    if (termsPanel) {
                                        panelData.termsPanel = termsPanel;
                                        console.log(`Botón I AGREE restaurado en panel #${panelData.orderNumber} vinculado a términos en panel #${termsPanel.orderNumber}`);
                                        
                                        // 🔥 CRITICAL: Asegurar que el panel de términos tenga useWhiteScrollIndicators activado
                                        const termsTextState = panelTextState.get(termsPanel);
                                        if (termsTextState) {
                                            termsTextState.useWhiteScrollIndicators = true;
                                            console.log(`Indicadores de scroll blancos activados para panel de términos #${termsPanel.orderNumber}`);
                                        }
                                    }
                                }, 100);
                            }
                        }

                        if (panelInfo.behavior.isGATCActive) {
                            handleGATCCommand({ 
                                appendChild: () => {}, // Mock output para la función
                                innerHTML: ''
                            }, panelData);
                        }

                        if (panelInfo.behavior.modelData && panelInfo.behavior.modelData.modelUrl) {
                            const { modelUrl, modelName, isRotating, rotationSpeed, isModelButton, isFromModelsGrid, isModelDisplay, isFromModelCommand, isViewer, scientificName } = panelInfo.behavior.modelData;
                            loadModelToPanel(panelData, modelUrl, currentGridParams.cellSize).then(() => {
                                // 🔥 CRITICAL: Asegurar que modelData existe
                                if (!panelData.modelData) {
                                    panelData.modelData = {};
                                }
                                
                                // 🔥 CRITICAL: Restaurar URL del modelo (necesario para interacción con viewer)
                                panelData.modelData.url = modelUrl;
                                
                                // 🔥 CRITICAL: Restaurar TODAS las propiedades del modelo
                                if (modelName) {
                                    panelData.modelData.name = modelName;
                                    // 🔥 NUEVO: Si no hay scientificName guardado pero hay modelName, asignarlo desde el mapeo
                                    if (!scientificName && modelName) {
                                        panelData.modelData.scientificName = modelScientificNames[modelName] || null;
                                    }
                                }
                                if (scientificName) {
                                    panelData.modelData.scientificName = scientificName;
                                }
                                
                                // Restaurar las propiedades específicas del tipo de panel
                                if (isModelButton) {
                                    panelData.modelData.isModelButton = true;
                                    panelData.modelData.isFromModelsGrid = !!isFromModelsGrid;
                                } else if (isModelDisplay) {
                                    panelData.modelData.isModelDisplay = true;
                                    panelData.modelData.isFromModelCommand = !!isFromModelCommand;
                                } else if (isViewer) {
                                    panelData.modelData.isViewer = true;
                                    panelData.isViewer = true;
                                }
                                
                                if (isRotating) {
                                    if (!panelData.modelData.isRotating) toggleModelRotation(panelData);
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

                    // Ejecutar comando modeling si está pendiente
                    // 🔥 CRITICAL: La propiedad ya se restauró arriba, ahora solo ejecutamos el comando
                    if (panelData.pendingModelingCommand) {
                        // Crear un output mock para la función
                        const mockOutput = {
                            appendChild: () => {},
                            innerHTML: ''
                        };
                        // Ejecutar el comando modeling con el panel restaurado
                        setTimeout(() => {
                            executeModelingCommand(panelData, mockOutput);
                        }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                    }
                    
                    if (panelInfo.pendingPrintCommand) {
                        // Crear un output mock para la función
                        const mockOutput = {
                            appendChild: () => {},
                            innerHTML: ''
                        };
                        // Ejecutar el comando print con el panel restaurado y los argumentos guardados
                        const printArgs = Array.isArray(panelInfo.printCommandArgs) ? panelInfo.printCommandArgs : [];
                        setTimeout(() => {
                            executePrintCommand(panelData, printArgs, mockOutput);
                        }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                    }
                    
                    if (panelInfo.pendingPrintSimpleCommand) {
                        // Crear un output mock para la función
                        const mockOutput = {
                            appendChild: () => {},
                            innerHTML: ''
                        };
                        // Ejecutar el comando print simple
                        setTimeout(() => {
                            executePrintSimpleCommand(panelData, mockOutput);
                        }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                    }
                    
                    if (panelInfo.pendingPrintPercentCommand && typeof panelInfo.printPercentDuration === 'number') {
                        // Crear un output mock para la función
                        const mockOutput = {
                            appendChild: () => {},
                            innerHTML: ''
                        };
                        // Ejecutar el comando print percent con la duración guardada
                        setTimeout(() => {
                            executePrintPercentCommand(panelData, panelInfo.printPercentDuration, mockOutput);
                        }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
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

// Función para restaurar la interfaz de modeling desde paneles guardados
function restoreModelingInterface(modelingPanels, currentGridParams) {
    if (!modelingPanels || modelingPanels.length === 0) {
        console.warn('No hay paneles de modeling para restaurar');
        return;
    }
    
    // Restaurar cada panel de modeling en su posición original
    const restoredPanels = {
        modelingTitlePanel: null,
        cyclicBarPanel: null,
        progressBarPanel: null,
        percentagePanel: null,
        remainingTimePanel: null,
        totalTimePanel: null,
        modelPanel: null
    };
    
    // Ordenar paneles por posición Y (de arriba a abajo) para identificar mejor
    const sortedPanels = [...modelingPanels].sort((a, b) => {
        const aY = a.minCellIndex.y;
        const bY = b.minCellIndex.y;
        if (aY !== bY) return bY - aY; // Más arriba primero (Y mayor)
        return a.minCellIndex.x - b.minCellIndex.x; // Luego por X
    });
    
    // Identificar cada panel por su posición y tamaño
    for (const panelInfo of sortedPanels) {
        const width = panelInfo.maxCellIndex.x - panelInfo.minCellIndex.x + 1;
        const height = panelInfo.maxCellIndex.y - panelInfo.minCellIndex.y + 1;
        const textContent = panelInfo.behavior?.textContent || '';
        
        // Crear el panel en su posición original
        const panelData = {
            group: null,
            minCellIndex: { x: panelInfo.minCellIndex.x, y: panelInfo.minCellIndex.y },
            maxCellIndex: { x: panelInfo.maxCellIndex.x, y: panelInfo.maxCellIndex.y },
            orderNumber: panelInfo.orderNumber,
            showOrderNumber: panelInfo.showOrderNumber || false,
            hasText: panelInfo.behavior?.hasText || false,
            isModelingPanel: true
        };
        
        updatePanelGeometryAndPosition(panelData, currentGridParams);
        
        if (panelData.group) {
            scene.add(panelData.group);
            panels.push(panelData);
            
            // Identificar el tipo de panel por su contenido, tamaño y posición
            // Título: contiene "MODELING" o mensajes de modeling
            if (textContent && (textContent.includes('MODELING') || textContent.includes('Modeling user') || 
                textContent.includes('Creating embeddings') || textContent.includes('Scraping') ||
                textContent.includes('User Modeling Completed'))) {
                if (!restoredPanels.modelingTitlePanel) {
                    restoredPanels.modelingTitlePanel = panelData;
                }
            }
            // MODELING USER DATA: contiene "MODELING USER DATA"
            else if (textContent && textContent.includes('MODELING USER DATA')) {
                restoredPanels.modelPanel = panelData;
            }
            // Porcentaje: contiene "%"
            else if (textContent && textContent.includes('%')) {
                restoredPanels.percentagePanel = panelData;
            }
            // ESTIMATED: contiene "ESTIMATED" o "RESTANTE"
            else if (textContent && (textContent.includes('ESTIMATED') || textContent.includes('RESTANTE'))) {
                restoredPanels.totalTimePanel = panelData;
            }
            // Tiempo restante: contiene "s" o ":" (formato de tiempo)
            else if (textContent && (textContent.match(/\d+s/) || (textContent.includes(':') && textContent.length < 20))) {
                restoredPanels.remainingTimePanel = panelData;
            }
            // Barras de progreso: altura 1, ancho grande, sin texto o texto vacío
            else if (height === 1 && width > 10) {
                // La primera barra de altura 1 es la cíclica (más arriba)
                if (!restoredPanels.cyclicBarPanel) {
                    restoredPanels.cyclicBarPanel = panelData;
                }
                // La segunda barra de altura 1 es la principal
                else if (!restoredPanels.progressBarPanel) {
                    restoredPanels.progressBarPanel = panelData;
                }
            }
            
            // Restaurar texto si tiene
            if (panelData.hasText && textContent) {
                panelData.isTextContainer = true;
                createPanelText(panelData, currentGridParams.cellSize);
                setPanelText(panelData, textContent, currentGridParams.cellSize);
                
                // Si es el panel de porcentaje, aplicar tamaño doble
                if (restoredPanels.percentagePanel === panelData) {
                    const percentageState = panelTextState.get(panelData);
                    if (percentageState) {
                        percentageState.customFontSize = 3.6;
                        createPanelText(panelData, currentGridParams.cellSize);
                    }
                }
            }
        }
    }
    
    // Inicializar la funcionalidad de modeling con los paneles restaurados
    initializeModelingFromPanels(restoredPanels, currentGridParams);
}

// Función para inicializar la funcionalidad de modeling desde paneles restaurados
function initializeModelingFromPanels(restoredPanels, currentGridParams) {
    const { modelingTitlePanel, cyclicBarPanel, progressBarPanel, percentagePanel, remainingTimePanel, totalTimePanel, modelPanel } = restoredPanels;
    
    if (!modelingTitlePanel || !cyclicBarPanel || !progressBarPanel || !percentagePanel) {
        console.warn('No se pudieron restaurar todos los paneles necesarios para modeling');
        return;
    }
    
    // Mostrar todos los paneles
    [modelingTitlePanel, cyclicBarPanel, progressBarPanel, percentagePanel, remainingTimePanel, totalTimePanel, modelPanel].forEach(panel => {
        if (panel && panel.group) panel.group.visible = true;
    });
    
    // Configurar panel de progreso como barra usando bioLoad.js
    import("./bioLoad.js").then(bioLoadModule => {
        // Configurar barra de progreso principal
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 64;
        
        progressBarPanel.progressCanvas = canvas;
        progressBarPanel.progressCtx = canvas.getContext('2d');
        progressBarPanel.progressTexture = new THREE.CanvasTexture(canvas);
        
        const progressNormalMaterial = new THREE.MeshBasicMaterial({
            map: progressBarPanel.progressTexture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        progressBarPanel.hasTexture = true;
        progressBarPanel.textureMaterials = {
            normal: progressNormalMaterial,
            hover: progressNormalMaterial,
            selected: progressNormalMaterial
        };
        
        // Aplicar material a todos los meshes del panel
        if (progressBarPanel.fillMesh) {
            if (progressBarPanel.fillMesh.material) {
                progressBarPanel.fillMesh.material.dispose();
            }
            progressBarPanel.fillMesh.material = progressNormalMaterial;
        }
        
        // Asegurar que el material se aplique a todos los estados
        if (progressBarPanel.group) {
            progressBarPanel.group.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.dispose();
                    child.material = progressNormalMaterial;
                }
            });
        }
        
        progressBarPanel.drawProgress = function(progress, pulse = 0) {
            if (!progressBarPanel.progressCtx || !progressBarPanel.progressTexture) return;
            
            bioLoadModule.updateProgressBar(
                progressBarPanel.progressCtx,
                progressBarPanel.progressCanvas.width,
                progressBarPanel.progressCanvas.height,
                progress,
                pulse
            );
            progressBarPanel.progressTexture.needsUpdate = true;
            Object.values(progressBarPanel.textureMaterials).forEach(material => {
                if (material && material.map) {
                    material.map.needsUpdate = true;
                }
            });
        };
        
        // Configurar barra cíclica
        if (cyclicBarPanel) {
            const cyclicCanvas = document.createElement('canvas');
            cyclicCanvas.width = 1024;
            cyclicCanvas.height = 32;
            
            cyclicBarPanel.progressCanvas = cyclicCanvas;
            cyclicBarPanel.progressCtx = cyclicCanvas.getContext('2d');
            cyclicBarPanel.progressTexture = new THREE.CanvasTexture(cyclicCanvas);
            cyclicBarPanel.cycleProgress = 0;
            cyclicBarPanel.cycleSpeed = Math.random() * 1.5 + 0.5;
            cyclicBarPanel.cycleCount = 0;
            
            const cyclicNormalMaterial = new THREE.MeshBasicMaterial({
                map: cyclicBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            cyclicBarPanel.hasTexture = true;
            cyclicBarPanel.textureMaterials = {
                normal: cyclicNormalMaterial,
                hover: cyclicNormalMaterial,
                selected: cyclicNormalMaterial
            };
            
            if (cyclicBarPanel.fillMesh) {
                cyclicBarPanel.fillMesh.material.dispose();
                cyclicBarPanel.fillMesh.material = cyclicNormalMaterial;
            }
            
            let lastCycleCount = 0;
            
            cyclicBarPanel.updateCyclicBar = function() {
                if (!cyclicBarPanel.progressCtx || !cyclicBarPanel.progressTexture) return;
                
                cyclicBarPanel.cycleProgress += cyclicBarPanel.cycleSpeed;
                
                if (cyclicBarPanel.cycleProgress > 100) {
                    cyclicBarPanel.cycleProgress = 0;
                    cyclicBarPanel.cycleCount++;
                    cyclicBarPanel.cycleSpeed = Math.random() * 2.0 + 0.5;
                    
                    // Cambiar mensaje cuando se complete un ciclo
                    if (cyclicBarPanel.cycleCount > lastCycleCount) {
                        lastCycleCount = cyclicBarPanel.cycleCount;
                        const MODELING_MESSAGES = [
                            "Modeling user preferences", "Creating embeddings", "Scraping user interactions",
                            "Analyzing behavioral patterns", "Extracting feature vectors", "Building user profile",
                            "Processing click streams", "Mapping user journey", "Identifying preferences",
                            "Generating recommendations", "Training ML models", "Optimizing algorithms",
                            "Calculating similarity scores", "Clustering user segments", "Validating data integrity",
                            "Normalizing datasets", "Feature engineering", "Dimensionality reduction",
                            "Cross-validation", "Hyperparameter tuning", "Model evaluation", "A/B testing",
                            "Performance metrics", "Real-time inference", "Data pipeline optimization",
                            "Cache warming", "Index building", "Query optimization", "Database sharding",
                            "Load balancing", "API rate limiting", "Session management", "Token generation",
                            "Authentication flow", "Authorization checks", "Data encryption", "Privacy compliance",
                            "GDPR validation", "Consent management", "Data anonymization", "Audit logging",
                            "Monitoring metrics", "Error tracking", "Performance profiling", "Resource allocation",
                            "Scaling infrastructure", "Deployment pipeline", "Version control", "Rollback preparation",
                            "Finalizing model"
                        ];
                        const messageIndex = Math.min(cyclicBarPanel.cycleCount - 1, MODELING_MESSAGES.length - 1);
                        if (messageIndex >= 0 && messageIndex < MODELING_MESSAGES.length && modelingTitlePanel) {
                            setPanelText(modelingTitlePanel, MODELING_MESSAGES[messageIndex], currentGridParams.cellSize);
                        }
                    }
                }
                
                bioLoadModule.updateProgressBar(
                    cyclicBarPanel.progressCtx,
                    cyclicBarPanel.progressCanvas.width,
                    cyclicBarPanel.progressCanvas.height,
                    cyclicBarPanel.cycleProgress,
                    0.5
                );
                
                cyclicBarPanel.progressTexture.needsUpdate = true;
                Object.values(cyclicBarPanel.textureMaterials).forEach(material => {
                    if (material && material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
        }
        
        // Iniciar el proceso de modeling desde 0
        startModelingProcess(restoredPanels, currentGridParams);
        
    }).catch(err => console.error("Error al cargar bioLoad.js:", err));
}

// Función para iniciar el proceso de modeling desde 0
function startModelingProcess(restoredPanels, currentGridParams) {
    const { modelingTitlePanel, cyclicBarPanel, progressBarPanel, percentagePanel, remainingTimePanel, totalTimePanel } = restoredPanels;
    
    isPrintingActive = true;
    
    const totalModelingTimeSeconds = 35;
    let isRunning = true;
    
    function handleModelingEscape(event) {
        if (event.key === 'Escape') {
            isRunning = false;
            isPrintingActive = false;
            document.removeEventListener('keydown', handleModelingEscape);
            
            setPanelText(modelingTitlePanel, "Proceso interrumpido", currentGridParams.cellSize);
            
            [cyclicBarPanel, progressBarPanel, percentagePanel, remainingTimePanel, totalTimePanel].forEach(panel => {
                if (panel && panel.group) panel.group.visible = false;
            });
        }
    }
    
    document.addEventListener('keydown', handleModelingEscape);
    
    function updateModelingProgress() {
        if (!isRunning) return;
        
        const startTime = Date.now();
        const duration = totalModelingTimeSeconds * 1000;
        
        function animate() {
            if (!isRunning) return;
            
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(100, (elapsed / duration) * 100);
            
            if (progress < 100) {
                requestAnimationFrame(animate);
            }
            
            if (isPrintingActive) {
                [cyclicBarPanel, progressBarPanel, percentagePanel, remainingTimePanel, totalTimePanel].forEach(panel => {
                    if (panel && panel.group) panel.group.visible = true;
                });
            }
            
            const pulse = Math.sin(currentTime / 500) * 0.2;
            if (progressBarPanel && progressBarPanel.drawProgress) {
                try {
                    progressBarPanel.drawProgress(progress, pulse);
                } catch (err) {
                    console.error('Error al dibujar barra de progreso:', err);
                }
            }
            
            if (cyclicBarPanel && cyclicBarPanel.updateCyclicBar) {
                try {
                    cyclicBarPanel.updateCyclicBar();
                } catch (err) {
                    console.error('Error al actualizar barra cíclica:', err);
                }
            }
            
            const remainingMs = duration - elapsed;
            const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
            const timeDisplay = `${remainingSeconds}s`;
            
            const percentageText = `${Math.floor(progress)}%`;
            const percentageState = panelTextState.get(percentagePanel);
            if (percentageState) {
                percentageState.customFontSize = 3.6;
            }
            setPanelText(percentagePanel, percentageText, currentGridParams.cellSize);
            
            if (remainingTimePanel) {
                setPanelText(remainingTimePanel, timeDisplay, currentGridParams.cellSize);
            }
            if (totalTimePanel) {
                setPanelText(totalTimePanel, `ESTIMATED`, currentGridParams.cellSize);
            }
            
            if (progress >= 100) {
                isRunning = false;
                isPrintingActive = false;
                
                // Solo cambiar el texto, no mostrar pantalla de finalización
                setPanelText(modelingTitlePanel, "User Modeling Completed", currentGridParams.cellSize);
                
                document.removeEventListener('keydown', handleModelingEscape);
            }
        }
        
        animate();
    }
    
    updateModelingProgress();
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
// 🔥 REMOVIDO: Ya no cargamos aquí. El slot 0 se carga automáticamente después de que termine la animación del grid
// en startGridAnimation24Frames() 

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
            // 🔥 CRITICAL FIX: Preservar información de textura y UVs antes de recrear geometría
            let preservedTextureInfo = null;
            if (panelData.hasTexture && panelData.fillMesh.geometry) {
                const oldGeometry = panelData.fillMesh.geometry;
                const oldUVs = oldGeometry.attributes.uv;
                const texture = panelData.fillMesh.material?.map;
                
                if (oldUVs && oldUVs.count > 0 && texture) {
                    // Guardar las UVs actuales
                    const savedUVs = [];
                    for (let i = 0; i < oldUVs.count; i++) {
                        savedUVs.push({
                            u: oldUVs.getX(i),
                            v: oldUVs.getY(i)
                        });
                    }
                    
                    preservedTextureInfo = {
                        hasTexture: true,
                        textureType: panelData.textureType || 'unknown',
                        texturePath: panelData.texturePath || null,
                        savedUVs: savedUVs,
                        imageAspect: texture.image ? (texture.image.width / texture.image.height) : null,
                        material: panelData.fillMesh.material, // Preservar referencia al material
                        textureMaterials: panelData.textureMaterials // Preservar materiales de estados
                    };
                }
            }
            
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
            const fillGeometry = new THREE.ShapeGeometry(shape);
            
            // 🔥 CRITICAL FIX: Restaurar textura y materiales si existían
            let fillMaterial = panelData.fillMesh.material;
            if (preservedTextureInfo && preservedTextureInfo.material) {
                fillMaterial = preservedTextureInfo.material;
                panelData.hasTexture = true;
                panelData.textureType = preservedTextureInfo.textureType;
                panelData.texturePath = preservedTextureInfo.texturePath;
                panelData.textureMaterials = preservedTextureInfo.textureMaterials;
            }
            
            panelData.fillMesh.geometry = fillGeometry;
            panelData.fillMesh.material = fillMaterial;
            
            // 🔥 CRITICAL FIX: Restaurar UVs personalizadas si existían
            if (preservedTextureInfo && preservedTextureInfo.savedUVs) {
                const uvAttribute = fillGeometry.attributes.uv;
                const savedUVs = preservedTextureInfo.savedUVs;
                
                // Si el número de vértices coincide, restaurar directamente las UVs originales
                if (uvAttribute.count === savedUVs.length) {
                    for (let i = 0; i < savedUVs.length; i++) {
                        uvAttribute.setXY(i, savedUVs[i].u, savedUVs[i].v);
                    }
                    uvAttribute.needsUpdate = true;
                } else {
                    // Si el número de vértices cambió, recalcular UVs proporcionalmente
                    const texture = preservedTextureInfo.material?.map;
                    if (texture && texture.image && preservedTextureInfo.imageAspect) {
                        const imageAspect = preservedTextureInfo.imageAspect;
                        const panelWidth = currentWidth;
                        const panelHeight = currentHeight;
                        const panelAspect = panelWidth / panelHeight;
                        
                        // Calcular UVs "contain" para mantener aspecto de imagen
                        let uScale, vScale, uOffset, vOffset;
                        if (panelAspect > imageAspect) {
                            vScale = 1.0;
                            uScale = imageAspect / panelAspect;
                            uOffset = (1.0 - uScale) / 2;
                            vOffset = 0;
                        } else {
                            uScale = 1.0;
                            vScale = panelAspect / imageAspect;
                            uOffset = 0;
                            vOffset = (1.0 - vScale) / 2;
                        }
                        
                        const positions = fillGeometry.attributes.position;
                        for (let i = 0; i < positions.count; i++) {
                            const x = positions.getX(i);
                            const y = positions.getY(i);
                            const u = ((x + currentHalfWidth) / panelWidth) * uScale + uOffset;
                            const v = ((y + currentHalfHeight) / panelHeight) * vScale + vOffset;
                            uvAttribute.setXY(i, u, v);
                        }
                        uvAttribute.needsUpdate = true;
                    }
                }
            } else {
                // Si no hay textura preservada, generar UVs normales solo si no hay textura
                if (!panelData.hasTexture) {
                    const uvs = fillGeometry.attributes.uv;
                    const positions = fillGeometry.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const u = (x + currentHalfWidth) / currentWidth;
                        const v = (y + currentHalfHeight) / currentHeight;
                        uvs.setXY(i, u, v);
                    }
                    fillGeometry.attributes.uv.needsUpdate = true;
                }
            }
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
        
        // Optimización: Clonar materiales solo una vez al inicio del flash
        if (panelData && panelData.group) {
            // Si es el primer frame del flash, clonar materiales para evitar modificar compartidos
            if (panelData.flashProgress < 0.15 && !panelData.flashMaterialsCloned) {
                panelData.group.children.forEach(child => {
                    if (child instanceof THREE.Line && child.material) {
                        child.material = child.material.clone();
                    } else if (child === panelData.fillMesh && child.material) {
                        child.material = child.material.clone();
                    }
                });
                panelData.flashMaterialsCloned = true;
            }
            
            // Aplicar flash modificando materiales clonados (rápido)
            panelData.group.children.forEach(child => {
                if (child instanceof THREE.Line && child.material) {
                    const color = new THREE.Color().lerpColors(
                        baseColor, 
                        flashColor, 
                        positiveFlash * 0.7
                    );
                    child.material.color.copy(color);
                }
                else if (child === panelData.fillMesh && child.material) {
                    // Si el panel tiene textura, solo modificamos la opacidad
                    if (panelData.hasTexture) {
                        const baseOpacity = panelData.selected ? 0.9 : (panelData.hovered ? 0.8 : 0.7);
                        child.material.opacity = baseOpacity + (positiveFlash * 0.1);
                    } else {
                        const color = new THREE.Color().lerpColors(
                            baseColor, 
                            flashColor, 
                            positiveFlash * 0.7
                        );
                        child.material.color.copy(color);
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
                    panelData.flashMaterialsCloned = false; // Resetear flag para nuevo flash
                    doubleFlashPending.set(panelData, remainingFlashes - 1);
                    panelsFlashing.add(panelData);
                } else {
                    doubleFlashPending.delete(panelData);
                    // Restaurar materiales originales solo al finalizar todos los flashes
                    panelData.flashMaterialsCloned = false;
                    updatePanelColor(panelData);
                }
            } else {
                // Restaurar materiales originales
                panelData.flashMaterialsCloned = false;
                updatePanelColor(panelData);
            }
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
    
    // Limpiar modales
    if (typeof cleanupAllModals === 'function') {
        cleanupAllModals();
    }

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
    
    // Reiniciar estado de modeling si estaba activo
    isPrintingActive = false;
    
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
    
    // Separar paneles de modeling del resto
    const modelingPanels = [];
    const regularPanels = [];
    
    if (configData.panels && Array.isArray(configData.panels)) {
        configData.panels.forEach(panelInfo => {
            if (panelInfo.isModelingPanel) {
                modelingPanels.push(panelInfo);
            } else {
                regularPanels.push(panelInfo);
            }
        });
    }
    
    // Si hay paneles de modeling, restaurar la interfaz completa desde 0
    if (modelingPanels.length > 0) {
        console.log(`Detectados ${modelingPanels.length} paneles de modeling, restaurando interfaz completa desde 0`);
        restoreModelingInterface(modelingPanels, currentGridParams);
    }
    
    // Recrear los paneles guardados (que no son del teclado, ya que el teclado se maneja con loadBioKeyb)
    if (regularPanels.length > 0) {
        for (const panelInfo of regularPanels) {
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
                navigateToSlot: typeof panelInfo.navigateToSlot === 'number' ? panelInfo.navigateToSlot : undefined, // Preservar asignación de navegación
                loadToHUDSlot: typeof panelInfo.loadToHUDSlot === 'number' ? panelInfo.loadToHUDSlot : undefined, // 🔥 NUEVO: Restaurar trigger HUD
                speciesPanel: panelInfo.behavior?.isSpeciesPanel || false, // NUEVO: Restaurar panel de especie
                speciesName: panelInfo.behavior?.speciesName || null, // NUEVO: Restaurar nombre de especie
                // 🔥 NUEVO: Restaurar propiedades de identidad del panel ANTES de restaurar comportamiento
                isModelingPanel: !!panelInfo.isModelingPanel,
                pendingModelingCommand: !!panelInfo.pendingModelingCommand,
                pendingPrintCommand: !!panelInfo.pendingPrintCommand,
                printCommandArgs: Array.isArray(panelInfo.printCommandArgs) ? [...panelInfo.printCommandArgs] : [],
                pendingPrintSimpleCommand: !!panelInfo.pendingPrintSimpleCommand,
                pendingPrintPercentCommand: !!panelInfo.pendingPrintPercentCommand,
                printPercentDuration: typeof panelInfo.printPercentDuration === 'number' ? panelInfo.printPercentDuration : undefined
            };
            
            updatePanelGeometryAndPosition(panel, currentGridParams);
            
            if(panel.group) {
                scene.add(panel.group);
                panels.push(panel); // Añadir a la lista global de paneles
                
                // 🔥 NUEVO: Restaurar identidad de viewer incluso sin modelo cargado
                if (panelInfo.behavior && panelInfo.behavior.modelData && panelInfo.behavior.modelData.isViewer) {
                    if (!panel.modelData) {
                        panel.modelData = {};
                    }
                    panel.modelData.isViewer = true;
                    panel.isViewer = true;
                }
                
                // Restaurar comportamiento del panel
                if (panelInfo.behavior) {
                    // Restaurar modal (similar a como se restaura model/viewer)
                    if (panelInfo.behavior.modalData && panelInfo.behavior.modalData.isModal) {
                        const modalData = panelInfo.behavior.modalData;
                        const containerMin = modalData.containerMinCellIndex;
                        const containerMax = modalData.containerMaxCellIndex;
                        
                        if (containerMin && containerMax) {
                            // Buscar o crear el containerPanel
                            let containerPanel = panels.find(p => 
                                p.minCellIndex.x === containerMin.x &&
                                p.minCellIndex.y === containerMin.y &&
                                p.maxCellIndex.x === containerMax.x &&
                                p.maxCellIndex.y === containerMax.y
                            );
                            
                            // Si no se encuentra, crear uno temporal
                            if (!containerPanel) {
                                containerPanel = createPanelFromBoundingBox({
                                    minX: containerMin.x,
                                    maxX: containerMax.x,
                                    minY: containerMin.y,
                                    maxY: containerMax.y
                                }, currentGridParams);
                            }
                            
                            if (containerPanel) {
                                // Restaurar el modal completo
                                restoreModalFromBehavior(containerPanel, modalData, createPanelFromBoundingBox, getCurrentGridParams, panels, getPanelText, panelsFlashing, updatePanelColor);
                                console.log(`Modal restaurado para panel P${orderNumber} en containerPanel [${containerMin.x},${containerMin.y}]-[${containerMax.x},${containerMax.y}]`);
                            }
                        }
                    }
                    
                    // Restaurar comportamiento que no es modal
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
                                realText: (panelInfo.behavior.isPassword && panelInfo.behavior.textContent) ? panelInfo.behavior.textContent : '',
                                textAlign: panelInfo.behavior.textAlign || 'center', // Restaurar alineación de texto
                                verticalAlign: panelInfo.behavior.verticalAlign || 'middle', // Restaurar alineación vertical
                                useWhiteScrollIndicators: !!panelInfo.behavior.useWhiteScrollIndicators // 🔥 NUEVO: Restaurar indicadores de scroll blancos (para términos)
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
                        
                        // Restaurar botón I AGREE si existe
                        if (panelInfo.behavior.isAgreeButton && panelInfo.behavior.termsPanelOrderNumber) {
                            panel.isAgreeButton = true;
                            // Buscar el panel de términos por orderNumber (puede no estar cargado aún, buscar después)
                            setTimeout(() => {
                                const termsPanel = panels.find(p => p.orderNumber === panelInfo.behavior.termsPanelOrderNumber);
                                if (termsPanel) {
                                    panel.termsPanel = termsPanel;
                                    console.log(`Botón I AGREE restaurado en panel #${panel.orderNumber} vinculado a términos en panel #${termsPanel.orderNumber}`);
                                }
                            }, 100);
                        }
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
                        const { modelUrl, modelName, isRotating, rotationSpeed, isModelButton, isFromModelsGrid, isModelDisplay, isFromModelCommand, isViewer, scientificName } = panelInfo.behavior.modelData;
                        console.log(`Restaurando modelo ${modelUrl} para panel P${orderNumber}`);
                        await loadModelToPanel(panel, modelUrl, currentGridParams.cellSize).then(() => {
                            // 🔥 CRITICAL: Asegurar que modelData existe
                            if (!panel.modelData) {
                                panel.modelData = {};
                            }
                            
                            // 🔥 CRITICAL: Restaurar URL del modelo (necesario para interacción con viewer)
                            panel.modelData.url = modelUrl;
                            
                            // 🔥 CRITICAL: Restaurar TODAS las propiedades del modelo
                            if (modelName) {
                                panel.modelData.name = modelName;
                                // 🔥 NUEVO: Si no hay scientificName guardado pero hay modelName, asignarlo desde el mapeo
                                if (!scientificName && modelName) {
                                    panel.modelData.scientificName = modelScientificNames[modelName] || null;
                                }
                            }
                            if (scientificName) {
                                panel.modelData.scientificName = scientificName;
                            }
                            
                            // Restaurar las propiedades específicas del tipo de panel
                            if (isModelButton) {
                                panel.modelData.isModelButton = true;
                                panel.modelData.isFromModelsGrid = !!isFromModelsGrid;
                            } else if (isModelDisplay) {
                                panel.modelData.isModelDisplay = true;
                                panel.modelData.isFromModelCommand = !!isFromModelCommand;
                            } else if (isViewer) {
                                panel.modelData.isViewer = true;
                                panel.isViewer = true;
                            }
                            
                            if (isRotating) {
                                // toggleModelRotation invierte el estado. Si queremos que esté rotando, y empieza sin rotar, llamamos una vez.
                                // Asumimos que loadModelToPanel podría o no iniciar la rotación. Es más seguro setearlo explícitamente.
                                if (!panel.modelData.isRotating) toggleModelRotation(panel); 
                            }
                            if (rotationSpeed) {
                                setModelRotationSpeed(panel, rotationSpeed);
                            }
                            console.log(`Modelo ${modelUrl} restaurado y configurado en panel P${orderNumber}. Tipo: ${panel.modelData.isModelButton ? 'BOTÓN' : panel.modelData.isViewer ? 'VIEWER' : 'DISPLAY'}, Rotando: ${panel.modelData.isRotating}, Vel: ${rotationSpeed}`);
                        }).catch(err => console.error(`Error al restaurar modelo para panel P${orderNumber}:`, err));
                    }

                    if (panelInfo.behavior.genomData) {
                        panel.genomData = panelInfo.behavior.genomData;
                        // Recrear la visualización del genoma
                        await loadGenomToPanel(panel, currentGridParams.cellSize);
                        console.log(`GenomData restaurado para panel P${orderNumber}`);
                    }
                     if (panelInfo.behavior.codonData) { // Asumiendo que codonData se guarda en behavior
                        panel.codonData = panelInfo.behavior.codonData;
                        await loadCodonToPanel(panel, currentGridParams.cellSize);
                        console.log(`CodonData restaurado para panel P${orderNumber}`);
                    }
                    
                    // 🔥 CRITICAL FIX: Restaurar texturas (logo, apps)
                    if (panelInfo.behavior.textureInfo && panelInfo.behavior.textureInfo.hasTexture) {
                        const textureInfo = panelInfo.behavior.textureInfo;
                        const texturePath = textureInfo.texturePath || './public/img/bioprint_logo.png'; // Default a logo
                        
                        loadTexture(
                            texturePath,
                            (texture) => {
                                if (panel.fillMesh) {
                                    // Configurar wrapping
                                    texture.wrapS = THREE.ClampToEdgeWrapping;
                                    texture.wrapT = THREE.ClampToEdgeWrapping;
                                    
                                    // Crear materiales con textura
                                    panel.textureMaterials = createPanelMaterials(texture);
                                    panel.fillMesh.material = panel.textureMaterials.normal;
                                    panel.hasTexture = true;
                                    panel.textureType = textureInfo.textureType || 'logo';
                                    panel.texturePath = texturePath;
                                    
                                    // Restaurar UVs personalizadas si existen
                                    if (textureInfo.customUVs && textureInfo.customUVs.length > 0) {
                                        const geometry = panel.fillMesh.geometry;
                                        const uvAttribute = geometry.attributes.uv;
                                        
                                        if (uvAttribute && uvAttribute.count === textureInfo.customUVs.length) {
                                            for (let i = 0; i < textureInfo.customUVs.length; i++) {
                                                uvAttribute.setXY(i, textureInfo.customUVs[i].u, textureInfo.customUVs[i].v);
                                            }
                                            uvAttribute.needsUpdate = true;
                                        } else {
                                            // Si la geometría cambió, recalcular UVs "contain" desde cero
                                            const imageAspect = textureInfo.imageAspect || (texture.image ? texture.image.width / texture.image.height : 1);
                                            const panelWidth = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
                                            const panelHeight = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
                                            const panelAspect = panelWidth / panelHeight;
                                            const ratio = panelAspect / imageAspect;
                                            
                                            for (let i = 0; i < uvAttribute.count; i++) {
                                                const u = uvAttribute.getX(i);
                                                const v = uvAttribute.getY(i);
                                                
                                                let newU = u;
                                                let newV = v;
                                                
                                                if (ratio < 1) {
                                                    newV = 0.5 + (v - 0.5) / ratio;
                                                } else {
                                                    newU = 0.5 + (u - 0.5) * ratio;
                                                }
                                                
                                                uvAttribute.setXY(i, newU, newV);
                                            }
                                            uvAttribute.needsUpdate = true;
                                        }
                                    }
                                    
                                    updatePanelColor(panel);
                                    console.log(`Textura restaurada para panel P${orderNumber}: ${texturePath}`);
                                    
                                    // 🔥 CRITICAL: Restaurar logo si tiene hasLogoActive
                                    if (textureInfo.hasLogoActive && textureInfo.textureType === 'logo') {
                                        // Crear el logo mesh si no existe
                                        if (!logoMeshExists()) {
                                            createLogo(scene);
                                        }
                                        // Activar logo en este panel
                                        toggleLogo(true, panel);
                                        console.log(`Logo restaurado para panel P${orderNumber}`);
                                    }
                                }
                            },
                            (error) => {
                                console.error(`Error al restaurar textura para panel P${orderNumber}:`, error);
                            }
                        );
                    } else if (panelInfo.behavior.textureInfo && panelInfo.behavior.textureInfo.hasLogoActive) {
                        // Si solo tiene logo activo pero no textura en fillMesh, restaurar logo directamente
                        // Crear el logo mesh si no existe
                        if (!logoMeshExists()) {
                            createLogo(scene);
                        }
                        toggleLogo(true, panel);
                        console.log(`Logo restaurado para panel P${orderNumber} (sin textura en fillMesh)`);
                    }
                }
                
                createPanelOrderLabel(panel); // Crear etiqueta de orden (visible o no según globalShowNumbers y panel.showOrderNumber)
                
                // Ejecutar comando modeling si está pendiente
                // 🔥 CRITICAL: La propiedad ya se restauró arriba, ahora solo ejecutamos el comando
                if (panel.pendingModelingCommand) {
                    // Crear un output mock para la función
                    const mockOutput = {
                        appendChild: () => {},
                        innerHTML: ''
                    };
                    // Ejecutar el comando modeling con el panel restaurado
                    setTimeout(() => {
                        executeModelingCommand(panel, mockOutput);
                    }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                }
                
                if (panelInfo.pendingPrintCommand) {
                    // Crear un output mock para la función
                    const mockOutput = {
                        appendChild: () => {},
                        innerHTML: ''
                    };
                    // Ejecutar el comando print con el panel restaurado y los argumentos guardados
                    const printArgs = Array.isArray(panelInfo.printCommandArgs) ? panelInfo.printCommandArgs : [];
                    setTimeout(() => {
                        executePrintCommand(panel, printArgs, mockOutput);
                    }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                }
                
                if (panelInfo.pendingPrintSimpleCommand) {
                    // Crear un output mock para la función
                    const mockOutput = {
                        appendChild: () => {},
                        innerHTML: ''
                    };
                    // Ejecutar el comando print simple
                    setTimeout(() => {
                        executePrintSimpleCommand(panel, mockOutput);
                    }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                }
                
                if (panelInfo.pendingPrintPercentCommand && typeof panelInfo.printPercentDuration === 'number') {
                    // Crear un output mock para la función
                    const mockOutput = {
                        appendChild: () => {},
                        innerHTML: ''
                    };
                    // Ejecutar el comando print percent con la duración guardada
                    setTimeout(() => {
                        executePrintPercentCommand(panel, panelInfo.printPercentDuration, mockOutput);
                    }, 100); // Pequeño delay para asegurar que el panel esté completamente restaurado
                }
                
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
        case 'social':
        case 'login':
            mapSocial(args, output);
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
        case 'print':
            // Detectar si es "print percent ###", "print simple" o "print [modelo]"
            if (args.length > 0 && args[0].toLowerCase() === 'percent') {
                const percentArgs = args.slice(1); // Resto de argumentos después de "percent"
                handlePrintPercentCommand(percentArgs, output);
            } else if (args.length > 0 && args[0].toLowerCase() === 'simple') {
                const simpleArgs = args.slice(1); // Resto de argumentos después de "simple"
                handlePrintSimpleCommand(simpleArgs, output);
            } else {
                handlePrintCommand(args, output);
            }
            break;
        case 'modeling':
            handleModelingCommand(output);
            break;
        case 'models':
            handleModelsCommand(output);
            break;
        case 'statg':
            handleStatgCommand(args, output);
            break;
            
        case 'multitest':
            handleMultiTestCommand(output);
            break;
        case 'demo':
            handleDemoCommand(output);
            break;
            
        case 'horizontal':
            handleHorizontalCommand(output);
            break;
        case 'glitch':
            handleGlitchCommand(output);
            break;
        case 'saveconjunto':
        case 'saveconj':
            handleSaveConjuntoCommand(args, output);
            break;
        case 'loadconjunto':
        case 'loadconj':
            handleLoadConjuntoCommand(args, output);
            break;
        case 'viewer':
            handleViewerCommand(output);
            break;
        case 'hud':
            handleHUDCommand(output, args);
            break;
        case 'modal':
            handleModalCommand(args, output, createPanelFromBoundingBox, getCurrentGridParams, panels, showError, showSuccess, panelsFlashing, updatePanelColor);
            break;
        default:
            showError(`Comando desconocido: ${cmd}. Escribe 'help' para ver comandos disponibles.`, output);
    }
    
    // Scroll al final
    output.scrollTop = output.scrollHeight;
    
    // Para ciertos comandos, no ocultamos la terminal porque siguen siendo interactivos
    const excludedCommands = ['txt', 'help', 'list', 'status', 'clear'];
    if (!excludedCommands.includes(cmd.toLowerCase())) {
        // Esperar 1.5 segundos para que el usuario vea el resultado antes de ocultar la terminal
        setTimeout(() => {
            toggleTerminal(false);
        }, 1500);
    }
}

// Funciones auxiliares para los comandos
function showHelp(output) {
    const commands = [
        'help - Muestra todos los comandos disponibles',
        'zeng - Activa el efecto Zeng (azul)',
        'boris - Activa el efecto Matrix (verde)', 
        'ann - Activa el efecto Ann (cyan)',
        'select all - Selecciona todos los paneles',
        'select 1-5 - Selecciona rango de paneles',
        'select 1 3 7 - Selecciona paneles específicos',
        'show - Muestra los números de los paneles',
        'hide - Oculta los números de los paneles', 
        'list - Lista todos los paneles',
        'clear - Limpia la terminal',
        'delete <n> - Elimina el panel número n',
        'delete selected - Elimina todos los paneles seleccionados',
        'delete all - Elimina todos los paneles',
        'logo - Crea un logo en el panel seleccionado',
        'apps - Crea un grid de iconos de aplicaciones',
        'social - Crea login con texto y iconos de redes sociales (Meta, Gmail, X, etc.)',
        'login - Alias para social',
        'txt - Añade texto al panel seleccionado',
        'terms - Muestra términos y condiciones',
        'model - Crea un modelo 3D en el panel seleccionado',
        'model rotate - Hace rotar el modelo 3D',
        'model speed <n> - Ajusta velocidad de rotación',
        'model angle <n> - Ajusta ángulo específico',
        'models - Crea una rejilla 3x3 de modelos biológicos',
        'viewer - Convierte un panel en viewer de modelo (seleccionar panel con modelo lo carga en el viewer)',
        'statg - Muestra estadísticas genómicas del último modelo clickeado',
        'horizontal - Divide panel seleccionado horizontalmente',
        'genom - Crea una visualización de ADN en el panel',
        'gatc - Muestra una secuencia GATC animada',
        'gtac - Alias para gatc',
        'splice - Inicia proceso de splicing genético',
        'index - Reindexa todos los paneles',
        'reindex - Alias para index',
        'pass - Comando de contraseña',
        'codon - Crea un modelo 3D de transcripción genética',
        'stack - Inicia proceso de stack genético',
        'flash - Hace parpadear el panel seleccionado',
        'print - Inicia simulación de bioimpresión 3D',
        'print percent [ms] - Muestra barra de progreso con porcentaje (duración en milisegundos)',
        'modeling - Inicia modelación de datos de usuario',
        'multitest - Crea paneles de prueba para multiselección',
        'demo - Crea laboratorio biomédico completo de demostración',
        'glitch - Efecto glitch de refracción roja con bloques fragmentados',
        'saveconjunto <n> - Guarda paneles seleccionados en slot n (0-9)',
        'loadconjunto <n> - Carga paneles guardados desde slot n sin limpiar escena'
    ];
    
    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = '<div><b>COMANDOS DISPONIBLES:</b></div><br>';
    
    commands.forEach(command => {
        const commandDiv = document.createElement('div');
        commandDiv.textContent = command;
        commandDiv.style.fontFamily = 'monospace';
        commandDiv.style.letterSpacing = '0.5px';
        commandDiv.style.color = '#0f0';
        commandDiv.style.marginBottom = '2px';
        helpDiv.appendChild(commandDiv);
    });
    
    const totalDiv = document.createElement('div');
    totalDiv.innerHTML = `<br><b>Total: ${commands.length} comandos disponibles</b>`;
    totalDiv.style.color = '#0f0';
    helpDiv.appendChild(totalDiv);
    
    output.appendChild(helpDiv);
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
            selected++;
        }
    });
    
    // 🔥 ACTUALIZAR VISUAL DE TODOS LOS PANELES SELECCIONADOS
    refreshSelectedPanelsColors();
    
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
    const selectedCount = panels.filter(p => p.selected).length;
    listDiv.innerHTML = `<div><b>Paneles (${panels.length}):</b> ${selectedCount > 0 ? `<span style="color: #4CAF50;">${selectedCount} seleccionados</span>` : ''}</div>`;
    
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
                // Configurar wrapping para evitar repetición si se sale de 0..1
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                
                // Crear los materiales con textura
                panel.textureMaterials = createPanelMaterials(texture);
                
                // Aplicar el material inicial
                panel.fillMesh.material = panel.textureMaterials.normal;

                // Actualizar UVs para ajustar la textura sin distorsión (Contain)
                const geometry = panel.fillMesh.geometry;
                const uvAttribute = geometry.attributes.uv;
                
                // Obtener dimensiones y aspecto
                // Usar image.width/height de la textura cargada
                const imageAspect = texture.image.width / texture.image.height;
                
                // Dimensiones del panel en unidades de grid
                const panelWidth = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
                const panelHeight = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
                const panelAspect = panelWidth / panelHeight;
                
                // Ratio entre aspectos
                const ratio = panelAspect / imageAspect;
                
                // Aplicar transformación UV
                // Algoritmo "Contain" (Fit): Muestra toda la imagen sin distorsión, centrada
                for (let i = 0; i < uvAttribute.count; i++) {
                    const u = uvAttribute.getX(i);
                    const v = uvAttribute.getY(i);
                    
                    let newU = u;
                    let newV = v;
                    
                    if (ratio < 1) {
                        // Panel es más alto que la imagen (relativamente)
                        // Ajustar V para centrar verticalmente (Fit Horizontal)
                        // v' = 0.5 + (v - 0.5) / ratio
                        newV = 0.5 + (v - 0.5) / ratio;
                    } else {
                        // Panel es más ancho que la imagen (relativamente)
                        // Ajustar U para centrar horizontalmente (Fit Vertical)
                        // u' = 0.5 + (u - 0.5) * ratio
                        newU = 0.5 + (u - 0.5) * ratio;
                    }
                    
                    uvAttribute.setXY(i, newU, newV);
                }
                
                uvAttribute.needsUpdate = true;
                panel.hasTexture = true; // Marcar que el panel tiene textura
                panel.textureType = 'logo'; // 🔥 Guardar tipo de textura para snapshots
                panel.texturePath = './public/img/bioprint_logo.png'; // 🔥 Guardar ruta para snapshots
                
                // Forzar actualización
                if (typeof render === 'function') {
                    render();
                }
                
                showSuccess('Logo aplicado exitosamente sin distorsión', output);
            } else {
                showError('El panel no tiene una malla para aplicar la textura', output);
            }
        },
        (error) => {
            showError(`No se pudo cargar el logo: ${error.message}`, output);
        }
    );
}

/**
 * Módulo: mapSocial
 * Función: Crea un panel de login con texto "LOGIN WITH SOCIAL MEDIA" y iconos de redes sociales como texturas
 * Conexiones: 
 * - Usa createPanelFromBoundingBox para crear paneles de iconos
 * - Usa loadTexture para cargar imágenes de iconos de redes sociales
 * - Usa createPanelMaterials para aplicar texturas a los paneles
 * - Usa setPanelText para el texto del título
 * - Usa getCurrentGridParams para obtener parámetros del grid
 * - Similar a mapLogo pero con múltiples iconos en fila
 * 
 * Requisitos: Los iconos deben estar en public/img/ con nombres:
 * - meta.png, gmail.png, x.png, linkedin.png, github.png
 */
function mapSocial(args, output) {
    // Verificar si hay un panel seleccionado para usar como contenedor
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length !== 1) {
        showError('Selecciona exactamente un panel para crear el login social', output);
        return;
    }
    
    const containerPanel = selectedPanels[0];
    showInfo('Creando login social en el panel seleccionado...', output);
    
    // Calcular dimensiones del contenedor en celdas
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    // Verificar que el contenedor sea lo suficientemente grande
    // Mínimo: 10 de ancho y 8 de alto (para texto + iconos)
    if (containerWidth < 10 || containerHeight < 8) {
        showError(`El panel debe ser al menos de 10x8 celdas (actual: ${containerWidth}x${containerHeight})`, output);
        return;
    }
    
    // Obtener parámetros actuales del grid
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    try {
        // Dividir el panel en dos secciones:
        // 1. Sección superior para el texto (aproximadamente 1/3 de la altura)
        // 2. Sección inferior para los iconos (2/3 de la altura)
        
        const textSectionHeight = Math.max(3, Math.floor(containerHeight * 0.3));
        const iconsSectionHeight = containerHeight - textSectionHeight - 1; // -1 para separación
        
        // Crear panel para el texto "LOGIN WITH SOCIAL MEDIA" (parte superior)
        // En el sistema de coordenadas: minY es inferior, maxY es superior
        const textPanel = createPanelFromBoundingBox({
            minX: containerPanel.minCellIndex.x,
            maxX: containerPanel.maxCellIndex.x,
            minY: containerPanel.maxCellIndex.y - textSectionHeight + 1,
            maxY: containerPanel.maxCellIndex.y
        }, currentGridParams);
        
        if (textPanel && textPanel.group) {
            // Configurar el panel de texto
            textPanel.hasText = true;
            createPanelText(textPanel, currentGridParams.cellSize);
            setPanelText(textPanel, 'LOGIN WITH SOCIAL MEDIA', currentGridParams.cellSize);
        }
        
        // Definir iconos de redes sociales con sus rutas de imagen
        const socialIcons = [
            { name: 'META', path: './public/img/meta.png' },
            { name: 'GMAIL', path: './public/img/gmail.png' },
            { name: 'X', path: './public/img/x.png' },
            { name: 'LINKEDIN', path: './public/img/linkedin.png' },
            { name: 'GITHUB', path: './public/img/github.png' }
        ];
        
        // Rutas alternativas para intentar cargar
        const alternativePaths = [
            './public/img/',
            '../public/img/',
            'img/',
            './img/',
            '../img/',
            '/img/',
            'public/img/'
        ];
        
        // Calcular tamaño de cada icono
        const numIcons = socialIcons.length;
        const iconSpacing = 1; // Separación entre iconos
        const totalSpacing = (numIcons - 1) * iconSpacing;
        const availableWidth = containerWidth;
        const iconWidth = Math.floor((availableWidth - totalSpacing) / numIcons);
        const iconHeight = Math.max(2, iconsSectionHeight);
        
        // Verificar que los iconos quepan
        if (iconWidth < 2) {
            showError('El panel es demasiado pequeño para mostrar todos los iconos', output);
            return;
        }
        
        // Calcular offset para centrar los iconos
        const totalIconsWidth = (iconWidth * numIcons) + totalSpacing;
        const offsetX = Math.floor((containerWidth - totalIconsWidth) / 2);
        
        // Crear paneles para cada icono y cargar sus texturas
        const createdIconPanels = [];
        let loadedIcons = 0;
        const totalIcons = numIcons;
        
        for (let i = 0; i < numIcons; i++) {
            const iconX = containerPanel.minCellIndex.x + offsetX + (i * (iconWidth + iconSpacing));
            
            const iconPanel = createPanelFromBoundingBox({
                minX: iconX,
                maxX: iconX + iconWidth - 1,
                minY: containerPanel.minCellIndex.y,
                maxY: containerPanel.minCellIndex.y + iconHeight - 1
            }, currentGridParams);
            
            if (iconPanel && iconPanel.group && iconPanel.fillMesh) {
                createdIconPanels.push(iconPanel);
                
                // Función para intentar cargar la textura del icono
                const tryLoadIconTexture = (pathIndex = 0) => {
                    if (pathIndex >= alternativePaths.length) {
                        console.warn(`No se pudo cargar icono ${socialIcons[i].name}, usando placeholder`);
                        // Si no se puede cargar, dejar el panel sin textura (se verá vacío)
                        loadedIcons++;
                        if (loadedIcons === totalIcons) {
                            showSuccess(`Login social creado. ${loadedIcons}/${totalIcons} iconos cargados.`, output);
                            if (typeof render === 'function') render();
                        }
                        return;
                    }
                    
                    const basePath = alternativePaths[pathIndex];
                    const iconFileName = socialIcons[i].path.split('/').pop(); // Obtener solo el nombre del archivo
                    const fullPath = basePath + iconFileName;
                    
                    loadTexture(
                        fullPath,
                        (texture) => {
                            // Configurar wrapping
                            texture.wrapS = THREE.ClampToEdgeWrapping;
                            texture.wrapT = THREE.ClampToEdgeWrapping;
                            
                            // Crear materiales con textura
                            iconPanel.textureMaterials = createPanelMaterials(texture);
                            iconPanel.fillMesh.material = iconPanel.textureMaterials.normal;
                            
                            // Actualizar UVs para ajustar la textura sin distorsión (Contain)
                            const geometry = iconPanel.fillMesh.geometry;
                            const uvAttribute = geometry.attributes.uv;
                            
                            // Obtener dimensiones y aspecto
                            const imageAspect = texture.image.width / texture.image.height;
                            const panelWidth = iconPanel.maxCellIndex.x - iconPanel.minCellIndex.x + 1;
                            const panelHeight = iconPanel.maxCellIndex.y - iconPanel.minCellIndex.y + 1;
                            const panelAspect = panelWidth / panelHeight;
                            const ratio = panelAspect / imageAspect;
                            
                            // Aplicar transformación UV (Contain)
                            for (let j = 0; j < uvAttribute.count; j++) {
                                const u = uvAttribute.getX(j);
                                const v = uvAttribute.getY(j);
                                
                                let newU = u;
                                let newV = v;
                                
                                if (ratio < 1) {
                                    newV = 0.5 + (v - 0.5) / ratio;
                                } else {
                                    newU = 0.5 + (u - 0.5) * ratio;
                                }
                                
                                uvAttribute.setXY(j, newU, newV);
                            }
                            
                            uvAttribute.needsUpdate = true;
                            iconPanel.hasTexture = true;
                            iconPanel.textureType = 'social';
                            iconPanel.texturePath = fullPath;
                            
                            loadedIcons++;
                            if (loadedIcons === totalIcons) {
                                showSuccess(`Login social creado exitosamente. ${loadedIcons}/${totalIcons} iconos cargados.`, output);
                                if (typeof render === 'function') render();
                            }
                        },
                        (error) => {
                            // Intentar siguiente ruta
                            tryLoadIconTexture(pathIndex + 1);
                        }
                    );
                };
                
                // Iniciar carga de textura
                tryLoadIconTexture(0);
            }
        }
        
        // Eliminar el panel contenedor original
        if (containerPanel.group) {
            scene.remove(containerPanel.group);
            const index = panels.indexOf(containerPanel);
            if (index > -1) {
                panels.splice(index, 1);
            }
        }
        
        // Nota: El mensaje de éxito se muestra cuando todas las texturas se cargan
        // (ver dentro del loop de carga de texturas)
        
    } catch (error) {
        console.error('Error en mapSocial:', error);
        showError(`Error al crear el login social: ${error.message}`, output);
    }
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
    if (event.key && event.key.toLowerCase() === 'v') {
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
            // 🔥 CRITICAL: Marcar como touch para que sea ignorado por listeners de mouse
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: twoFingerStartPosition.x,
                clientY: twoFingerStartPosition.y,
                button: 2, // 2 = botón derecho
                buttons: 2,
                bubbles: true,
                cancelable: true
            });
            // Establecer pointerType manualmente ya que MouseEvent no lo soporta directamente
            Object.defineProperty(mouseEvent, 'pointerType', { value: 'touch', writable: false });
            event.target.dispatchEvent(mouseEvent);
        }
    } else if (event.touches.length === 1) {
        // Single touch - click normal
        const touch = event.touches[0];
        touchStartPosition = { x: touch.clientX, y: touch.clientY };
        touchStartTime = currentTime;
        
        // Simular evento de mousedown con botón izquierdo
        // 🔥 CRITICAL: Marcar como touch para que sea ignorado por listeners de mouse
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0, // 0 = botón izquierdo
            buttons: 1,
            bubbles: true,
            cancelable: true
        });
        // Establecer pointerType manualmente ya que MouseEvent no lo soporta directamente
        Object.defineProperty(mouseEvent, 'pointerType', { value: 'touch', writable: false });
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
    let intersects = [];
    if (isHUDActive()) {
        // Cuando el HUD está activo, solo permitir clics en elementos del HUD
        // NO permitir clics en elementos del fondo
        const hudPanelsList = getHUDPanels();
        const hudFillMeshes = hudPanelsList.map(p => p.fillMesh).filter(Boolean);
        const hudBorderLines = hudPanelsList.flatMap(p => p.borderLines || []).filter(Boolean);
        const hudSelectable = [...hudFillMeshes, ...hudBorderLines];
        intersects = raycaster.intersectObjects(hudSelectable, false);
    } else {
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
        intersects = raycaster.intersectObjects(allSelectable, false);
    }
    
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
            // 🔥 NUEVO: Cargar slot en HUD si el panel tiene loadToHUDSlot asignado
            if (!panelData.isKeyboardKey && typeof panelData.loadToHUDSlot === 'number') {
                console.log(`Panel P${panelData.orderNumber} clickeado. Cargando Slot ${panelData.loadToHUDSlot} en HUD.`);
                (async () => {
                    // Si el HUD no está activo, activarlo primero
                    if (!isHUDActive()) {
                        console.log(`HUD no está activo, activándolo primero...`);
                        const slotConfig = bioSlotsLoadFromSlot(panelData.loadToHUDSlot);
                        const slotDivisions = slotConfig?.grid?.divisions || currentDivisions;
                        console.log(`Creando HUD con ${slotDivisions} divisiones del slot`);
                        const hudCreated = createHUD(slotDivisions);
                        if (!hudCreated) {
                            console.error('Error al crear HUD. Cargando en grid principal como fallback.');
                            loadFromSlot(panelData.loadToHUDSlot);
                            return;
                        }
                        // Esperar un frame para asegurar que el HUD esté completamente inicializado
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                    
                    // Verificar que el HUD esté activo y visible antes de cargar
                    const hudScene = getHUDScene();
                    if (hudScene) {
                        hudScene.visible = true;
                        hudScene.traverse((child) => {
                            child.visible = true;
                        });
                    }
                    
                    // Cargar el slot en el HUD
                    await loadFromSlotToHUD(panelData.loadToHUDSlot);
                })();
                // Deseleccionar el panel después de la carga
                panelData.selected = false;
                updatePanelColor(panelData);
                return; // Terminar el procesamiento aquí para no interferir con la selección normal
            }
            
            if (!panelData.isKeyboardKey && typeof panelData.navigateToSlot === 'number') {
                console.log(`Panel P${panelData.orderNumber} clickeado. Navegando a Slot ${panelData.navigateToSlot}.`);
                loadFromSlot(panelData.navigateToSlot);
                // Deseleccionar el panel después de la navegación para evitar acciones no deseadas si el slot carga paneles seleccionados.
                panelData.selected = false;
                updatePanelColor(panelData);
                return; // Terminar el procesamiento aquí para no interferir con la selección normal
            }

            // NUEVA FUNCIONALIDAD: Avanzar scroll de términos al hacer click en botón AGREE (mouseup)
            if (panelData.isAgreeButton && panelData.termsPanel) {
                const termsPanel = panelData.termsPanel;
                const textState = panelTextState.get(termsPanel);
                if (textState && textState.useWhiteScrollIndicators) {
                    // Este es el botón AGREE, avanzar scroll del panel de términos
                    const currentGridParams = getCurrentGridParams();
                    if (currentGridParams) {
                        // Calcular dimensiones del panel de términos
                        const panelHeight = (termsPanel.maxCellIndex.y - termsPanel.minCellIndex.y + 1);
                        const panelWidth = (termsPanel.maxCellIndex.x - termsPanel.minCellIndex.x + 1);
                        const width = panelWidth * currentGridParams.cellSize;
                        const height = panelHeight * currentGridParams.cellSize;
                        const paddingSize = currentGridParams.cellSize;
                        const textAreaHeight = height - (paddingSize * 2);
                        
                        // Calcular número máximo de líneas visibles
                        const isUniline = panelHeight <= 3;
                        const isTooSmall = textAreaHeight < (currentGridParams.cellSize * TEXT_CONFIG.fontSize * 0.8);
                        
                        let effectiveLineHeight;
                        if (isTooSmall || isUniline) {
                            effectiveLineHeight = panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                                 panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                                 panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                                 TEXT_CONFIG.lineHeight;
                        } else {
                            effectiveLineHeight = TEXT_CONFIG.lineHeight;
                        }
                        
                        const maxVisibleLines = isUniline ? 1 : Math.max(1, Math.floor(textAreaHeight / (currentGridParams.cellSize * effectiveLineHeight)));
                        
                        // Avanzar scrollOffset en una pantalla
                        const newScrollOffset = Math.min(
                            textState.scrollOffset + maxVisibleLines,
                            Math.max(0, textState.lines.length - maxVisibleLines)
                        );
                        
                        // 🔥 CRITICAL: Asegurar que el panel de términos NO flashee al actualizar texto
                        const wasFlashing = termsPanel.shouldFlash;
                        const wasInFlashingSet = panelsFlashing.has(termsPanel);
                        
                        if (newScrollOffset !== textState.scrollOffset) {
                            textState.scrollOffset = newScrollOffset;
                            createPanelText(termsPanel, currentGridParams.cellSize);
                            console.log(`📜 Scroll de términos avanzado (AGREE mouseup): ${textState.scrollOffset}/${textState.lines.length - maxVisibleLines}`);
                        } else {
                            // Si ya está al final, volver al inicio
                            textState.scrollOffset = 0;
                            createPanelText(termsPanel, currentGridParams.cellSize);
                            console.log(`📜 Scroll de términos reiniciado al inicio (AGREE mouseup)`);
                        }
                        
                        // 🔥 CRITICAL: Flash visual en el botón I AGREE y el panel de términos
                        // Solo estos dos paneles deben flashear, no todos los paneles
                        panelData.flashProgress = 0;
                        panelData.shouldFlash = true;
                        panelsFlashing.add(panelData);
                        
                        // También hacer flash en el panel de términos
                        termsPanel.flashProgress = 0;
                        termsPanel.shouldFlash = true;
                        panelsFlashing.add(termsPanel);
                        
                        return; // Salir para evitar selección normal
                    }
                }
            }
            
            // MANEJO DE BOTONES MODAL: + y -
            if (panelData.isModalPlusButton || panelData.isModalMinusButton) {
                const currentGridParams = getCurrentGridParams();
                if (currentGridParams && panelData.containerPanel) {
                    // Buscar el panel de porcentaje correspondiente
                    const modalData = getModalState(panelData.containerPanel);
                    if (modalData && modalData.divisions[panelData.modalIndex]) {
                        const percentagePanel = modalData.divisions[panelData.modalIndex].percentagePanel;
                        if (percentagePanel) {
                            // Determinar el cambio (+10 o -10)
                            const delta = panelData.isModalPlusButton ? 10 : -10;
                            updateModalPercentage(percentagePanel, delta, currentGridParams);
                            
                            // Flash visual SOLO en el botón clickeado (no en todos los paneles)
                            panelData.flashProgress = 0;
                            panelData.shouldFlash = true;
                            panelsFlashing.add(panelData);
                            
                            // NO agregar el panel de porcentaje al flash, solo el botón
                            
                            return; // Salir inmediatamente para evitar cualquier otro procesamiento
                        }
                    }
                }
            }

            if (panelData.isKeyboardKey && panelData.behavior && panelData.behavior.character) {
                // Es una tecla del teclado, solo ejecutar onPress y flash
                if (panelData.onPress) {
                    panelData.onPress();
                    console.log(`Tecla bioKeyb presionada: ${panelData.behavior.character}`);
                    
                    // Asegurar que no quede seleccionada
                    panelData.selected = false;
                    updatePanelColor(panelData);
                    
                    // Efecto visual de flash
    panelData.flashProgress = 0;
    panelData.shouldFlash = true;
    panelsFlashing.add(panelData);
                }
            } else {
                // NUEVA FUNCIONALIDAD: Detectar click en BOTÓN de models y cargar en panel de DISPLAY (para touch)
                if (panelData.modelData && 
                    panelData.modelData.isModelButton && 
                    panelData.modelData.isFromModelsGrid) {
                    
                    // Este es un botón de la rejilla 3x3, buscar paneles de DISPLAY
                    const displayPanels = panels.filter(p => 
                        p !== panelData && 
                        p.modelData && 
                        p.modelData.isModelDisplay &&
                        p.modelData.isFromModelCommand &&
                        p.group && 
                        p.group.children.some(child => child.userData && child.userData.isModel)
                    );
                    
                    if (displayPanels.length > 0) {
                        // Encontramos paneles de DISPLAY, usar el primero
                        const targetDisplayPanel = displayPanels[0];
                        const sourceModelData = panelData.modelData;
                        
                        console.log(`Transfiriendo modelo ${sourceModelData.name} del BOTÓN #${panelData.orderNumber} al DISPLAY #${targetDisplayPanel.orderNumber} (touch)`);
                        
                                                 // 🔥 ACTUALIZAR EL ÚLTIMO MODELO CLICKEADO PARA EL COMANDO PRINT (TOUCH)
                         lastClickedModelFromGrid = {
                             name: sourceModelData.name,
                             url: sourceModelData.url,
                             scientificName: modelScientificNames[sourceModelData.name] || 'MODELO DESCONOCIDO'
                         };
                         console.log(`📋 Último modelo para print actualizado (touch): ${lastClickedModelFromGrid.name} (${lastClickedModelFromGrid.scientificName})`);
                         
                         // 🔥 BUSCAR Y ACTUALIZAR PANELES DE ESTADÍSTICAS GENÓMICAS (STATG) (TOUCH)
                         const statgPanels = panels.filter(p => p.isStatgPanel && !p.isKeyboardKey);
                         if (statgPanels.length > 0) {
                             const currentGridParams = getCurrentGridParams();
                             if (currentGridParams) {
                                 statgPanels.forEach(statgPanel => {
                                     const updated = updateStatgPanelWithModel(statgPanel, sourceModelData.name, currentGridParams);
                                     if (updated) {
                                         console.log(`📊 Panel STATG #${statgPanel.orderNumber} actualizado con modelo ${sourceModelData.name} (touch)`);
                                     }
                                 });
                                 
                                 if (statgPanels.length > 0) {
                                     console.log(`🔄 ${statgPanels.length} panel(es) de estadísticas genómicas actualizados automáticamente (touch)`);
                                 }
                             }
                         }
                         
                         // Mostrar información en terminal solo si está disponible (touch)
                         const terminalOutput = document.querySelector('.terminal-output');
                         if (terminalOutput) {
                             showInfo(`Modelo ${lastClickedModelFromGrid.name} seleccionado para print`, terminalOutput);
                         }
                        
                        // Cargar el modelo del botón en el panel de display
                        loadModelToPanel(targetDisplayPanel, sourceModelData.url, currentGrid.userData.cellSize).then((success) => {
                            if (success) {
                                // Actualizar datos del modelo en el panel de display (mantener que es display)
                                targetDisplayPanel.modelData = {
                                    name: sourceModelData.name,
                                    url: sourceModelData.url,
                                    isRotating: true,
                                    rotationSpeed: sourceModelData.rotationSpeed || 0.005,
                                    isModelDisplay: true, // Mantener como display
                                    isFromModelCommand: true // Mantener origen
                                };
                                
                                console.log(`Modelo ${sourceModelData.name} transferido exitosamente al DISPLAY #${targetDisplayPanel.orderNumber} (touch)`);
                                
                                // Flash visual en el panel de display para indicar la transferencia
                                targetDisplayPanel.flashProgress = 0;
                                targetDisplayPanel.shouldFlash = true;
                                panelsFlashing.add(targetDisplayPanel);
                            } else {
                                console.error(`Error al transferir modelo ${sourceModelData.name} al DISPLAY #${targetDisplayPanel.orderNumber} (touch)`);
                            }
                        }).catch(error => {
                            console.error(`Error al cargar modelo en panel destino (touch):`, error);
                        });
                        
                                                 // Deseleccionar el panel de models después de la transferencia
                         panelData.selected = false;
                         updatePanelColor(panelData);
                         
                         // NUEVA FUNCIONALIDAD: Buscar panel libre para cargar nombre científico (touch)
                         const freePanels = findFreePanels();
                         console.log(`🔍 Buscando panel libre para nombre científico (touch). Paneles libres encontrados: ${freePanels.length}`);
                         
                         if (freePanels.length > 0) {
                             const freePanel = freePanels[0];
                             const scientificName = modelScientificNames[sourceModelData.name];
                             
                             console.log(`📄 Modelo (touch): ${sourceModelData.name}, Nombre científico: ${scientificName}`);
                             
                             if (scientificName) {
                                  // Marcar el panel como contenedor de especie (reutilizable)
                                  freePanel.hasText = true;
                                  freePanel.speciesPanel = true; // NUEVO: Marcar como panel de especie
                                  freePanel.speciesName = scientificName; // NUEVO: Guardar nombre de especie
                                  createPanelText(freePanel, currentGrid.userData.cellSize);
                                  setPanelText(freePanel, scientificName, currentGrid.userData.cellSize);
                                  
                                  console.log(`✅ Nombre científico "${scientificName}" cargado en panel de especie #${freePanel.orderNumber} (touch)`);
                                  
                                  // Flash visual en el panel de especie para indicar la carga
                                  freePanel.flashProgress = 0;
                                  freePanel.shouldFlash = true;
                                  panelsFlashing.add(freePanel);
                              } else {
                                  console.warn(`⚠️ No se encontró nombre científico para el modelo (touch): ${sourceModelData.name}`);
                              }
                         } else {
                             console.warn(`⚠️ No hay paneles libres disponibles para mostrar el nombre científico (touch)`);
                         }
                         
                         return; // Salir temprano para evitar el comportamiento normal de selección
                    }
                }

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
        showError('Especifique el nombre del modelo (ej: corazon, hueso, dog, axolotl, discus, acot, tort, ham, pollo, o megazord.fbx)', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const modelInput = args[0].toLowerCase();
    
    // Detectar si el usuario especificó una extensión
    let modelUrl;
    let modelName;
    if (modelInput.includes('.')) {
        // El usuario especificó la extensión
        modelName = modelInput.split('.')[0];
        const extension = modelInput.split('.').pop();
        modelUrl = `./models/${modelName}.${extension}`;
    } else {
        // Sin extensión, intentar primero .fbx (más común para modelos animados), luego .obj
        modelName = modelInput;
        modelUrl = `./models/${modelName}.fbx`; // Cambiar a .fbx primero
    }
    
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

        // Si no se especificó extensión, intentar primero con .fbx (más común para modelos animados)
        // y luego con .obj como fallback
        let success = false;
        if (!modelInput.includes('.')) {
            // Intentar primero con .fbx
            const fbxUrl = `./models/${modelName}.fbx`;
            console.log(`Intentando cargar modelo FBX: ${fbxUrl}`);
            success = await loadModelToPanel(panel, fbxUrl, currentGrid.userData.cellSize);
            if (success) {
                modelUrl = fbxUrl; // Actualizar la URL para guardar en modelData
            } else {
                // Si falló, intentar con .obj
                const objUrl = `./models/${modelName}.obj`;
                console.log(`Intento con .fbx falló, intentando con .obj: ${objUrl}`);
                success = await loadModelToPanel(panel, objUrl, currentGrid.userData.cellSize);
                if (success) {
                    modelUrl = objUrl; // Actualizar la URL para guardar en modelData
                }
            }
        } else {
            // Si se especificó extensión, usar directamente
            success = await loadModelToPanel(panel, modelUrl, currentGrid.userData.cellSize);
        }
        
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

            // Guardar referencia del modelo en el panel como DISPLAY individual
            panel.modelData = {
                name: modelName,
                url: modelUrl,
                isRotating: true,
                rotationSpeed: 0.01,
                isModelDisplay: true, // NUEVO: Marcar como panel de display individual
                isFromModelCommand: true, // NUEVO: Identificar que viene del comando "model"
                scientificName: modelScientificNames[modelName] || null // 🔥 NUEVO: Guardar nombre científico
            };
        } else {
            // Actualizar mensaje de carga a error
            loadingMessage.className = 'terminal-error';
            loadingMessage.textContent = `Error al cargar el modelo ${modelName}. Asegúrese de que el archivo existe en la carpeta models/ (formatos soportados: .obj, .fbx)`;
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

/**
 * COMANDO PRINT - Sistema de Bioimpresión 3D
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Maneja el comando "print" desde la terminal
 * - Almacena el comando en el panel seleccionado para ejecución diferida
 * - Ejecuta inmediatamente si se proporciona un panel (desde carga de slot)
 * 
 * Flujo:
 * 1. Si se llama desde terminal: almacena comando en panel (pendingPrintCommand)
 * 2. Si se llama desde slot: ejecuta inmediatamente executePrintCommand()
 * 
 * Conexiones:
 * - executePrintCommand(): Ejecuta la interfaz completa de impresión
 * - panelText.js: Muestra textos en paneles
 * - panelModel.js: Carga modelos 3D para impresión
 * - bioLoad.js: Barras de progreso de rendering
 * 
 * Argumentos:
 * - args[0]: Nombre del modelo a imprimir (opcional, usa último modelo clickeado)
 * - providedContainerPanel: Panel contenedor (si viene de carga de slot)
 * -----------------------------------------------------------------------------
 */
async function handlePrintCommand(args = [], output, providedContainerPanel = null) {
    let containerPanel = providedContainerPanel;
    
    // Si no se proporciona un panel, buscar uno seleccionado
    if (!containerPanel) {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length === 0) {
            showError("You must select a panel to use as container.", output);
            return;
        }
        containerPanel = selectedPanels[0];
    }
    
    const currentGridParams = getCurrentGridParams();
    
    // Si se proporciona un panel (desde carga de slot), ejecutar el comando inmediatamente
    if (providedContainerPanel) {
        // Ejecutar el comando print normalmente
        await executePrintCommand(containerPanel, args, output);
        return;
    }
    
    // Si NO se proporciona un panel (comando desde terminal), almacenar el comando en el panel
    // El panel conserva su apariencia y no se activa hasta que un slot lo cargue
    containerPanel.pendingPrintCommand = true;
    containerPanel.printCommandArgs = args; // Guardar los argumentos del comando
    showInfo(`Print command stored in panel #${containerPanel.orderNumber}. It will activate when loaded from a slot.`, output);
    
    // NO eliminar el panel, NO crear la interfaz, solo almacenar el comando
    return;
}

/**
 * EJECUTOR PRINT - Interfaz Completa de Bioimpresión
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Crea la interfaz completa de impresión 3D con todas las fases
 * - Detecta si el panel está en HUD para usar parámetros correctos
 * - Maneja modelos rotando (HOMO PRINTEMPS mode)
 * 
 * Fases:
 * 1. Botón "PRINT MODEL" - Inicio de proceso
 * 2. Pantalla de confirmación (YES/NO)
 * 3. Pantalla de impresión (barras de progreso, tiempo, modelo)
 * 
 * Componentes creados:
 * - printBtn: Botón inicial
 * - confirmTitlePanel, continuePanel, cancelPanel: Confirmación
 * - printingTitlePanel: Título durante impresión
 * - renderingBarPanel: Barra de rendering (6 segundos)
 * - cyclicBarPanel: Barra cíclica rápida
 * - percentagePanel, remainingTimePanel, totalTimePanel: Info de progreso
 * - modelPanel: Nombre del modelo
 * 
 * Conexiones:
 * - handlePrintCommand(): Llamado desde aquí cuando se ejecuta desde slot
 * - bioLoad.js: updateProgressBar() para barras de progreso
 * - panelText.js: setPanelText() para textos
 * - panelModel.js: lastClickedModelFromGrid para modelo a imprimir
 * -----------------------------------------------------------------------------
 */
async function executePrintCommand(containerPanel, args = [], output) {
    // IMPORTANTE: Detectar si el panel contenedor está en el HUD y usar los parámetros correctos
    const isContainerInHUD = containerPanel.group && containerPanel.group.parent && 
                             containerPanel.group.parent.userData && containerPanel.group.parent.userData.isHUD;
    const currentGridParams = isContainerInHUD ? getHUDGridParams() : getCurrentGridParams();
    
    if (!currentGridParams) {
        if (output) {
            showError('No se pudieron obtener los parámetros del grid', output);
        }
        return;
    }
    
    // Obtener límites del grid para validar índices
    const gridCellsX = currentGridParams.cellsX;
    const gridCellsY = currentGridParams.cellsY;
    
    // Determine model name from command args or use last clicked model
    let modelName = null;
    let scientificName = null;
    
    if (args.length > 0 && args[0]) {
        const modelKey = args[0].toLowerCase();
        if (modelScientificNames[modelKey]) {
            modelName = modelKey;
            scientificName = modelScientificNames[modelKey];
        } else {
            // Try to find a matching model name
            for (const [key, value] of Object.entries(modelScientificNames)) {
                if (key.toLowerCase() === modelKey || value.toLowerCase() === modelKey) {
                    modelName = key;
                    scientificName = value;
                    break;
                }
            }
        }
    }
    
    // If no model specified in args, use last clicked model
    if (!scientificName && lastClickedModelFromGrid && lastClickedModelFromGrid.scientificName) {
        scientificName = lastClickedModelFromGrid.scientificName;
        modelName = lastClickedModelFromGrid.name;
    }
    
    // Default fallback
    if (!scientificName) {
        scientificName = 'UNKNOWN MODEL';
    }
    
    // 🧬 DETECCIÓN ESPECIAL: Verificar si hay modelos rotando (HOMO PRINTEMPS)
    const rotatingModelPanels = panels.filter(panel => {
        return panel.modelData && panel.modelData.isRotating && 
               (panel.modelData.isFromModelCommand || panel.modelData.isModelDisplay);
    });
    
    const isHomoPrintemps = rotatingModelPanels.length > 0;
    let homoPrintempsPanel = null;
    
    if (isHomoPrintemps) {
        homoPrintempsPanel = rotatingModelPanels[0]; // Usar el primer modelo rotando encontrado
        if (output) {
            showSuccess("🧬 HOMO PRINTEMPS MODE ACTIVATED ♀", output);
        }
    }
    
    // Eliminar el panel contenedor original inmediatamente
    if (containerPanel.group) {
        scene.remove(containerPanel.group);
        const index = panels.indexOf(containerPanel);
        if (index > -1) {
            panels.splice(index, 1);
        }
        if (output) {
            showInfo('Container panel removed', output);
        }
    }
    
    // Verificar que el contenedor sea lo suficientemente grande
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    if (containerWidth < 15 || containerHeight < 9) {
        if (output) {
            showError(`Panel must be at least 15x9 cells (current: ${containerWidth}x${containerHeight})`, output);
        }
        return;
    }
    
    // Crear una interfaz con múltiples paneles
    if (output) {
        showInfo('Creating print interface...', output);
    }
    
    // Definir tamaños para todos los paneles según las reglas específicas
    const buttonHeight = 2; // Altura reducida para botones: 2 unidades exactas
    const loadingBarHeight = 1; // Altura reducida para barra de loading: 1 unidad exacta
    const panelSpacing = 1; // Separación reducida entre paneles: 1 unidad exacta
    const buttonWidth = containerWidth - 4; // Dejar un pequeño margen
    const offsetX = 2; // Pequeño margen lateral
    
    // Función helper para validar y ajustar índices dentro de los límites del grid
    const clampIndices = (minX, maxX, minY, maxY) => {
        const clampedMinX = Math.max(0, Math.min(gridCellsX - 1, minX));
        const clampedMaxX = Math.max(0, Math.min(gridCellsX - 1, maxX));
        const clampedMinY = Math.max(0, Math.min(gridCellsY - 1, minY));
        const clampedMaxY = Math.max(0, Math.min(gridCellsY - 1, maxY));
        
        // Verificar que los índices sean válidos
        if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) {
            console.warn(`Índices inválidos: (${minX},${minY})-(${maxX},${maxY}) → (${clampedMinX},${clampedMinY})-(${clampedMaxX},${clampedMaxY})`);
            return null;
        }
        
        return { minX: clampedMinX, maxX: clampedMaxX, minY: clampedMinY, maxY: clampedMaxY };
    };
    
    // FASE 1: Crear panel "IMPRIMIR MODELO" como botón (altura: 3 unidades según regla)
    const printBtnIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3,
        containerPanel.minCellIndex.y + 3 + buttonHeight
    );
    
    if (!printBtnIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el botón PRINT MODEL', output);
        }
        return;
    }
    
    const printBtn = createPanelFromBoundingBox({
        minX: printBtnIndices.minX,
        maxX: printBtnIndices.maxX,
        minY: printBtnIndices.minY,
        maxY: printBtnIndices.maxY
    }, currentGridParams);
    
    // Configurarlo como botón con texto
    printBtn.isTextContainer = true;
    printBtn.isPrintButton = true; // Mark as print button for double tap handling
    // Store action callback for double tap handling
    printBtn.printButtonAction = () => {
        if (printBtn.group && printBtn.group.visible) {
            // Simulate double click by calling the handler directly
            printBtn.group.visible = false;
            showConfirmationScreen();
        }
    };
    createPanelText(printBtn, currentGridParams.cellSize);
    setPanelText(printBtn, "PRINT NOW?", currentGridParams.cellSize);
    
    // FASE 2: Paneles para la pantalla de confirmación (inicialmente ocultos)
    // Panel título de confirmación (altura: 3 unidades según regla)
    const confirmTitleIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3,
        containerPanel.minCellIndex.y + 3 + buttonHeight
    );
    
    if (!confirmTitleIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el título de confirmación', output);
        }
        return;
    }
    
    const confirmTitlePanel = createPanelFromBoundingBox({
        minX: confirmTitleIndices.minX,
        maxX: confirmTitleIndices.maxX,
        minY: confirmTitleIndices.minY,
        maxY: confirmTitleIndices.maxY
    }, currentGridParams);
    
    // Panel botón "CONTINUAR" (altura: 3 unidades según regla)
    const continueIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + Math.floor(containerWidth/2) - panelSpacing/2,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    );
    
    if (!continueIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el botón CONTINUAR', output);
        }
        return;
    }
    
    const continuePanel = createPanelFromBoundingBox({
        minX: continueIndices.minX,
        maxX: continueIndices.maxX,
        minY: continueIndices.minY,
        maxY: continueIndices.maxY
    }, currentGridParams);
    continuePanel.isPrintContinueButton = true; // Mark as continue button for double tap handling
    // Store action callback for double tap handling (will be set after showConfirmationScreen is defined)
    continuePanel.printButtonAction = null;
    
    // Panel botón "CANCELAR" (altura: 3 unidades según regla)
    const cancelIndices = clampIndices(
        containerPanel.minCellIndex.x + Math.floor(containerWidth/2) + panelSpacing/2,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    );
    
    if (!cancelIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el botón CANCELAR', output);
        }
        return;
    }
    
    const cancelPanel = createPanelFromBoundingBox({
        minX: cancelIndices.minX,
        maxX: cancelIndices.maxX,
        minY: cancelIndices.minY,
        maxY: cancelIndices.maxY
    }, currentGridParams);
    cancelPanel.isPrintCancelButton = true; // Mark as cancel button for double tap handling
    // Store action callback for double tap handling (will be set after showConfirmationScreen is defined)
    cancelPanel.printButtonAction = null;
    
    // FASE 3: Paneles para la pantalla de impresión (inicialmente ocultos)
    // Panel título "IMPRIMIENDO" (altura: 2 unidades)
    const printingTitleIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3,
        containerPanel.minCellIndex.y + 3 + buttonHeight
    );
    
    if (!printingTitleIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el título de impresión', output);
        }
        return;
    }
    
    const printingTitlePanel = createPanelFromBoundingBox({
        minX: printingTitleIndices.minX,
        maxX: printingTitleIndices.maxX,
        minY: printingTitleIndices.minY,
        maxY: printingTitleIndices.maxY
    }, currentGridParams);
    
    // Panel para la barra de progreso de RENDERING con texto (2 unidades de altura) - PRIMERO, justo después del título
    const renderingBarIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2
    );
    
    if (!renderingBarIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear la barra de rendering', output);
        }
        return;
    }
    
    const renderingBarPanel = createPanelFromBoundingBox({
        minX: renderingBarIndices.minX,
        maxX: renderingBarIndices.maxX,
        minY: renderingBarIndices.minY,
        maxY: renderingBarIndices.maxY
    }, currentGridParams);
    
    // Panel para la barra de progreso cíclica (barra rápida que se llena constantemente)
    const cyclicBarPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing, // Después de rendering
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 // 1 unidad de altura
    }, currentGridParams);
    
    // Panel para el porcentaje (2 unidades de altura)
    const percentagePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth/3) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2
    }, currentGridParams);
    
    // Panel para el tiempo restante (2 unidades de altura)
    const remainingTimePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth/3) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth*2/3) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2
    }, currentGridParams);
    
    // Panel para el tiempo total (2 unidades de altura)
    const totalTimePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth*2/3) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2
    }, currentGridParams);
    
    // Panel para modelo (2 unidades de altura)
    const modelPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2 + panelSpacing + 2
    }, currentGridParams);
    
    // Calcular altura total de todos los paneles de impresión para centrar verticalmente
    const totalPrintHeight = buttonHeight + panelSpacing + 2 + panelSpacing + 1 + panelSpacing + 2 + panelSpacing + 2 + panelSpacing + 2;
    const containerHeightForCentering = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    const verticalOffset = Math.floor((containerHeightForCentering - totalPrintHeight) / 2);
    
    // Ajustar todas las posiciones verticales para centrar
    const adjustVerticalPosition = (panel) => {
        if (panel && panel.minCellIndex && panel.maxCellIndex) {
            const currentMinY = panel.minCellIndex.y;
            const height = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
            const baseOffset = panel.minCellIndex.y - (containerPanel.minCellIndex.y + 3); // Offset desde la posición base
            const newMinY = containerPanel.minCellIndex.y + verticalOffset + baseOffset;
            panel.minCellIndex.y = newMinY;
            panel.maxCellIndex.y = newMinY + height - 1;
            
            // Actualizar la geometría del panel
            if (panel.group) {
                updatePanelGeometryAndPosition(panel, currentGridParams);
            }
        }
    };
    
    // Ajustar posición vertical de todos los paneles de impresión
    adjustVerticalPosition(printingTitlePanel);
    adjustVerticalPosition(cyclicBarPanel);
    adjustVerticalPosition(renderingBarPanel);
    adjustVerticalPosition(percentagePanel);
    adjustVerticalPosition(remainingTimePanel);
    adjustVerticalPosition(totalTimePanel);
    adjustVerticalPosition(modelPanel);
    
    // También ajustar paneles de confirmación y botón inicial
    adjustVerticalPosition(printBtn);
    adjustVerticalPosition(confirmTitlePanel);
    adjustVerticalPosition(continuePanel);
    adjustVerticalPosition(cancelPanel);
    
    // Configurar textos para todos los paneles
    const allTextPanels = [
        confirmTitlePanel, continuePanel, cancelPanel,
        printingTitlePanel, percentagePanel, remainingTimePanel, totalTimePanel, modelPanel
    ];
    
    allTextPanels.forEach(panel => {
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
    });
    
    // Asignar textos iniciales (con modo especial HOMO PRINTEMPS)
    const printingTitle = isHomoPrintemps ? "SPLICING IN PROGRESS" : "SPLICING IN PROGRESS";
    const confirmTitle = isHomoPrintemps ? "Print woman? ♀" : "SAVE SETTINGS";
    
    setPanelText(confirmTitlePanel, confirmTitle, currentGridParams.cellSize);
    setPanelText(continuePanel, "YES", currentGridParams.cellSize);
    setPanelText(cancelPanel, "NO", currentGridParams.cellSize);
    setPanelText(printingTitlePanel, printingTitle, currentGridParams.cellSize);
    setPanelText(percentagePanel, "0%", currentGridParams.cellSize);
    setPanelText(remainingTimePanel, "5:15:00:00:00", currentGridParams.cellSize);
    setPanelText(totalTimePanel, "REMAINING", currentGridParams.cellSize);
    setPanelText(modelPanel, `MODEL: ${scientificName}`, currentGridParams.cellSize);
    
    // Ocultar todos menos el botón inicial
    const allPanelsExceptPrintBtn = [
        confirmTitlePanel, continuePanel, cancelPanel,
        printingTitlePanel, cyclicBarPanel, renderingBarPanel,
        percentagePanel, remainingTimePanel, totalTimePanel, modelPanel
    ];
    
    allPanelsExceptPrintBtn.forEach(panel => {
        if (panel.group) panel.group.visible = false;
    });
    
    // === FASE 1: BOTÓN IMPRIMIR ===
    // Función para detectar click en el botón de imprimir
    let printBtnHover = false;
    let printBtnLastClickTime = 0;
    const DOUBLE_CLICK_DELAY = 300;
    
    function handleHoverPrintBtn(event) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const printBtnMeshes = [];
        if (printBtn.fillMesh) printBtnMeshes.push(printBtn.fillMesh);
        printBtn.borderLines.forEach(line => printBtnMeshes.push(line));
        
        const intersects = raycaster.intersectObjects(printBtnMeshes);
        
        // Actualizar estado de hover
        const wasHovering = printBtnHover;
        printBtnHover = intersects.length > 0;
        
        if (wasHovering !== printBtnHover) {
            printBtn.selected = printBtnHover;
            updatePanelColor(printBtn);
        }
    }
    
    function handleClickPrintBtn() {
        if (!printBtnHover) return;
        
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - printBtnLastClickTime;
        
        if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
            // Double click detected
            // Quitar listeners del botón imprimir
            document.removeEventListener('mousemove', handleHoverPrintBtn);
            document.removeEventListener('click', handleClickPrintBtn);
            
            // Ocultar botón de imprimir y mostrar pantalla de confirmación
            printBtn.group.visible = false;
            showConfirmationScreen();
            printBtnLastClickTime = 0; // Reset
        } else {
            // First click, wait for second
            printBtnLastClickTime = currentTime;
        }
    }
    
    // Activar listeners para botón de imprimir
    document.addEventListener('mousemove', handleHoverPrintBtn);
    document.addEventListener('click', handleClickPrintBtn);
    
    // Declare hideConfirmationScreen in outer scope so callbacks can access it
    let hideConfirmationScreen = null;
    
    // === FASE 2: PANTALLA DE CONFIRMACIÓN ===
    function showConfirmationScreen() {
        // Mostrar paneles de confirmación
        confirmTitlePanel.group.visible = true;
        continuePanel.group.visible = true;
        cancelPanel.group.visible = true;
        
        // Variables para control de hover
        let continueHover = false;
        let cancelHover = false;
        let continueLastClickTime = 0;
        let cancelLastClickTime = 0;
        const DOUBLE_CLICK_DELAY = 300;
        
        // Funciones para interacción con botones de confirmación
        function handleConfirmationHover(event) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // Verificar el botón continuar
            const continueMeshes = [];
            if (continuePanel.fillMesh) continueMeshes.push(continuePanel.fillMesh);
            continuePanel.borderLines.forEach(line => continueMeshes.push(line));
            
            // Verificar el botón cancelar
            const cancelMeshes = [];
            if (cancelPanel.fillMesh) cancelMeshes.push(cancelPanel.fillMesh);
            cancelPanel.borderLines.forEach(line => cancelMeshes.push(line));
            
            const continueIntersects = raycaster.intersectObjects(continueMeshes);
            const cancelIntersects = raycaster.intersectObjects(cancelMeshes);
            
            // Actualizar estados de hover
            const wasContinueHover = continueHover;
            const wasCancelHover = cancelHover;
            
            continueHover = continueIntersects.length > 0;
            cancelHover = cancelIntersects.length > 0;
            
            // Actualizar apariencia si cambió el estado
            if (wasContinueHover !== continueHover) {
                continuePanel.selected = continueHover;
                updatePanelColor(continuePanel);
            }
            
            if (wasCancelHover !== cancelHover) {
                cancelPanel.selected = cancelHover;
                updatePanelColor(cancelPanel);
            }
        }
        
        function handleConfirmationClick() {
            const currentTime = Date.now();
            
            if (continueHover) {
                const timeSinceLastClick = currentTime - continueLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    // Double click detected on continue
                    hideConfirmationScreen();
                    showPrintingScreen();
                    continueLastClickTime = 0; // Reset
                } else {
                    // First click, wait for second
                    continueLastClickTime = currentTime;
                }
            } else if (cancelHover) {
                const timeSinceLastClick = currentTime - cancelLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    // Double click detected on cancel
                    hideConfirmationScreen();
                    printBtn.group.visible = true;
                    document.addEventListener('mousemove', handleHoverPrintBtn);
                    document.addEventListener('click', handleClickPrintBtn);
                    cancelLastClickTime = 0; // Reset
                } else {
                    // First click, wait for second
                    cancelLastClickTime = currentTime;
                }
            }
        }
        
        // Función para ocultar pantalla de confirmación (assign to outer scope variable)
        hideConfirmationScreen = function() {
            document.removeEventListener('mousemove', handleConfirmationHover);
            document.removeEventListener('click', handleConfirmationClick);
            
            confirmTitlePanel.group.visible = false;
            continuePanel.group.visible = false;
            cancelPanel.group.visible = false;
        };
        
        document.addEventListener('mousemove', handleConfirmationHover);
        document.addEventListener('click', handleConfirmationClick);
        
        // También permitir uso del teclado
        function handleConfirmationKeyboard(event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'c' || event.key === 'C') {
                // Continuar
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                showPrintingScreen();
            } else if (event.key === 'Escape' || event.key === 'n' || event.key === 'N') {
                // Cancelar
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        }
        
        document.addEventListener('keydown', handleConfirmationKeyboard);
        
        // Now set the button action callbacks since hideConfirmationScreen is defined
        continuePanel.printButtonAction = () => {
            if (continuePanel.group && continuePanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                showPrintingScreen();
            }
        };
        
        cancelPanel.printButtonAction = () => {
            if (cancelPanel.group && cancelPanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        };
    }
    
    // === FASE 3: PANTALLA DE IMPRESIÓN ===
    function showPrintingScreen() {
        // Activar el estado de impresión para prevenir alteraciones
        isPrintingActive = true;
        
        // Mostrar paneles de impresión
        printingTitlePanel.group.visible = true;
        cyclicBarPanel.group.visible = true;
        renderingBarPanel.group.visible = true;
        percentagePanel.group.visible = true;
        remainingTimePanel.group.visible = true;
        totalTimePanel.group.visible = true;
        modelPanel.group.visible = true;
        
        // Variables para controlar el progreso de rendering (declaradas fuera del import para acceso global)
        let renderingStartTime = Date.now();
        let renderingProgress = 0;
        let renderingDuration = 300000; // 5 minutos en milisegundos
        let handlePrintingSpacebar = null; // Se definirá dentro del import
        
        // Configurar panel de progreso como barra usando bioLoad.js
        import("./bioLoad.js").then(bioLoadModule => {
            // Configurar la barra de rendering
            const renderingCanvas = document.createElement('canvas');
            renderingCanvas.width = 1024;
            renderingCanvas.height = 128; // Altura para la barra de 2 unidades
            
            renderingBarPanel.progressCanvas = renderingCanvas;
            renderingBarPanel.progressCtx = renderingCanvas.getContext('2d');
            renderingBarPanel.progressTexture = new THREE.CanvasTexture(renderingCanvas);
            renderingBarPanel.renderingProgress = 0;
            renderingBarPanel.renderingComplete = false;
            
            // Crear materiales con la textura para diferentes estados
            const renderingNormalMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            const renderingHoverMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            
            const renderingSelectedMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            
            // Proteger la textura del sistema de selección
            renderingBarPanel.hasTexture = true;
            renderingBarPanel.textureMaterials = {
                normal: renderingNormalMaterial,
                hover: renderingHoverMaterial,
                selected: renderingSelectedMaterial
            };
            
            // Aplicar el material al panel
            if (renderingBarPanel.fillMesh) {
                renderingBarPanel.fillMesh.material.dispose();
                renderingBarPanel.fillMesh.material = renderingNormalMaterial;
            }
            
            // Función para actualizar la barra de rendering con texto
            renderingBarPanel.drawRenderingProgress = function(progress) {
                if (!renderingBarPanel.progressCtx || !renderingBarPanel.progressTexture) return;
                
                // Dibujar la barra de progreso
                bioLoadModule.updateProgressBar(
                    renderingBarPanel.progressCtx,
                    renderingBarPanel.progressCanvas.width,
                    renderingBarPanel.progressCanvas.height,
                    progress,
                    0.3 // Pulso suave
                );
                
                // Dibujar el texto "PRINTING" o "PRINTING COMPLETE" con fuente pixelada
                const ctx = renderingBarPanel.progressCtx;
                const text = renderingBarPanel.renderingComplete ? "PRINTING COMPLETE" : "PRINTING";
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                // Usar "Press Start 2P" con espacios como en otros lugares del código
                const fontSize = Math.floor(renderingBarPanel.progressCanvas.height * 0.25);
                ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    text,
                    renderingBarPanel.progressCanvas.width / 2,
                    renderingBarPanel.progressCanvas.height / 2
                );
                
                renderingBarPanel.progressTexture.needsUpdate = true;
                Object.values(renderingBarPanel.textureMaterials).forEach(material => {
                    if (material && material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
            
            // Iniciar animación de rendering (5 minutos)
            renderingDuration = 300000; // 5 minutos en milisegundos (5 * 60 * 1000)
            renderingStartTime = Date.now();
            renderingProgress = 0;
            
            // 🔥 NUEVO: Función para adelantar el progreso al 95% con spacebar
            handlePrintingSpacebar = function(event) {
                if (event.key === ' ' || event.code === 'Space') {
                    event.preventDefault();
                    if (isPrintingActive && !renderingBarPanel.renderingComplete) {
                        // Adelantar el progreso al 95%
                        renderingProgress = 95;
                        renderingBarPanel.renderingProgress = 95;
                        // Ajustar el tiempo de inicio para que el cálculo de progreso refleje 95%
                        renderingStartTime = Date.now() - (renderingDuration * 0.95);
                        
                        // Actualizar la barra inmediatamente
                        if (renderingBarPanel.drawRenderingProgress) {
                            renderingBarPanel.drawRenderingProgress(95);
                        }
                        
                        // 🔥 NUEVO: Actualizar panel de porcentaje con tamaño de fuente aumentado
                        const percentageText = '95%';
                        const percentageState = panelTextState.get(percentagePanel);
                        if (percentageState) {
                            percentageState.customFontSize = 3.6; // Aumentar tamaño del número
                        }
                        setPanelText(percentagePanel, percentageText, currentGridParams.cellSize);
                        
                        console.log('Progreso de printing adelantado al 95% con spacebar');
                    }
                }
            };
            
            // Agregar listener para spacebar
            document.addEventListener('keydown', handlePrintingSpacebar);
            
            function animateRendering() {
                if (renderingBarPanel.renderingComplete) return;
                
                const currentTime = Date.now();
                const elapsed = currentTime - renderingStartTime;
                renderingProgress = Math.min(100, (elapsed / renderingDuration) * 100);
                
                renderingBarPanel.renderingProgress = renderingProgress;
                
                if (renderingBarPanel.drawRenderingProgress) {
                    renderingBarPanel.drawRenderingProgress(renderingProgress);
                }
                
                if (renderingProgress < 100) {
                    requestAnimationFrame(animateRendering);
                } else {
                    // Completado - mantener llena y cambiar texto
                    renderingBarPanel.renderingComplete = true;
                    // Remover listener de spacebar al completar
                    document.removeEventListener('keydown', handlePrintingSpacebar);
                    // Actualizar la barra para mostrar el nuevo texto
                    if (renderingBarPanel.drawRenderingProgress) {
                        renderingBarPanel.drawRenderingProgress(100);
                    }
                }
            }
            
            // Iniciar la animación
            animateRendering();
            
            // Crear la barra de progreso cíclica
            const cyclicCanvas = document.createElement('canvas');
            cyclicCanvas.width = 1024;
            cyclicCanvas.height = 32; // Más pequeña que la principal
            
            cyclicBarPanel.progressCanvas = cyclicCanvas;
            cyclicBarPanel.progressCtx = cyclicCanvas.getContext('2d');
            cyclicBarPanel.progressTexture = new THREE.CanvasTexture(cyclicCanvas);
            cyclicBarPanel.cycleProgress = 0;
            cyclicBarPanel.cycleSpeed = Math.random() * 1.5 + 0.5; // Velocidad inicial aleatoria entre 0.5 y 2.0
            cyclicBarPanel.cycleCount = 0; // Contador de ciclos completados
            
            // Crear materiales con la textura para diferentes estados
            const cyclicNormalMaterial = new THREE.MeshBasicMaterial({
                map: cyclicBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            const cyclicHoverMaterial = new THREE.MeshBasicMaterial({
                map: cyclicBarPanel.progressTexture,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            
            const cyclicSelectedMaterial = new THREE.MeshBasicMaterial({
                map: cyclicBarPanel.progressTexture,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            
            // Proteger la textura del sistema de selección
            cyclicBarPanel.hasTexture = true;
            cyclicBarPanel.textureMaterials = {
                normal: cyclicNormalMaterial,
                hover: cyclicHoverMaterial,
                selected: cyclicSelectedMaterial
            };
            
            // Aplicar el material al panel
            if (cyclicBarPanel.fillMesh) {
                cyclicBarPanel.fillMesh.material.dispose();
                cyclicBarPanel.fillMesh.material = cyclicNormalMaterial;
            }
            
            // Función para actualizar la barra cíclica
            cyclicBarPanel.updateCyclicBar = function() {
                // Incrementar progreso
                cyclicBarPanel.cycleProgress += cyclicBarPanel.cycleSpeed;
                
                // Reiniciar y cambiar velocidad cuando se completa un ciclo
                if (cyclicBarPanel.cycleProgress > 100) {
                    cyclicBarPanel.cycleProgress = 0;
                    cyclicBarPanel.cycleCount++; // Incrementar contador de ciclos
                    
                    // Generar nueva velocidad aleatoria entre 0.5 y 2.5
                    cyclicBarPanel.cycleSpeed = Math.random() * 2.0 + 0.5;
                    console.log(`Nuevo ciclo #${cyclicBarPanel.cycleCount} - Velocidad: ${cyclicBarPanel.cycleSpeed.toFixed(2)}`);
                }
                
                // Usar función de bioLoad para dibujar la barra
                bioLoadModule.updateProgressBar(
                    cyclicBarPanel.progressCtx,
                    cyclicBarPanel.progressCanvas.width,
                    cyclicBarPanel.progressCanvas.height,
                    cyclicBarPanel.cycleProgress,
                    0.5 // Pulso constante
                );
                
                // Actualizar todas las texturas de los materiales
                cyclicBarPanel.progressTexture.needsUpdate = true;
                
                // Asegurar que se mantenga la textura en todos los estados
                Object.values(cyclicBarPanel.textureMaterials).forEach(material => {
                    if (material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
        }).catch(err => console.error("Error al cargar bioLoad.js:", err));
        
        let isRunning = true;
        
        // Tiempo total de impresión en minutos (condicional basado en el modelo)
        // Bone/hueso tarda 5 minutos, otros modelos 40 minutos
        let totalPrintTimeMinutes = 40;
        let totalPrintHours = 135;
        
        // Check if the model is bone (by model name or scientific name)
        const isBone = modelName && (
            modelName.toLowerCase() === 'bone' || 
            modelName.toLowerCase() === 'hueso' ||
            scientificName === 'BONE'
        );
        
        if (isBone) {
            totalPrintTimeMinutes = 5;
            // En la simulación, 5 minutos representan proporcionalmente menos tiempo
            // Si 40 min = 135 horas, entonces 5 min = ~16.875 horas, redondeamos a 17 horas
            totalPrintHours = 17;
        }
        
        // Función para manejar escape
        function handlePrintingEscape(event) {
            if (event.key === 'Escape') {
                isRunning = false;
                isPrintingActive = false; // Desactivar estado de impresión
                document.removeEventListener('keydown', handlePrintingEscape);
                // Remover también el listener de spacebar si existe
                if (handlePrintingSpacebar) {
                    document.removeEventListener('keydown', handlePrintingSpacebar);
                }
                
                // Mostrar pantalla final
                printingTitlePanel.group.visible = true;
                setPanelText(printingTitlePanel, "Process interrupted", currentGridParams.cellSize);
                
                // Ocultar otros paneles
                cyclicBarPanel.group.visible = false;
                renderingBarPanel.group.visible = false;
                percentagePanel.group.visible = false;
                remainingTimePanel.group.visible = false;
                totalTimePanel.group.visible = false;
                modelPanel.group.visible = false;
                
                // Volver al botón original después de un tiempo
                setTimeout(() => {
                    printingTitlePanel.group.visible = false;
                    printBtn.group.visible = true;
                    isPrintingActive = false; // Asegurar que se desactive
                    document.addEventListener('mousemove', handleHoverPrintBtn);
                    document.addEventListener('click', handleClickPrintBtn);
                }, 3000);
            }
        }
        
        document.addEventListener('keydown', handlePrintingEscape);
        
        // Función para actualizar la barra de progreso
        function updatePrintProgress() {
            if (!isRunning) return;
            
            const startTime = Date.now();
            const duration = totalPrintTimeMinutes * 60 * 1000; // Duración en milisegundos
            
            function animate() {
                if (!isRunning) return;
                
                // 🔥 CRITICAL: Siempre usar renderingProgress si está disponible (respetar adelanto con spacebar)
                // Si renderingProgress está definido, usarlo directamente en lugar de calcular
                let progress;
                if (typeof renderingProgress !== 'undefined' && renderingProgress > 0) {
                    // Usar el progreso de rendering (que se actualiza con spacebar)
                    progress = renderingProgress;
                } else {
                    // Fallback: calcular progreso basado en tiempo si renderingProgress no está disponible
                    const currentTime = Date.now();
                    const elapsed = currentTime - startTime;
                    progress = Math.min(100, (elapsed / duration) * 100);
                }
                
                // Solicitar siguiente frame inmediatamente para actualización de alta precisión
                if (progress < 100) {
                    requestAnimationFrame(animate);
                }
                
                // Forzar visibilidad de los paneles de impresión para evitar que desaparezcan
                if (isPrintingActive) {
                    cyclicBarPanel.group.visible = true;
                    renderingBarPanel.group.visible = true;
                    percentagePanel.group.visible = true;
                    remainingTimePanel.group.visible = true;
                    totalTimePanel.group.visible = true;
                    modelPanel.group.visible = true;
                }
                
                // Actualizar barra cíclica
                if (cyclicBarPanel.updateCyclicBar) {
                    cyclicBarPanel.updateCyclicBar();
                }
                
                // Calcular tiempo restante en el formato d:h:m:s:24avos
                // Usar el progreso real para calcular el tiempo restante
                const remainingMs = duration - (duration * progress / 100);
                const totalMs = totalPrintHours * 60 * 60 * 1000; // Total en milisegundos simulados
                
                // Escalamos el tiempo restante real al tiempo simulado
                const simulatedRemainingMs = remainingMs > 0 ? (remainingMs / duration) * totalMs : 0;
                
                // Calculamos las partes de la cuenta regresiva
                const days = Math.floor(simulatedRemainingMs / (24 * 60 * 60 * 1000));
                const hours = Math.floor((simulatedRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutes = Math.floor((simulatedRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
                const seconds = Math.floor((simulatedRemainingMs % (60 * 1000)) / 1000);
                const twentyFourths = Math.floor((simulatedRemainingMs % 1000) / (1000 / 24));
                
                // Formatear la cuenta regresiva
                const timeDisplay = `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(twentyFourths).padStart(2, '0')}`;
                
                // Actualizar paneles de información
                // 🔥 CRITICAL: Mantener el tamaño de fuente aumentado si ya se estableció
                const percentageText = `${Math.floor(progress)}%`;
                const percentageState = panelTextState.get(percentagePanel);
                if (percentageState && percentageState.customFontSize) {
                    // Mantener el tamaño de fuente aumentado
                } else if (progress >= 95) {
                    // Si el progreso es 95% o más, aumentar el tamaño de fuente
                    if (!percentageState) {
                        panelTextState.set(percentagePanel, { customFontSize: 3.6 });
                    } else {
                        percentageState.customFontSize = 3.6;
                    }
                }
                setPanelText(percentagePanel, percentageText, currentGridParams.cellSize);
                setPanelText(remainingTimePanel, timeDisplay, currentGridParams.cellSize);
                setPanelText(totalTimePanel, `REMAINING`, currentGridParams.cellSize);
                
                // No necesitamos solicitar un nuevo frame aquí ya que lo hacemos al inicio de la función
                if (progress >= 100) {
                    // Proceso completado
                    isRunning = false;
                    isPrintingActive = false; // Desactivar estado de impresión
                    
                    // Mostrar mensaje final
                    setPanelText(printingTitlePanel, "Print completed", currentGridParams.cellSize);
                    
                    // Ocultar paneles informativos
                    cyclicBarPanel.group.visible = false;
                    renderingBarPanel.group.visible = false;
                    percentagePanel.group.visible = false;
                    remainingTimePanel.group.visible = false;
                    totalTimePanel.group.visible = false;
                    modelPanel.group.visible = false;
                    
                    document.removeEventListener('keydown', handlePrintingEscape);
                    
                    // Volver al botón original después de un tiempo
                    setTimeout(() => {
                        printingTitlePanel.group.visible = false;
                        printBtn.group.visible = true;
                        document.addEventListener('mousemove', handleHoverPrintBtn);
                        document.addEventListener('click', handleClickPrintBtn);
                    }, 3000);
                }
            }
            
            animate();
        }
        
        // 🧬 INICIALIZAR MODO ESPECIAL HOMO PRINTEMPS
        if (isHomoPrintemps && homoPrintempsPanel) {
            initializeHomoPrintempsMode(homoPrintempsPanel, homoPrintempsPanel, currentGridParams, cyclicBarPanel);
        }
        
        // Iniciar actualización de progreso
        updatePrintProgress();
    }
    
    // Función auxiliar para eliminar un panel
    function removePanelFromScene(panel) {
        if (panel.group) {
            scene.remove(panel.group);
            const index = panels.indexOf(panel);
            if (index > -1) {
                panels.splice(index, 1);
            }
        }
    }
}

/**
 * COMANDO PRINT SIMPLE - Versión Simplificada
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Maneja el comando "print simple" desde la terminal
 * - Versión simplificada que solo muestra barra de rendering
 * - Almacena comando para ejecución diferida o ejecuta inmediatamente
 * 
 * Diferencia con print completo:
 * - No incluye barras de progreso cíclica, porcentaje, tiempo, modelo
 * - Solo muestra: botón inicial, confirmación, barra de rendering
 * 
 * Conexiones:
 * - executePrintSimpleCommand(): Ejecuta la interfaz simplificada
 * - bioLoad.js: Barras de progreso
 * -----------------------------------------------------------------------------
 */
async function handlePrintSimpleCommand(args = [], output, providedContainerPanel = null) {
    let containerPanel = providedContainerPanel;
    
    // Si no se proporciona un panel, buscar uno seleccionado
    if (!containerPanel) {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length === 0) {
            showError("You must select a panel to use as container.", output);
            return;
        }
        containerPanel = selectedPanels[0];
    }
    
    const currentGridParams = getCurrentGridParams();
    
    // Si se proporciona un panel (desde carga de slot), ejecutar el comando inmediatamente
    if (providedContainerPanel) {
        await executePrintSimpleCommand(containerPanel, output);
        return;
    }
    
    // Si NO se proporciona un panel (comando desde terminal), almacenar el comando en el panel
    containerPanel.pendingPrintSimpleCommand = true;
    showInfo(`Print simple command stored in panel #${containerPanel.orderNumber}. It will activate when loaded from a slot.`, output);
    
    // NO eliminar el panel, NO crear la interfaz, solo almacenar el comando
    return;
}

/**
 * EJECUTOR PRINT SIMPLE - Interfaz Simplificada de Rendering
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Crea interfaz simplificada con solo barra de rendering
 * - Detecta si el panel está en HUD para usar parámetros correctos
 * - Versión minimalista del comando print
 * 
 * Componentes creados:
 * - printBtn: Botón inicial
 * - confirmTitlePanel, continuePanel, cancelPanel: Confirmación
 * - renderingBarPanel: Solo barra de rendering (6 segundos)
 * 
 * Conexiones:
 * - handlePrintSimpleCommand(): Llamado desde aquí cuando se ejecuta desde slot
 * - bioLoad.js: updateProgressBar() para barra de rendering
 * -----------------------------------------------------------------------------
 */
async function executePrintSimpleCommand(containerPanel, output) {
    // IMPORTANTE: Detectar si el panel contenedor está en el HUD y usar los parámetros correctos
    const isContainerInHUD = containerPanel.group && containerPanel.group.parent && 
                             containerPanel.group.parent.userData && containerPanel.group.parent.userData.isHUD;
    const currentGridParams = isContainerInHUD ? getHUDGridParams() : getCurrentGridParams();
    
    if (!currentGridParams) {
        if (output) {
            showError('No se pudieron obtener los parámetros del grid', output);
        }
        return;
    }
    
    // Obtener límites del grid para validar índices
    const gridCellsX = currentGridParams.cellsX;
    const gridCellsY = currentGridParams.cellsY;
    
    // Eliminar el panel contenedor original inmediatamente
    if (containerPanel.group) {
        scene.remove(containerPanel.group);
        const index = panels.indexOf(containerPanel);
        if (index > -1) {
            panels.splice(index, 1);
        }
        if (output) {
            showInfo('Container panel removed', output);
        }
    }
    
    // Verificar que el contenedor sea lo suficientemente grande
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    if (containerWidth < 15 || containerHeight < 9) {
        if (output) {
            showError(`Panel must be at least 15x9 cells (current: ${containerWidth}x${containerHeight})`, output);
        }
        return;
    }
    
    // Crear una interfaz simplificada
    if (output) {
        showInfo('Creating simple print interface...', output);
    }
    
    // Definir tamaños
    const buttonHeight = 2;
    const panelSpacing = 1;
    const buttonWidth = containerWidth - 4;
    const offsetX = 2;
    
    // Función helper para validar y ajustar índices dentro de los límites del grid
    const clampIndices = (minX, maxX, minY, maxY) => {
        const clampedMinX = Math.max(0, Math.min(gridCellsX - 1, minX));
        const clampedMaxX = Math.max(0, Math.min(gridCellsX - 1, maxX));
        const clampedMinY = Math.max(0, Math.min(gridCellsY - 1, minY));
        const clampedMaxY = Math.max(0, Math.min(gridCellsY - 1, maxY));
        
        if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) {
            console.warn(`Índices inválidos: (${minX},${minY})-(${maxX},${maxY})`);
            return null;
        }
        
        return { minX: clampedMinX, maxX: clampedMaxX, minY: clampedMinY, maxY: clampedMaxY };
    };
    
    // FASE 1: Botón inicial "PRINT MODEL"
    const printBtnIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3,
        containerPanel.minCellIndex.y + 3 + buttonHeight
    );
    
    if (!printBtnIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el botón PRINT MODEL', output);
        }
        return;
    }
    
    const printBtn = createPanelFromBoundingBox({
        minX: printBtnIndices.minX,
        maxX: printBtnIndices.maxX,
        minY: printBtnIndices.minY,
        maxY: printBtnIndices.maxY
    }, currentGridParams);
    
    printBtn.isTextContainer = true;
    printBtn.isPrintButton = true;
    printBtn.printButtonAction = () => {
        if (printBtn.group && printBtn.group.visible) {
            printBtn.group.visible = false;
            showConfirmationScreen();
        }
    };
    createPanelText(printBtn, currentGridParams.cellSize);
    setPanelText(printBtn, "PRINT NOW?", currentGridParams.cellSize);
    
    // FASE 2: Paneles de confirmación (YES/NO arriba, SAVE SETTINGS abajo)
    const continuePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth/2) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    continuePanel.isPrintContinueButton = true;
    continuePanel.printButtonAction = null;
    
    const cancelPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth/2) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    cancelPanel.isPrintCancelButton = true;
    cancelPanel.printButtonAction = null;
    
    const confirmTitlePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    
    // FASE 3: Solo la barra de rendering
    const renderingBarPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing + 2
    }, currentGridParams);
    
    // Configurar textos
    const allTextPanels = [confirmTitlePanel, continuePanel, cancelPanel, printBtn];
    allTextPanels.forEach(panel => {
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
    });
    
    setPanelText(confirmTitlePanel, "SAVE SETTINGS", currentGridParams.cellSize);
    setPanelText(continuePanel, "YES", currentGridParams.cellSize);
    setPanelText(cancelPanel, "NO", currentGridParams.cellSize);
    
    // Ocultar todos menos el botón inicial
    const allPanelsExceptPrintBtn = [confirmTitlePanel, continuePanel, cancelPanel, renderingBarPanel];
    allPanelsExceptPrintBtn.forEach(panel => {
        if (panel.group) panel.group.visible = false;
    });
    
    // Calcular altura total para centrar verticalmente
    const totalPrintHeight = buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing + 2;
    const containerHeightForCentering = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    const verticalOffset = Math.floor((containerHeightForCentering - totalPrintHeight) / 2);
    
    const adjustVerticalPosition = (panel) => {
        if (panel && panel.minCellIndex && panel.maxCellIndex) {
            const height = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
            const baseOffset = panel.minCellIndex.y - (containerPanel.minCellIndex.y + 3);
            const newMinY = containerPanel.minCellIndex.y + verticalOffset + baseOffset;
            panel.minCellIndex.y = newMinY;
            panel.maxCellIndex.y = newMinY + height - 1;
            if (panel.group) {
                updatePanelGeometryAndPosition(panel, currentGridParams);
            }
        }
    };
    
    adjustVerticalPosition(printBtn);
    adjustVerticalPosition(confirmTitlePanel);
    adjustVerticalPosition(continuePanel);
    adjustVerticalPosition(cancelPanel);
    adjustVerticalPosition(renderingBarPanel);
    
    // Asegurar que los textos se actualicen después de ajustar posiciones
    setPanelText(printBtn, "PRINT NOW?", currentGridParams.cellSize);
    setPanelText(confirmTitlePanel, "SAVE SETTINGS", currentGridParams.cellSize);
    setPanelText(continuePanel, "YES", currentGridParams.cellSize);
    setPanelText(cancelPanel, "NO", currentGridParams.cellSize);
    
    // === FASE 1: BOTÓN IMPRIMIR ===
    let printBtnHover = false;
    let printBtnLastClickTime = 0;
    const DOUBLE_CLICK_DELAY = 300;
    
    function handleHoverPrintBtn(event) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const printBtnMeshes = [];
        if (printBtn.fillMesh) printBtnMeshes.push(printBtn.fillMesh);
        printBtn.borderLines.forEach(line => printBtnMeshes.push(line));
        
        const intersects = raycaster.intersectObjects(printBtnMeshes);
        
        const wasHovering = printBtnHover;
        printBtnHover = intersects.length > 0;
        
        if (wasHovering !== printBtnHover) {
            printBtn.selected = printBtnHover;
            updatePanelColor(printBtn);
        }
    }
    
    function handleClickPrintBtn() {
        if (!printBtnHover) return;
        
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - printBtnLastClickTime;
        
        if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
            document.removeEventListener('mousemove', handleHoverPrintBtn);
            document.removeEventListener('click', handleClickPrintBtn);
            printBtn.group.visible = false;
            showConfirmationScreen();
            printBtnLastClickTime = 0;
        } else {
            printBtnLastClickTime = currentTime;
        }
    }
    
    document.addEventListener('mousemove', handleHoverPrintBtn);
    document.addEventListener('click', handleClickPrintBtn);
    
    // === FASE 2: PANTALLA DE CONFIRMACIÓN ===
    let hideConfirmationScreen = null;
    
    function showConfirmationScreen() {
        confirmTitlePanel.group.visible = true;
        continuePanel.group.visible = true;
        cancelPanel.group.visible = true;
        
        let continueHover = false;
        let cancelHover = false;
        let continueLastClickTime = 0;
        let cancelLastClickTime = 0;
        
        function handleConfirmationHover(event) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const continueMeshes = [];
            if (continuePanel.fillMesh) continueMeshes.push(continuePanel.fillMesh);
            continuePanel.borderLines.forEach(line => continueMeshes.push(line));
            
            const cancelMeshes = [];
            if (cancelPanel.fillMesh) cancelMeshes.push(cancelPanel.fillMesh);
            cancelPanel.borderLines.forEach(line => cancelMeshes.push(line));
            
            const continueIntersects = raycaster.intersectObjects(continueMeshes);
            const cancelIntersects = raycaster.intersectObjects(cancelMeshes);
            
            const wasContinueHover = continueHover;
            const wasCancelHover = cancelHover;
            
            continueHover = continueIntersects.length > 0;
            cancelHover = cancelIntersects.length > 0;
            
            if (wasContinueHover !== continueHover) {
                continuePanel.selected = continueHover;
                updatePanelColor(continuePanel);
            }
            
            if (wasCancelHover !== cancelHover) {
                cancelPanel.selected = cancelHover;
                updatePanelColor(cancelPanel);
            }
        }
        
        function handleConfirmationClick() {
            const currentTime = Date.now();
            
            if (continueHover) {
                const timeSinceLastClick = currentTime - continueLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    hideConfirmationScreen();
                    showRenderingScreen();
                    continueLastClickTime = 0;
                } else {
                    continueLastClickTime = currentTime;
                }
            } else if (cancelHover) {
                const timeSinceLastClick = currentTime - cancelLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    hideConfirmationScreen();
                    printBtn.group.visible = true;
                    document.addEventListener('mousemove', handleHoverPrintBtn);
                    document.addEventListener('click', handleClickPrintBtn);
                    cancelLastClickTime = 0;
                } else {
                    cancelLastClickTime = currentTime;
                }
            }
        }
        
        hideConfirmationScreen = function() {
            document.removeEventListener('mousemove', handleConfirmationHover);
            document.removeEventListener('click', handleConfirmationClick);
            confirmTitlePanel.group.visible = false;
            continuePanel.group.visible = false;
            cancelPanel.group.visible = false;
        };
        
        document.addEventListener('mousemove', handleConfirmationHover);
        document.addEventListener('click', handleConfirmationClick);
        
        function handleConfirmationKeyboard(event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'y' || event.key === 'Y') {
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                showRenderingScreen();
            } else if (event.key === 'Escape' || event.key === 'n' || event.key === 'N') {
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        }
        
        document.addEventListener('keydown', handleConfirmationKeyboard);
        
        continuePanel.printButtonAction = () => {
            if (continuePanel.group && continuePanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                showRenderingScreen();
            }
        };
        
        cancelPanel.printButtonAction = () => {
            if (cancelPanel.group && cancelPanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        };
    }
    
    // === FASE 3: PANTALLA DE RENDERING ===
    function showRenderingScreen() {
        isPrintingActive = true;
        renderingBarPanel.group.visible = true;
        
        import("./bioLoad.js").then(bioLoadModule => {
            const renderingCanvas = document.createElement('canvas');
            renderingCanvas.width = 1024;
            renderingCanvas.height = 128; // Altura para la barra de 2 unidades
            
            renderingBarPanel.progressCanvas = renderingCanvas;
            renderingBarPanel.progressCtx = renderingCanvas.getContext('2d');
            renderingBarPanel.progressTexture = new THREE.CanvasTexture(renderingCanvas);
            renderingBarPanel.renderingProgress = 0;
            renderingBarPanel.renderingComplete = false;
            
            const renderingNormalMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            const renderingHoverMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            
            const renderingSelectedMaterial = new THREE.MeshBasicMaterial({
                map: renderingBarPanel.progressTexture,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            
            renderingBarPanel.hasTexture = true;
            renderingBarPanel.textureMaterials = {
                normal: renderingNormalMaterial,
                hover: renderingHoverMaterial,
                selected: renderingSelectedMaterial
            };
            
            if (renderingBarPanel.fillMesh) {
                renderingBarPanel.fillMesh.material.dispose();
                renderingBarPanel.fillMesh.material = renderingNormalMaterial;
            }
            
            // Función para actualizar la barra de rendering con texto
            renderingBarPanel.drawRenderingProgress = function(progress) {
                if (!renderingBarPanel.progressCtx || !renderingBarPanel.progressTexture) return;
                
                // Dibujar la barra de progreso
                bioLoadModule.updateProgressBar(
                    renderingBarPanel.progressCtx,
                    renderingBarPanel.progressCanvas.width,
                    renderingBarPanel.progressCanvas.height,
                    progress,
                    0.3 // Pulso suave
                );
                
                // Dibujar el texto "RENDERING" o "RENDERING COMPLETE" con fuente pixelada
                const ctx = renderingBarPanel.progressCtx;
                const text = renderingBarPanel.renderingComplete ? "RENDERING COMPLETE" : "RENDERING";
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                const fontSize = Math.floor(renderingBarPanel.progressCanvas.height * 0.25);
                ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    text,
                    renderingBarPanel.progressCanvas.width / 2,
                    renderingBarPanel.progressCanvas.height / 2
                );
                
                renderingBarPanel.progressTexture.needsUpdate = true;
                Object.values(renderingBarPanel.textureMaterials).forEach(material => {
                    if (material && material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
            
            // Iniciar animación de rendering (6 segundos)
            const renderingDuration = 6000; // 6 segundos en milisegundos
            const renderingStartTime = Date.now();
            
            function animateRendering() {
                if (renderingBarPanel.renderingComplete) return;
                
                const currentTime = Date.now();
                const elapsed = currentTime - renderingStartTime;
                const progress = Math.min(100, (elapsed / renderingDuration) * 100);
                
                renderingBarPanel.renderingProgress = progress;
                
                if (renderingBarPanel.drawRenderingProgress) {
                    renderingBarPanel.drawRenderingProgress(progress);
                }
                
                if (progress < 100) {
                    requestAnimationFrame(animateRendering);
                } else {
                    // Completado - mantener llena y cambiar texto
                    renderingBarPanel.renderingComplete = true;
                    // Actualizar la barra para mostrar el nuevo texto
                    if (renderingBarPanel.drawRenderingProgress) {
                        renderingBarPanel.drawRenderingProgress(100);
                    }
                }
            }
            
            animateRendering();
        }).catch(err => console.error("Error al cargar bioLoad.js:", err));
    }
}

/**
 * COMANDO PRINT PERCENT - Barra de Progreso con Porcentaje
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Maneja el comando "print percent ###" desde la terminal
 * - Muestra barra de progreso con porcentaje en lugar de "RENDERING"
 * - Usa los milisegundos proporcionados como duración
 * - Almacena comando para ejecución diferida o ejecuta inmediatamente
 * 
 * Sintaxis:
 * - print percent [milisegundos] - Duración en milisegundos
 * 
 * Ejemplo:
 * - print percent 5000 - Barra de 5 segundos mostrando porcentaje
 * 
 * Conexiones:
 * - executePrintPercentCommand(): Ejecuta la interfaz con barra de porcentaje
 * - bioLoad.js: updateProgressBar() para dibujar la barra
 * -----------------------------------------------------------------------------
 */
async function handlePrintPercentCommand(args = [], output, providedContainerPanel = null) {
    let containerPanel = providedContainerPanel;
    
    // Si no se proporciona un panel, buscar uno seleccionado
    if (!containerPanel) {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length === 0) {
            showError("You must select a panel to use as container.", output);
            return;
        }
        containerPanel = selectedPanels[0];
    }
    
    // Validar que se proporcione duración en milisegundos
    if (args.length === 0 || !args[0]) {
        showError("You must provide duration in milliseconds. Example: print percent 5000", output);
        return;
    }
    
    const durationMs = parseInt(args[0], 10);
    if (isNaN(durationMs) || durationMs <= 0) {
        showError(`Invalid duration: ${args[0]}. Must be a positive number (milliseconds).`, output);
        return;
    }
    
    const currentGridParams = getCurrentGridParams();
    
    // Si se proporciona un panel (desde carga de slot), ejecutar el comando inmediatamente
    if (providedContainerPanel) {
        await executePrintPercentCommand(containerPanel, durationMs, output);
        return;
    }
    
    // Si NO se proporciona un panel (comando desde terminal), almacenar el comando en el panel
    containerPanel.pendingPrintPercentCommand = true;
    containerPanel.printPercentDuration = durationMs; // Guardar la duración en milisegundos
    showInfo(`Print percent command stored in panel #${containerPanel.orderNumber} (${durationMs}ms). It will activate when loaded from a slot.`, output);
    
    // NO eliminar el panel, NO crear la interfaz, solo almacenar el comando
    return;
}

/**
 * EJECUTOR PRINT PERCENT - Interfaz con Barra de Porcentaje
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Crea interfaz con barra que muestra porcentaje en lugar de "RENDERING"
 * - Usa duración personalizada en milisegundos
 * - Detecta si el panel está en HUD para usar parámetros correctos
 * 
 * Componentes creados:
 * - printBtn: Botón inicial
 * - confirmTitlePanel, continuePanel, cancelPanel: Confirmación
 * - percentBarPanel: Barra que muestra porcentaje (ej: "45%")
 * 
 * Conexiones:
 * - handlePrintPercentCommand(): Llamado desde aquí cuando se ejecuta desde slot
 * - bioLoad.js: updateProgressBar() para dibujar la barra
 * -----------------------------------------------------------------------------
 */
async function executePrintPercentCommand(containerPanel, durationMs, output) {
    // IMPORTANTE: Detectar si el panel contenedor está en el HUD y usar los parámetros correctos
    const isContainerInHUD = containerPanel.group && containerPanel.group.parent && 
                             containerPanel.group.parent.userData && containerPanel.group.parent.userData.isHUD;
    const currentGridParams = isContainerInHUD ? getHUDGridParams() : getCurrentGridParams();
    
    if (!currentGridParams) {
        if (output) {
            showError('No se pudieron obtener los parámetros del grid', output);
        }
        return;
    }
    
    // Obtener límites del grid para validar índices
    const gridCellsX = currentGridParams.cellsX;
    const gridCellsY = currentGridParams.cellsY;
    
    // Eliminar el panel contenedor original inmediatamente
    if (containerPanel.group) {
        if (isContainerInHUD) {
            const hudScene = getHUDScene();
            if (hudScene && hudScene.children.includes(containerPanel.group)) {
                hudScene.remove(containerPanel.group);
            }
        } else {
            scene.remove(containerPanel.group);
        }
        const index = panels.indexOf(containerPanel);
        if (index > -1) {
            panels.splice(index, 1);
        }
        if (output) {
            showInfo('Container panel removed', output);
        }
    }
    
    // Verificar que el contenedor sea lo suficientemente grande
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    if (containerWidth < 15 || containerHeight < 9) {
        if (output) {
            showError(`Panel must be at least 15x9 cells (current: ${containerWidth}x${containerHeight})`, output);
        }
        return;
    }
    
    // Crear una interfaz simplificada
    if (output) {
        showInfo(`Creating print percent interface (${durationMs}ms)...`, output);
    }
    
    // Definir tamaños
    const buttonHeight = 2;
    const panelSpacing = 1;
    const buttonWidth = containerWidth - 4;
    const offsetX = 2;
    
    // Función helper para validar y ajustar índices dentro de los límites del grid
    const clampIndices = (minX, maxX, minY, maxY) => {
        const clampedMinX = Math.max(0, Math.min(gridCellsX - 1, minX));
        const clampedMaxX = Math.max(0, Math.min(gridCellsX - 1, maxX));
        const clampedMinY = Math.max(0, Math.min(gridCellsY - 1, minY));
        const clampedMaxY = Math.max(0, Math.min(gridCellsY - 1, maxY));
        
        if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) {
            console.warn(`Índices inválidos: (${minX},${minY})-(${maxX},${maxY})`);
            return null;
        }
        
        return { minX: clampedMinX, maxX: clampedMaxX, minY: clampedMinY, maxY: clampedMaxY };
    };
    
    // FASE 1: Botón inicial "PRINT MODEL"
    const printBtnIndices = clampIndices(
        containerPanel.minCellIndex.x + offsetX,
        containerPanel.minCellIndex.x + offsetX + buttonWidth,
        containerPanel.minCellIndex.y + 3,
        containerPanel.minCellIndex.y + 3 + buttonHeight
    );
    
    if (!printBtnIndices) {
        if (output) {
            showError('No hay espacio suficiente en el grid para crear el botón PRINT MODEL', output);
        }
        return;
    }
    
    const printBtn = createPanelFromBoundingBox({
        minX: printBtnIndices.minX,
        maxX: printBtnIndices.maxX,
        minY: printBtnIndices.minY,
        maxY: printBtnIndices.maxY
    }, currentGridParams);
    
    printBtn.isTextContainer = true;
    printBtn.isPrintButton = true;
    printBtn.printButtonAction = () => {
        if (printBtn.group && printBtn.group.visible) {
            printBtn.group.visible = false;
            showConfirmationScreen();
        }
    };
    createPanelText(printBtn, currentGridParams.cellSize);
    setPanelText(printBtn, "PRINT NOW?", currentGridParams.cellSize);
    
    // FASE 2: Paneles de confirmación (YES/NO arriba, SAVE SETTINGS abajo)
    const continuePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth/2) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    continuePanel.isPrintContinueButton = true;
    continuePanel.printButtonAction = null;
    
    const cancelPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth/2) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    cancelPanel.isPrintCancelButton = true;
    cancelPanel.printButtonAction = null;
    
    const confirmTitlePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight
    }, currentGridParams);
    
    // FASE 3: Barra de porcentaje
    const percentBarPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing + 2
    }, currentGridParams);
    
    // Configurar textos
    const allTextPanels = [confirmTitlePanel, continuePanel, cancelPanel, printBtn];
    allTextPanels.forEach(panel => {
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
    });
    
    setPanelText(confirmTitlePanel, "SAVE SETTINGS", currentGridParams.cellSize);
    setPanelText(continuePanel, "YES", currentGridParams.cellSize);
    setPanelText(cancelPanel, "NO", currentGridParams.cellSize);
    
    // Ocultar todos menos el botón inicial
    const allPanelsExceptPrintBtn = [confirmTitlePanel, continuePanel, cancelPanel, percentBarPanel];
    allPanelsExceptPrintBtn.forEach(panel => {
        if (panel.group) panel.group.visible = false;
    });
    
    // Calcular altura total para centrar verticalmente
    const totalPrintHeight = buttonHeight + panelSpacing + buttonHeight + panelSpacing + buttonHeight + panelSpacing + 2;
    const containerHeightForCentering = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    const verticalOffset = Math.floor((containerHeightForCentering - totalPrintHeight) / 2);
    
    const adjustVerticalPosition = (panel) => {
        if (panel && panel.minCellIndex && panel.maxCellIndex) {
            const height = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
            const baseOffset = panel.minCellIndex.y - (containerPanel.minCellIndex.y + 3);
            const newMinY = containerPanel.minCellIndex.y + verticalOffset + baseOffset;
            panel.minCellIndex.y = newMinY;
            panel.maxCellIndex.y = newMinY + height - 1;
            if (panel.group) {
                updatePanelGeometryAndPosition(panel, currentGridParams);
            }
        }
    };
    
    adjustVerticalPosition(printBtn);
    adjustVerticalPosition(confirmTitlePanel);
    adjustVerticalPosition(continuePanel);
    adjustVerticalPosition(cancelPanel);
    adjustVerticalPosition(percentBarPanel);
    
    // Asegurar que los textos se actualicen después de ajustar posiciones
    setPanelText(printBtn, "PRINT NOW?", currentGridParams.cellSize);
    setPanelText(confirmTitlePanel, "SAVE SETTINGS", currentGridParams.cellSize);
    setPanelText(continuePanel, "YES", currentGridParams.cellSize);
    setPanelText(cancelPanel, "NO", currentGridParams.cellSize);
    
    // 🔥 CRITICAL: Añadir paneles a la escena correcta (HUD o principal)
    if (isContainerInHUD) {
        const hudScene = getHUDScene();
        if (hudScene) {
            [printBtn, continuePanel, cancelPanel, confirmTitlePanel, percentBarPanel].forEach(panel => {
                if (panel.group) {
                    // Remover de la escena principal si está ahí
                    if (scene.children.includes(panel.group)) {
                        scene.remove(panel.group);
                        const index = panels.indexOf(panel);
                        if (index > -1) {
                            panels.splice(index, 1);
                        }
                    }
                    // Añadir al HUD si no está ya ahí
                    if (!hudScene.children.includes(panel.group)) {
                        hudScene.add(panel.group);
                        addHUDPanel(panel);
                        panel.group.position.z = HUD_PLANE_Z;
                        panel.group.renderOrder = 200;
                        panel.group.traverse((child) => {
                            child.visible = true;
                            if (child.position) {
                                child.position.z = HUD_PLANE_Z;
                            }
                            if (child.renderOrder !== undefined) {
                                child.renderOrder = 200;
                            }
                        });
                    }
                }
            });
        }
    }
    
    // === FASE 1: BOTÓN IMPRIMIR ===
    let printBtnHover = false;
    let printBtnLastClickTime = 0;
    const DOUBLE_CLICK_DELAY = 300;
    
    function handleHoverPrintBtn(event) {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const printBtnMeshes = [];
        if (printBtn.fillMesh) printBtnMeshes.push(printBtn.fillMesh);
        printBtn.borderLines.forEach(line => printBtnMeshes.push(line));
        
        const intersects = raycaster.intersectObjects(printBtnMeshes);
        
        const wasHovering = printBtnHover;
        printBtnHover = intersects.length > 0;
        
        if (wasHovering !== printBtnHover) {
            printBtn.selected = printBtnHover;
            updatePanelColor(printBtn);
        }
    }
    
    function handleClickPrintBtn() {
        if (!printBtnHover) return;
        
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - printBtnLastClickTime;
        
        if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
            document.removeEventListener('mousemove', handleHoverPrintBtn);
            document.removeEventListener('click', handleClickPrintBtn);
            printBtn.group.visible = false;
            showConfirmationScreen();
            printBtnLastClickTime = 0;
        } else {
            printBtnLastClickTime = currentTime;
        }
    }
    
    document.addEventListener('mousemove', handleHoverPrintBtn);
    document.addEventListener('click', handleClickPrintBtn);
    
    // === FASE 2: PANTALLA DE CONFIRMACIÓN ===
    let hideConfirmationScreen = null;
    
    function showConfirmationScreen() {
        confirmTitlePanel.group.visible = true;
        continuePanel.group.visible = true;
        cancelPanel.group.visible = true;
        
        let continueHover = false;
        let cancelHover = false;
        let continueLastClickTime = 0;
        let cancelLastClickTime = 0;
        
        function handleConfirmationHover(event) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const continueMeshes = [];
            if (continuePanel.fillMesh) continueMeshes.push(continuePanel.fillMesh);
            continuePanel.borderLines.forEach(line => continueMeshes.push(line));
            
            const cancelMeshes = [];
            if (cancelPanel.fillMesh) cancelMeshes.push(cancelPanel.fillMesh);
            cancelPanel.borderLines.forEach(line => cancelMeshes.push(line));
            
            const continueIntersects = raycaster.intersectObjects(continueMeshes);
            const cancelIntersects = raycaster.intersectObjects(cancelMeshes);
            
            const wasContinueHover = continueHover;
            const wasCancelHover = cancelHover;
            
            continueHover = continueIntersects.length > 0;
            cancelHover = cancelIntersects.length > 0;
            
            if (wasContinueHover !== continueHover) {
                continuePanel.selected = continueHover;
                updatePanelColor(continuePanel);
            }
            
            if (wasCancelHover !== cancelHover) {
                cancelPanel.selected = cancelHover;
                updatePanelColor(cancelPanel);
            }
        }
        
        function handleConfirmationClick() {
            const currentTime = Date.now();
            
            if (continueHover) {
                const timeSinceLastClick = currentTime - continueLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    hideConfirmationScreen();
                    showPercentScreen();
                    continueLastClickTime = 0;
                } else {
                    continueLastClickTime = currentTime;
                }
            } else if (cancelHover) {
                const timeSinceLastClick = currentTime - cancelLastClickTime;
                if (timeSinceLastClick < DOUBLE_CLICK_DELAY) {
                    hideConfirmationScreen();
                    printBtn.group.visible = true;
                    document.addEventListener('mousemove', handleHoverPrintBtn);
                    document.addEventListener('click', handleClickPrintBtn);
                    cancelLastClickTime = 0;
                } else {
                    cancelLastClickTime = currentTime;
                }
            }
        }
        
        hideConfirmationScreen = function() {
            document.removeEventListener('mousemove', handleConfirmationHover);
            document.removeEventListener('click', handleConfirmationClick);
            confirmTitlePanel.group.visible = false;
            continuePanel.group.visible = false;
            cancelPanel.group.visible = false;
        };
        
        document.addEventListener('mousemove', handleConfirmationHover);
        document.addEventListener('click', handleConfirmationClick);
        
        function handleConfirmationKeyboard(event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'y' || event.key === 'Y') {
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                showPercentScreen();
            } else if (event.key === 'Escape' || event.key === 'n' || event.key === 'N') {
                document.removeEventListener('keydown', handleConfirmationKeyboard);
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        }
        
        document.addEventListener('keydown', handleConfirmationKeyboard);
        
        continuePanel.printButtonAction = () => {
            if (continuePanel.group && continuePanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                showPercentScreen();
            }
        };
        
        cancelPanel.printButtonAction = () => {
            if (cancelPanel.group && cancelPanel.group.visible && hideConfirmationScreen) {
                hideConfirmationScreen();
                printBtn.group.visible = true;
                document.addEventListener('mousemove', handleHoverPrintBtn);
                document.addEventListener('click', handleClickPrintBtn);
            }
        };
    }
    
    // === FASE 3: PANTALLA DE PORCENTAJE ===
    function showPercentScreen() {
        isPrintingActive = true;
        percentBarPanel.group.visible = true;
        
        import("./bioLoad.js").then(bioLoadModule => {
            const percentCanvas = document.createElement('canvas');
            percentCanvas.width = 1024;
            percentCanvas.height = 128; // Altura para la barra de 2 unidades
            
            percentBarPanel.progressCanvas = percentCanvas;
            percentBarPanel.progressCtx = percentCanvas.getContext('2d');
            percentBarPanel.progressTexture = new THREE.CanvasTexture(percentCanvas);
            percentBarPanel.percentProgress = 0;
            percentBarPanel.percentComplete = false;
            
            const percentNormalMaterial = new THREE.MeshBasicMaterial({
                map: percentBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            const percentHoverMaterial = new THREE.MeshBasicMaterial({
                map: percentBarPanel.progressTexture,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            
            const percentSelectedMaterial = new THREE.MeshBasicMaterial({
                map: percentBarPanel.progressTexture,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            
            percentBarPanel.hasTexture = true;
            percentBarPanel.textureMaterials = {
                normal: percentNormalMaterial,
                hover: percentHoverMaterial,
                selected: percentSelectedMaterial
            };
            
            if (percentBarPanel.fillMesh) {
                percentBarPanel.fillMesh.material.dispose();
                percentBarPanel.fillMesh.material = percentNormalMaterial;
            }
            
            // Función para actualizar la barra con porcentaje
            percentBarPanel.drawPercentProgress = function(progress) {
                if (!percentBarPanel.progressCtx || !percentBarPanel.progressTexture) return;
                
                // Dibujar la barra de progreso
                bioLoadModule.updateProgressBar(
                    percentBarPanel.progressCtx,
                    percentBarPanel.progressCanvas.width,
                    percentBarPanel.progressCanvas.height,
                    progress,
                    0.3 // Pulso suave
                );
                
                // Dibujar el texto con porcentaje (ej: "45%")
                const ctx = percentBarPanel.progressCtx;
                const percentValue = Math.floor(progress);
                const text = percentBarPanel.percentComplete ? "100% COMPLETE" : `${percentValue}%`;
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                const fontSize = Math.floor(percentBarPanel.progressCanvas.height * 0.25);
                ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    text,
                    percentBarPanel.progressCanvas.width / 2,
                    percentBarPanel.progressCanvas.height / 2
                );
                
                percentBarPanel.progressTexture.needsUpdate = true;
                Object.values(percentBarPanel.textureMaterials).forEach(material => {
                    if (material && material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
            
            // Iniciar animación con duración personalizada en milisegundos
            const percentStartTime = Date.now();
            
            function animatePercent() {
                if (percentBarPanel.percentComplete) return;
                
                const currentTime = Date.now();
                const elapsed = currentTime - percentStartTime;
                const progress = Math.min(100, (elapsed / durationMs) * 100);
                
                percentBarPanel.percentProgress = progress;
                
                if (percentBarPanel.drawPercentProgress) {
                    percentBarPanel.drawPercentProgress(progress);
                }
                
                if (progress < 100) {
                    requestAnimationFrame(animatePercent);
                } else {
                    // Completado - mantener llena y cambiar texto
                    percentBarPanel.percentComplete = true;
                    // Actualizar la barra para mostrar el nuevo texto
                    if (percentBarPanel.drawPercentProgress) {
                        percentBarPanel.drawPercentProgress(100);
                    }
                    
                    // Volver al botón original después de un tiempo
                    setTimeout(() => {
                        percentBarPanel.group.visible = false;
                        printBtn.group.visible = true;
                        isPrintingActive = false;
                        document.addEventListener('mousemove', handleHoverPrintBtn);
                        document.addEventListener('click', handleClickPrintBtn);
                    }, 2000);
                }
            }
            
            animatePercent();
        }).catch(err => console.error("Error al cargar bioLoad.js:", err));
    }
}

// Función para comando de modelación de datos de usuario
async function handleModelingCommand(output, providedContainerPanel = null) {
    let containerPanel = providedContainerPanel;
    
    // Si no se proporciona un panel, buscar uno seleccionado
    if (!containerPanel) {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length === 0) {
            showError("Debes seleccionar un panel para usar como contenedor.", output);
            return;
        }
        containerPanel = selectedPanels[0];
    }
    
    const currentGridParams = getCurrentGridParams();
    
    // Verificar que el contenedor sea lo suficientemente grande
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    if (containerWidth < 15 || containerHeight < 9) {
        showError(`El panel debe ser al menos de 15x9 celdas (actual: ${containerWidth}x${containerHeight})`, output);
        return;
    }
    
    // Si se proporciona un panel (desde carga de slot), ejecutar el comando inmediatamente
    if (providedContainerPanel) {
        // Ejecutar el comando modeling normalmente
        await executeModelingCommand(containerPanel, output);
        return;
    }
    
    // Si NO se proporciona un panel (comando desde terminal), almacenar el comando en el panel
    // El panel conserva su apariencia y no se activa hasta que un slot lo cargue
    containerPanel.pendingModelingCommand = true;
    showInfo(`Comando modeling almacenado en panel #${containerPanel.orderNumber}. Se activará al cargar desde un slot.`, output);
    
    // NO eliminar el panel, NO crear la interfaz, solo almacenar el comando
    return;
}

// Función separada para ejecutar el comando modeling (llamada desde carga de slot)
async function executeModelingCommand(containerPanel, output) {
    // IMPORTANTE: Detectar si el panel contenedor está en el HUD y usar los parámetros correctos
    const isContainerInHUD = containerPanel.group && containerPanel.group.parent && 
                             containerPanel.group.parent.userData && containerPanel.group.parent.userData.isHUD;
    const currentGridParams = isContainerInHUD ? getHUDGridParams() : getCurrentGridParams();
    
    if (!currentGridParams) {
        if (output) {
            showError('No se pudieron obtener los parámetros del grid', output);
        }
        return;
    }
    
    // Obtener límites del grid para validar índices
    const gridCellsX = currentGridParams.cellsX;
    const gridCellsY = currentGridParams.cellsY;
    
    // Eliminar el panel contenedor original inmediatamente
    if (containerPanel.group) {
        scene.remove(containerPanel.group);
        const index = panels.indexOf(containerPanel);
        if (index > -1) {
            panels.splice(index, 1);
        }
        if (output) {
            showInfo('Panel contenedor eliminado', output);
        }
    }
    
    // Verificar que el contenedor sea lo suficientemente grande
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    if (containerWidth < 15 || containerHeight < 9) {
        if (output) {
            showError(`El panel debe ser al menos de 15x9 celdas (actual: ${containerWidth}x${containerHeight})`, output);
        }
        return;
    }
    
    // Crear una interfaz con múltiples paneles
    if (output) {
        showInfo('Creando interfaz de modelación...', output);
    }
    
    // Definir tamaños para todos los paneles
    const buttonHeight = 2;
    const loadingBarHeight = 1;
    const panelSpacing = 1;
    const buttonWidth = containerWidth - 4;
    const offsetX = 2;
    
    // Panel título "MODELING USER PREFERENCES" (altura: 2 unidades)
    const modelingTitlePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight
    }, currentGridParams);
    modelingTitlePanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Panel para la barra de progreso cíclica
    const cyclicBarPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1
    }, currentGridParams);
    cyclicBarPanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Panel para la barra de progreso principal
    const progressBarPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight
    }, currentGridParams);
    progressBarPanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Importamos la funcionalidad de bioLoad.js para la barra de progreso
    import("./bioLoad.js").then(bioLoadModule => {
        progressBarPanel.drawProgress = function(progress) {
            if (!progressBarPanel.progressTexture) {
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 64;
                
                progressBarPanel.progressCanvas = canvas;
                progressBarPanel.progressCtx = canvas.getContext('2d');
                progressBarPanel.progressTexture = new THREE.CanvasTexture(canvas);
                
                const progressMaterial = new THREE.MeshBasicMaterial({
                    map: progressBarPanel.progressTexture,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                
                if (progressBarPanel.fillMesh) {
                    progressBarPanel.fillMesh.material.dispose();
                    progressBarPanel.fillMesh.material = progressMaterial;
                }
            }
            
            bioLoadModule.updateProgressBar(
                progressBarPanel.progressCtx, 
                progressBarPanel.progressCanvas.width, 
                progressBarPanel.progressCanvas.height, 
                progress
            );
            
            progressBarPanel.progressTexture.needsUpdate = true;
        };
    }).catch(err => console.error("Error al cargar bioLoad.js:", err));
    
    // Panel para el porcentaje (2 unidades de altura - solo el número será más grande)
    const percentagePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth/3) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing + 2
    }, currentGridParams);
    percentagePanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Panel para el tiempo restante (2 unidades de altura)
    const remainingTimePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth/3) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + Math.floor(containerWidth*2/3) - panelSpacing/2,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing + 2
    }, currentGridParams);
    remainingTimePanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Panel para el tiempo total (2 unidades de altura)
    const totalTimePanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + Math.floor(containerWidth*2/3) + panelSpacing/2,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing + 2
    }, currentGridParams);
    totalTimePanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Panel para "MODELING USER DATA" (2 unidades de altura)
    const modelPanel = createPanelFromBoundingBox({
        minX: containerPanel.minCellIndex.x + offsetX,
        maxX: containerPanel.minCellIndex.x + offsetX + buttonWidth,
        minY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing + 2 + panelSpacing,
        maxY: containerPanel.minCellIndex.y + 3 + buttonHeight + panelSpacing + 1 + panelSpacing + loadingBarHeight + panelSpacing + 2 + panelSpacing + 2
    }, currentGridParams);
    modelPanel.isModelingPanel = true; // Marcar como panel de modeling
    
    // Configurar textos para todos los paneles
    const allTextPanels = [
        modelingTitlePanel, percentagePanel, remainingTimePanel, totalTimePanel, modelPanel
    ];
    
    allTextPanels.forEach(panel => {
        panel.isTextContainer = true;
        createPanelText(panel, currentGridParams.cellSize);
    });
    
    // Asignar textos iniciales
    setPanelText(modelingTitlePanel, "MODELING USER PREFERENCES", currentGridParams.cellSize);
    setPanelText(percentagePanel, "0%", currentGridParams.cellSize);
    setPanelText(remainingTimePanel, "35s", currentGridParams.cellSize);
    setPanelText(totalTimePanel, "ESTIMATED", currentGridParams.cellSize);
    setPanelText(modelPanel, "MODELING USER DATA", currentGridParams.cellSize);
    
    // Configurar tamaño de fuente doble para el porcentaje desde el inicio
    const percentageState = panelTextState.get(percentagePanel);
    if (percentageState) {
        percentageState.customFontSize = 3.6; // Doble de 1.8
        createPanelText(percentagePanel, currentGridParams.cellSize); // Recrear con el nuevo tamaño
    }
    
    // Mensajes de modelación de datos
    const MODELING_MESSAGES = [
        "Modeling user preferences",
        "Creating embeddings",
        "Scraping user interactions",
        "Analyzing behavioral patterns",
        "Extracting feature vectors",
        "Building user profile",
        "Processing click streams",
        "Mapping user journey",
        "Identifying preferences",
        "Generating recommendations",
        "Training ML models",
        "Optimizing algorithms",
        "Calculating similarity scores",
        "Clustering user segments",
        "Validating data integrity",
        "Normalizing datasets",
        "Feature engineering",
        "Dimensionality reduction",
        "Cross-validation",
        "Hyperparameter tuning",
        "Model evaluation",
        "A/B testing",
        "Performance metrics",
        "Real-time inference",
        "Data pipeline optimization",
        "Cache warming",
        "Index building",
        "Query optimization",
        "Database sharding",
        "Load balancing",
        "API rate limiting",
        "Session management",
        "Token generation",
        "Authentication flow",
        "Authorization checks",
        "Data encryption",
        "Privacy compliance",
        "GDPR validation",
        "Consent management",
        "Data anonymization",
        "Audit logging",
        "Monitoring metrics",
        "Error tracking",
        "Performance profiling",
        "Resource allocation",
        "Scaling infrastructure",
        "Deployment pipeline",
        "Version control",
        "Rollback preparation",
        "Finalizing model"
    ];
    
    // Ocultar todos los paneles inicialmente
    const allPanels = [
        modelingTitlePanel, cyclicBarPanel, progressBarPanel, percentagePanel, 
        remainingTimePanel, totalTimePanel, modelPanel
    ];
    
    allPanels.forEach(panel => {
        if (panel.group) panel.group.visible = false;
    });
    
    // Saltar directamente a la pantalla de modelación (sin confirmación)
    showModelingScreen();
    
    // === PANTALLA DE FINALIZACIÓN ===
    function showCompletionScreen() {
        const gridParams = getCurrentGridParams();
        const { cellSize, cellsX, cellsY } = gridParams;
        
        // Calcular centro del grid en índices de celdas
        const centerX = Math.floor(cellsX / 2);
        const centerY = Math.floor(cellsY / 2);
        
        // Panel de mensaje de éxito (centrado, ancho: 20 celdas, alto: 3 celdas)
        const messagePanel = createPanelFromBoundingBox({
            minX: centerX - 10,
            maxX: centerX + 10,
            minY: centerY + 1,
            maxY: centerY + 4
        }, currentGridParams);
        
        messagePanel.isTextContainer = true;
        createPanelText(messagePanel, currentGridParams.cellSize);
        setPanelText(messagePanel, "User Model Synthesized correctly", currentGridParams.cellSize);
        
        // Panel botón "Continue" (centrado, ancho: 12 celdas, alto: 2 celdas)
        const continueButton = createPanelFromBoundingBox({
            minX: centerX - 6,
            maxX: centerX + 6,
            minY: centerY - 3,
            maxY: centerY - 1
        }, currentGridParams);
        
        continueButton.isTextContainer = true;
        createPanelText(continueButton, currentGridParams.cellSize);
        setPanelText(continueButton, "Continue", currentGridParams.cellSize);
        
        // Centrar texto en ambos paneles
        const messageState = panelTextState.get(messagePanel);
        const continueState = panelTextState.get(continueButton);
        if (messageState) messageState.textAlign = 'center';
        if (continueState) continueState.textAlign = 'center';
        
        // Agregar paneles a la escena
        panels.push(messagePanel, continueButton);
        updatePanelGeometryAndPosition(messagePanel, currentGridParams);
        updatePanelGeometryAndPosition(continueButton, currentGridParams);
        scene.add(messagePanel.group);
        scene.add(continueButton.group);
        
        // Variables para control de hover del botón
        let continueHover = false;
        
        // Función para manejar hover y click en el botón Continue
        function handleContinueInteraction(event) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const continueMeshes = [];
            if (continueButton.fillMesh) continueMeshes.push(continueButton.fillMesh);
            continueButton.borderLines.forEach(line => continueMeshes.push(line));
            
            const continueIntersects = raycaster.intersectObjects(continueMeshes);
            
            const wasContinueHover = continueHover;
            continueHover = continueIntersects.length > 0;
            
            if (wasContinueHover !== continueHover) {
                continueButton.selected = continueHover;
                updatePanelColor(continueButton);
            }
        }
        
        function handleContinueClick() {
            if (!continueHover) return;
            
            // Limpiar listeners
            document.removeEventListener('mousemove', handleContinueInteraction);
            document.removeEventListener('click', handleContinueClick);
            
            // Eliminar paneles de finalización
            if (messagePanel.group) {
                scene.remove(messagePanel.group);
                const index = panels.indexOf(messagePanel);
                if (index > -1) panels.splice(index, 1);
            }
            
            if (continueButton.group) {
                scene.remove(continueButton.group);
                const index = panels.indexOf(continueButton);
                if (index > -1) panels.splice(index, 1);
            }
            
            // Limpiar recursos
            if (messagePanel.fillMesh && messagePanel.fillMesh.material) {
                messagePanel.fillMesh.material.dispose();
                if (messagePanel.fillMesh.material.map) {
                    messagePanel.fillMesh.material.map.dispose();
                }
            }
            if (messagePanel.fillMesh && messagePanel.fillMesh.geometry) {
                messagePanel.fillMesh.geometry.dispose();
            }
            
            if (continueButton.fillMesh && continueButton.fillMesh.material) {
                continueButton.fillMesh.material.dispose();
                if (continueButton.fillMesh.material.map) {
                    continueButton.fillMesh.material.map.dispose();
                }
            }
            if (continueButton.fillMesh && continueButton.fillMesh.geometry) {
                continueButton.fillMesh.geometry.dispose();
            }
        }
        
        // Activar listeners para el botón Continue
        document.addEventListener('mousemove', handleContinueInteraction);
        document.addEventListener('click', handleContinueClick);
        
        // También permitir uso del teclado (Enter o Espacio)
        function handleCompletionKeyboard(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                document.removeEventListener('keydown', handleCompletionKeyboard);
                handleContinueClick();
            }
        }
        
        document.addEventListener('keydown', handleCompletionKeyboard);
    }
    
    // === PANTALLA DE MODELACIÓN ===
    function showModelingScreen() {
        isPrintingActive = true;
        
        // Mostrar paneles de modelación
        modelingTitlePanel.group.visible = true;
        cyclicBarPanel.group.visible = true;
        progressBarPanel.group.visible = true;
        percentagePanel.group.visible = true;
        remainingTimePanel.group.visible = true;
        totalTimePanel.group.visible = true;
        modelPanel.group.visible = true;
        
        // Configurar panel de progreso como barra usando bioLoad.js
        import("./bioLoad.js").then(bioLoadModule => {
            // Crear la barra de progreso principal con bioLoad
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 64;
            
            progressBarPanel.progressCanvas = canvas;
            progressBarPanel.progressCtx = canvas.getContext('2d');
            progressBarPanel.progressTexture = new THREE.CanvasTexture(canvas);
            
            const progressNormalMaterial = new THREE.MeshBasicMaterial({
                map: progressBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            progressBarPanel.hasTexture = true;
            progressBarPanel.textureMaterials = {
                normal: progressNormalMaterial,
                hover: progressNormalMaterial,
                selected: progressNormalMaterial
            };
            
            if (progressBarPanel.fillMesh) {
                progressBarPanel.fillMesh.material.dispose();
                progressBarPanel.fillMesh.material = progressNormalMaterial;
            }
            
            progressBarPanel.drawProgress = function(progress, pulse = 0) {
                bioLoadModule.updateProgressBar(
                    progressBarPanel.progressCtx,
                    progressBarPanel.progressCanvas.width,
                    progressBarPanel.progressCanvas.height,
                    progress,
                    pulse
                );
                
                progressBarPanel.progressTexture.needsUpdate = true;
                
                Object.values(progressBarPanel.textureMaterials).forEach(material => {
                    if (material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
            
            // Crear la barra de progreso cíclica
            const cyclicCanvas = document.createElement('canvas');
            cyclicCanvas.width = 1024;
            cyclicCanvas.height = 32;
            
            cyclicBarPanel.progressCanvas = cyclicCanvas;
            cyclicBarPanel.progressCtx = cyclicCanvas.getContext('2d');
            cyclicBarPanel.progressTexture = new THREE.CanvasTexture(cyclicCanvas);
            cyclicBarPanel.cycleProgress = 0;
            cyclicBarPanel.cycleSpeed = Math.random() * 1.5 + 0.5;
            cyclicBarPanel.cycleCount = 0;
            
            const cyclicNormalMaterial = new THREE.MeshBasicMaterial({
                map: cyclicBarPanel.progressTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            
            cyclicBarPanel.hasTexture = true;
            cyclicBarPanel.textureMaterials = {
                normal: cyclicNormalMaterial,
                hover: cyclicNormalMaterial,
                selected: cyclicNormalMaterial
            };
            
            if (cyclicBarPanel.fillMesh) {
                cyclicBarPanel.fillMesh.material.dispose();
                cyclicBarPanel.fillMesh.material = cyclicNormalMaterial;
            }
            
            let lastCycleCount = 0;
            
            cyclicBarPanel.updateCyclicBar = function() {
                cyclicBarPanel.cycleProgress += cyclicBarPanel.cycleSpeed;
                
                if (cyclicBarPanel.cycleProgress > 100) {
                    cyclicBarPanel.cycleProgress = 0;
                    cyclicBarPanel.cycleCount++;
                    cyclicBarPanel.cycleSpeed = Math.random() * 2.0 + 0.5;
                    
                    // Cambiar mensaje cuando se complete un ciclo
                    if (cyclicBarPanel.cycleCount > lastCycleCount) {
                        lastCycleCount = cyclicBarPanel.cycleCount;
                        const messageIndex = Math.min(cyclicBarPanel.cycleCount - 1, MODELING_MESSAGES.length - 1);
                        if (messageIndex >= 0 && messageIndex < MODELING_MESSAGES.length) {
                            setPanelText(modelingTitlePanel, MODELING_MESSAGES[messageIndex], currentGridParams.cellSize);
                        }
                    }
                }
                
                bioLoadModule.updateProgressBar(
                    cyclicBarPanel.progressCtx,
                    cyclicBarPanel.progressCanvas.width,
                    cyclicBarPanel.progressCanvas.height,
                    cyclicBarPanel.cycleProgress,
                    0.5
                );
                
                cyclicBarPanel.progressTexture.needsUpdate = true;
                
                Object.values(cyclicBarPanel.textureMaterials).forEach(material => {
                    if (material.map) {
                        material.map.needsUpdate = true;
                    }
                });
            };
        }).catch(err => console.error("Error al cargar bioLoad.js:", err));
        
        let isRunning = true;
        
        const totalModelingTimeSeconds = 35; // Duración total: 35 segundos
        
        function handleModelingEscape(event) {
            if (event.key === 'Escape') {
                isRunning = false;
                isPrintingActive = false;
                document.removeEventListener('keydown', handleModelingEscape);
                
                setPanelText(modelingTitlePanel, "Proceso interrumpido", currentGridParams.cellSize);
                
                cyclicBarPanel.group.visible = false;
                progressBarPanel.group.visible = false;
                percentagePanel.group.visible = false;
                remainingTimePanel.group.visible = false;
                totalTimePanel.group.visible = false;
                modelPanel.group.visible = false;
            }
        }
        
        document.addEventListener('keydown', handleModelingEscape);
        
        function updateModelingProgress() {
            if (!isRunning) return;
            
            const startTime = Date.now();
            const duration = totalModelingTimeSeconds * 1000; // Duración en milisegundos (35 segundos)
            
            function animate() {
                if (!isRunning) return;
                
                const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(100, (elapsed / duration) * 100);
                
                if (progress < 100) {
                    requestAnimationFrame(animate);
                }
                
                if (isPrintingActive) {
                    cyclicBarPanel.group.visible = true;
                    progressBarPanel.group.visible = true;
                    percentagePanel.group.visible = true;
                    remainingTimePanel.group.visible = true;
                    totalTimePanel.group.visible = true;
                    modelPanel.group.visible = true;
                }
                
                const pulse = Math.sin(currentTime / 500) * 0.2;
                if (progressBarPanel.drawProgress) {
                    progressBarPanel.drawProgress(progress, pulse);
                }
                
                if (cyclicBarPanel.updateCyclicBar) {
                    cyclicBarPanel.updateCyclicBar();
                }
                
                // Calcular tiempo restante en segundos
                const remainingMs = duration - elapsed;
                const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
                
                // Formatear tiempo restante como segundos
                const timeDisplay = `${remainingSeconds}s`;
                
                // Actualizar paneles de información con tamaño doble para porcentaje
                const percentageText = `${Math.floor(progress)}%`;
                
                // Asegurar que el customFontSize esté establecido antes de actualizar
                const percentageState = panelTextState.get(percentagePanel);
                if (percentageState) {
                    percentageState.customFontSize = 3.6; // Doble de 1.8
                }
                
                setPanelText(percentagePanel, percentageText, currentGridParams.cellSize);
                
                setPanelText(remainingTimePanel, timeDisplay, currentGridParams.cellSize);
                setPanelText(totalTimePanel, `ESTIMATED`, currentGridParams.cellSize);
                
                if (progress >= 100) {
                    isRunning = false;
                    isPrintingActive = false;
                    
                    // Ocultar todos los paneles de progreso
                    cyclicBarPanel.group.visible = false;
                    progressBarPanel.group.visible = false;
                    percentagePanel.group.visible = false;
                    remainingTimePanel.group.visible = false;
                    totalTimePanel.group.visible = false;
                    modelPanel.group.visible = false;
                    modelingTitlePanel.group.visible = false;
                    
                    document.removeEventListener('keydown', handleModelingEscape);
                    
                    // Solo cambiar el texto, no mostrar pantalla de finalización
                    setPanelText(modelingTitlePanel, "User Modeling Completed", currentGridParams.cellSize);
                }
            }
            
            animate();
        }
        
        updateModelingProgress();
    }
}

// Función para iniciar y mostrar el proceso de impresión
function startPrintingProcess(printingPanel, progressBarPanel, timeInfoPanel, output, currentGridParams) {
    // Ocultar paneles de confirmación
    document.querySelectorAll('[id^="panel-confirmation"]').forEach(el => el.style.display = 'none');
    
    // Mostrar los paneles de impresión
    printingPanel.group.visible = true;
    progressBarPanel.group.visible = true;
    timeInfoPanel.group.visible = true;
    
    // Actualizar textos
    setPanelText(printingPanel, "IMPRIMIENDO", currentGridParams.cellSize);
    
    // Configurar panel de progreso como barra usando bioLoad.js
    import("./bioLoad.js").then(bioLoadModule => {
        // Crear la barra de progreso con bioLoad
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 64;
        
        progressBarPanel.progressCanvas = canvas;
        progressBarPanel.progressCtx = canvas.getContext('2d');
        progressBarPanel.progressTexture = new THREE.CanvasTexture(canvas);
        
        // Crear material con la textura
        const progressMaterial = new THREE.MeshBasicMaterial({
            map: progressBarPanel.progressTexture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        // Aplicar el material al panel
        if (progressBarPanel.fillMesh) {
            progressBarPanel.fillMesh.material.dispose();
            progressBarPanel.fillMesh.material = progressMaterial;
        }
        
        // Definir la función drawProgress en el panel
        progressBarPanel.drawProgress = function(progress, pulse = 0) {
            bioLoadModule.updateProgressBar(
                progressBarPanel.progressCtx, 
                progressBarPanel.progressCanvas.width, 
                progressBarPanel.progressCanvas.height, 
                progress,
                pulse
            );
            progressBarPanel.progressTexture.needsUpdate = true;
        };
    }).catch(err => console.error("Error al cargar bioLoad.js:", err));
    
    let isRunning = true;
    
    // Tiempo total de impresión en minutos (40 minutos para la demostración, pero simulando 65 horas)
    const totalPrintTimeMinutes = 40;
    const totalPrintHours = 65;
    
    // Función para manejar la tecla Escape
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            isRunning = false;
            setPanelText(printingPanel, "Proceso de impresión interrumpido", currentGridParams.cellSize);
            document.removeEventListener('keydown', handleEscape);
            
            // Ocultar barra de progreso
            progressBarPanel.group.visible = false;
            timeInfoPanel.group.visible = false;
            
            // Eliminar todos los paneles después de un tiempo
            setTimeout(() => {
                const panelsToRemove = [printingPanel, progressBarPanel, timeInfoPanel];
                panelsToRemove.forEach(panel => {
                    if (panel.group) {
                        scene.remove(panel.group);
                        const index = panels.indexOf(panel);
                        if (index > -1) {
                            panels.splice(index, 1);
                        }
                    }
                });
            }, 2000);
        }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    // Función para actualizar el progreso
    function updatePrintProgress() {
        if (!isRunning) return;
        
        const startTime = Date.now();
        const duration = totalPrintTimeMinutes * 60 * 1000; // Duración en milisegundos
        
        function animate() {
            if (!isRunning) return;
            
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(100, (elapsed / duration) * 100);
            
            // Actualizar barra de progreso
            const pulse = Math.sin(currentTime / 500) * 0.2;
            if (progressBarPanel.drawProgress) {
                progressBarPanel.drawProgress(progress, pulse);
            }
            
            // Calcular tiempo restante
            const remainingMs = duration - elapsed;
            const remainingHours = remainingMs > 0 ? Math.ceil((remainingMs / duration) * totalPrintHours) : 0;
            
            // Actualizar mensaje de tiempo
            setPanelText(timeInfoPanel, 
                `${Math.floor(progress)}% completado\n` +
                `Tiempo restante: ${remainingHours} horas aprox.\n` +
                `Tiempo total: ${totalPrintHours} horas aprox.`, 
                currentGridParams.cellSize
            );
            
            if (progress < 100) {
                requestAnimationFrame(animate);
            } else {
                // Impresión completada
                setPanelText(printingPanel, "Impresión completada con éxito", currentGridParams.cellSize);
                // Ocultar otros paneles
                progressBarPanel.group.visible = false;
                timeInfoPanel.group.visible = false;
                
                document.removeEventListener('keydown', handleEscape);
                
                // Eliminar todos los paneles después de un tiempo
                setTimeout(() => {
                    const panelsToRemove = [printingPanel, progressBarPanel, timeInfoPanel];
                    panelsToRemove.forEach(panel => {
                        if (panel.group) {
                            scene.remove(panel.group);
                            const index = panels.indexOf(panel);
                            if (index > -1) {
                                panels.splice(index, 1);
                            }
                        }
                    });
                }, 3000);
            }
        }
        
        animate();
    }
    
    // Iniciar la actualización del progreso
    updatePrintProgress();
}

// 🔥 NUEVO: Función para obtener configuración serializable solo de paneles seleccionados
function getSelectedPanelsConfig() {
    try {
        const selectedPanels = panels.filter(p => p.selected && !p.isKeyboardKey);
        
        if (selectedPanels.length === 0) {
            console.warn('No hay paneles seleccionados para guardar.');
            return null;
        }
        
        const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) return null;
        
        const { width, height } = calculateGridSize();
        
        // Serializar solo los paneles seleccionados
        const serializedPanels = [];
        
        for (const panel of selectedPanels) {
            try {
                const textState = panelTextState.get(panel);
                const currentText = panel.hasText ? 
                    (textState && textState.isPassword ? textState.realText : getPanelText(panel)) : '';
                
                // Detectar y guardar información de texturas
                let textureInfo = null;
                if (panel.hasTexture && panel.fillMesh && panel.fillMesh.material && panel.fillMesh.material.map) {
                    const texture = panel.fillMesh.material.map;
                    const geometry = panel.fillMesh.geometry;
                    const uvAttribute = geometry.attributes.uv;
                    let customUVs = null;
                    
                    if (uvAttribute && uvAttribute.count > 0) {
                        const firstU = uvAttribute.getX(0);
                        const firstV = uvAttribute.getY(1);
                        if (firstU < 0 || firstU > 1 || firstV < 0 || firstV > 1 || 
                            (Math.abs(firstU - 0.5) > 0.1 && Math.abs(firstV - 0.5) > 0.1)) {
                            customUVs = [];
                            for (let i = 0; i < uvAttribute.count; i++) {
                                customUVs.push({
                                    u: uvAttribute.getX(i),
                                    v: uvAttribute.getY(i)
                                });
                            }
                        }
                    }
                    
                    const hasLogoActive = hasLogo(panel);
                    let textureType = panel.textureType || 'unknown';
                    let texturePath = panel.texturePath || null;
                    
                    if (hasLogoActive) {
                        textureType = 'logo';
                        texturePath = './public/img/bioprint_logo.png';
                    } else if (panel.textureType === 'app' || texturePath?.includes('apps.png')) {
                        textureType = 'app';
                        texturePath = texturePath || './img/apps.png';
                    }
                    
                    textureInfo = {
                        hasTexture: true,
                        textureType: textureType,
                        texturePath: texturePath,
                        customUVs: customUVs,
                        imageAspect: texture.image ? (texture.image.width / texture.image.height) : null,
                        hasLogoActive: hasLogoActive
                    };
                } else if (hasLogo(panel)) {
                    textureInfo = {
                        hasTexture: true,
                        textureType: 'logo',
                        texturePath: './public/img/bioprint_logo.png',
                        customUVs: null,
                        imageAspect: null,
                        hasLogoActive: true
                    };
                }
                
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
                    selected: true, // Mantener seleccionado
                    isModelingPanel: !!panel.isModelingPanel,
                    pendingModelingCommand: !!panel.pendingModelingCommand, // Guardar comando modeling pendiente
                    pendingPrintCommand: !!panel.pendingPrintCommand, // Guardar comando print pendiente
                    printCommandArgs: Array.isArray(panel.printCommandArgs) ? [...panel.printCommandArgs] : [], // Guardar argumentos del comando print
                    pendingPrintSimpleCommand: !!panel.pendingPrintSimpleCommand, // Guardar comando print simple pendiente
                    pendingPrintPercentCommand: !!panel.pendingPrintPercentCommand, // Guardar comando print percent pendiente
                    printPercentDuration: typeof panel.printPercentDuration === 'number' ? panel.printPercentDuration : undefined, // Guardar duración en milisegundos
                    navigateToSlot: typeof panel.navigateToSlot === 'number' ? panel.navigateToSlot : undefined, // Guardar navegación a slot
                    loadToHUDSlot: typeof panel.loadToHUDSlot === 'number' ? panel.loadToHUDSlot : undefined, // 🔥 NUEVO: Guardar trigger HUD
                    behavior: {
                        hasText: !!panel.hasText,
                        textContent: typeof currentText === 'string' ? currentText : '',
                        messageBuffer: Array.isArray(textState?.lines) ? [...textState.lines] : [],
                        maxLines: typeof textState?.maxCharsPerLine === 'number' ? textState.maxCharsPerLine : 0,
                        isPassword: !!textState?.isPassword,
                        textAlign: textState?.textAlign || 'center',
                        verticalAlign: textState?.verticalAlign || 'middle',
                        useWhiteScrollIndicators: !!textState?.useWhiteScrollIndicators,
                        isGATCActive: gatcIntervals.has(panel),
                        isSpeciesPanel: !!panel.speciesPanel,
                        speciesName: panel.speciesName || null,
                        modelData: panel.modelData ? {
                            modelUrl: typeof panel.modelData.url === 'string' ? panel.modelData.url : '',
                            modelName: typeof panel.modelData.name === 'string' ? panel.modelData.name : '',
                            isRotating: !!panel.modelData.isRotating,
                            rotationSpeed: typeof panel.modelData.rotationSpeed === 'number' ? panel.modelData.rotationSpeed : 0.005,
                            isModelButton: !!panel.modelData.isModelButton,
                            isFromModelsGrid: !!panel.modelData.isFromModelsGrid,
                            isModelDisplay: !!panel.modelData.isModelDisplay,
                            isFromModelCommand: !!panel.modelData.isFromModelCommand,
                            isViewer: !!panel.modelData.isViewer || !!panel.isViewer, // 🔥 NUEVO: Guardar tipo viewer (también desde panel.isViewer)
                            scientificName: typeof panel.modelData.scientificName === 'string' ? panel.modelData.scientificName : null
                        } : (panel.isViewer ? {
                            // 🔥 NUEVO: Si el panel es viewer pero no tiene modelData, guardar la identidad de viewer
                            modelUrl: '',
                            modelName: '',
                            isRotating: false,
                            rotationSpeed: 0.005,
                            isModelButton: false,
                            isFromModelsGrid: false,
                            isModelDisplay: false,
                            isFromModelCommand: false,
                            isViewer: true,
                            scientificName: null
                        } : null),
                        genomData: panel.genomData || null,
                        textureInfo: textureInfo,
                        isAgreeButton: !!panel.isAgreeButton,
                        termsPanelOrderNumber: panel.isAgreeButton && panel.termsPanel ? panel.termsPanel.orderNumber : null,
                        modalData: getModalBehaviorData(panel) // 🔥 NUEVO: Guardar información del modal
                    }
                };
                
                // Validar y sanear los datos
                if (isNaN(serializedPanel.minCellIndex.x)) serializedPanel.minCellIndex.x = 0;
                if (isNaN(serializedPanel.minCellIndex.y)) serializedPanel.minCellIndex.y = 0;
                if (isNaN(serializedPanel.maxCellIndex.x)) serializedPanel.maxCellIndex.x = 0;
                if (isNaN(serializedPanel.maxCellIndex.y)) serializedPanel.maxCellIndex.y = 0;
                
                serializedPanels.push(serializedPanel);
            } catch (error) {
                console.error("Error al serializar panel seleccionado:", error);
            }
        }
        
        return {
            type: 'selectedPanels', // Marcar como comportamiento conjunto
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
            date: new Date().toISOString(),
            appVersion: '1.1.0',
            panelCount: serializedPanels.length
        };
    } catch (error) {
        console.error("Error en getSelectedPanelsConfig:", error);
        return null;
    }
}

// 🔥 NUEVO: Función para guardar comportamiento conjunto (paneles seleccionados) en un slot
async function saveSelectedPanelsToSlot(slotIndex) {
    const config = getSelectedPanelsConfig();
    if (!config) {
        console.error('Error: No se pudo obtener la configuración de paneles seleccionados.');
        const slotEntry = document.querySelector(`.slot-entry[data-slot-index="${slotIndex}"] .slot-status`);
        if (slotEntry) {
            slotEntry.textContent = 'Error: Sin paneles seleccionados';
            slotEntry.title = 'Selecciona al menos un panel antes de guardar comportamiento conjunto.';
            setTimeout(() => {
                updateSlotsPanelUI();
            }, 2000);
        }
        return false;
    }
    
    console.log(`Guardando comportamiento conjunto en Slot ${slotIndex}. Paneles: ${config.panelCount}`);
    
    // Función para trigger flash
    const triggerFlash = () => {
    gridAnimationInProgress = true;
    gridAnimationStep = 2;
    gridAnimationProgress = 0;
    gridFlashCount = 0;
    };
    
    // Guardar usando el módulo bioSlots.js
    const success = bioSlotsSaveToSlot(slotIndex, config, updateSlotsPanelUI, triggerFlash);
    
    if (success) {
        slots = getSlots(); // Actualizar referencia local
    }
    
    return success;
}

// 🔥 NUEVO: Función auxiliar para restaurar el comportamiento de un panel desde datos guardados
async function restorePanelBehaviorFromData(panel, behaviorData, currentGridParams) {
    if (!panel || !behaviorData) return;
    
    const orderNumber = panel.orderNumber;
    
    // Restaurar panel de especie
    if (behaviorData.isSpeciesPanel) {
        panel.speciesPanel = true;
        panel.speciesName = behaviorData.speciesName || null;
    }
    
    // Restaurar texto
    if (behaviorData.hasText && behaviorData.textContent) {
        panel.hasText = true;
        const textState = {
            text: behaviorData.textContent,
            lines: behaviorData.messageBuffer || [],
            maxCharsPerLine: behaviorData.maxLines || TEXT_CONFIG.defaultMaxCharsPerLine,
            cursorPosition: 0,
            isEditing: false,
            scrollOffset: 0,
            isPassword: behaviorData.isPassword || false,
            realText: (behaviorData.isPassword && behaviorData.textContent) ? behaviorData.textContent : '',
            textAlign: behaviorData.textAlign || 'center',
            verticalAlign: behaviorData.verticalAlign || 'middle',
            useWhiteScrollIndicators: !!behaviorData.useWhiteScrollIndicators
        };
        panelTextState.set(panel, textState);
        createPanelText(panel, currentGridParams.cellSize);
        if (textState.isPassword) {
            setPanelText(panel, '*'.repeat(textState.realText.length), currentGridParams.cellSize);
        } else {
            setPanelText(panel, textState.text, currentGridParams.cellSize);
        }
    }
    
    // Restaurar GATC
    if (behaviorData.isGATCActive) {
        if (!panel.hasText) panel.hasText = true;
        if (!panelTextState.has(panel)) createPanelText(panel, currentGridParams.cellSize);
        handleGATCCommand({ appendChild: () => {}, innerHTML: '' }, panel);
    }
    
    // Restaurar modal (se maneja después de crear todos los paneles en loadSelectedPanelsFromSlot)
    // No restaurar aquí para evitar conflictos
    
    // Restaurar modelo
    if (behaviorData.modelData) {
        const { modelUrl, modelName, isRotating, rotationSpeed, isModelButton, isFromModelsGrid, isModelDisplay, isFromModelCommand, isViewer, scientificName } = behaviorData.modelData;
        
        // 🔥 NUEVO: Restaurar identidad de viewer incluso sin modelo cargado
        if (isViewer) {
            if (!panel.modelData) {
                panel.modelData = {};
            }
            panel.modelData.isViewer = true;
            panel.isViewer = true;
        }
        
        // Si hay URL de modelo, cargarlo
        if (modelUrl) {
            await loadModelToPanel(panel, modelUrl, currentGridParams.cellSize).then(() => {
                // 🔥 CRITICAL: Asegurar que modelData existe
                if (!panel.modelData) {
                    panel.modelData = {};
                }
                
                // 🔥 CRITICAL: Restaurar URL del modelo (necesario para interacción con viewer)
                panel.modelData.url = modelUrl;
                
                if (modelName) {
                    panel.modelData.name = modelName;
                    // 🔥 NUEVO: Si no hay scientificName guardado pero hay modelName, asignarlo desde el mapeo
                    if (!scientificName && modelName) {
                        panel.modelData.scientificName = modelScientificNames[modelName] || null;
                    }
                }
                if (scientificName) {
                    panel.modelData.scientificName = scientificName;
                }
                if (isModelButton) {
                    panel.modelData.isModelButton = true;
                    panel.modelData.isFromModelsGrid = !!isFromModelsGrid;
                } else if (isModelDisplay) {
                    panel.modelData.isModelDisplay = true;
                    panel.modelData.isFromModelCommand = !!isFromModelCommand;
                } else if (isViewer) {
                    // Asegurar que isViewer esté restaurado (ya se restauró arriba, pero por seguridad)
                    panel.modelData.isViewer = true;
                    panel.isViewer = true;
                }
                if (isRotating && !panel.modelData.isRotating) toggleModelRotation(panel);
                if (rotationSpeed) setModelRotationSpeed(panel, rotationSpeed);
            });
        }
    }
    
    // Restaurar genom
    if (behaviorData.genomData) {
        panel.genomData = behaviorData.genomData;
        // Recrear la visualización del genoma
        await loadGenomToPanel(panel, currentGridParams.cellSize);
    }
    
    // Restaurar codon
    if (behaviorData.codonData) {
        panel.codonData = behaviorData.codonData;
        await loadCodonToPanel(panel, currentGridParams.cellSize);
    }
    
    // Restaurar texturas
    if (behaviorData.textureInfo && behaviorData.textureInfo.hasTexture) {
        const textureInfo = behaviorData.textureInfo;
        const texturePath = textureInfo.texturePath || './public/img/bioprint_logo.png';
        loadTexture(texturePath, (texture) => {
            if (panel.fillMesh) {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                panel.textureMaterials = createPanelMaterials(texture);
                panel.fillMesh.material = panel.textureMaterials.normal;
                panel.hasTexture = true;
                panel.textureType = textureInfo.textureType || 'logo';
                panel.texturePath = texturePath;
                
                if (textureInfo.customUVs && textureInfo.customUVs.length > 0) {
                    const geometry = panel.fillMesh.geometry;
                    const uvAttribute = geometry.attributes.uv;
                    if (uvAttribute && uvAttribute.count === textureInfo.customUVs.length) {
                        for (let i = 0; i < textureInfo.customUVs.length; i++) {
                            uvAttribute.setXY(i, textureInfo.customUVs[i].u, textureInfo.customUVs[i].v);
                        }
                        uvAttribute.needsUpdate = true;
                    }
                }
                updatePanelColor(panel);
                if (textureInfo.hasLogoActive && textureInfo.textureType === 'logo') {
                    if (!logoMeshExists()) createLogo(scene);
                    toggleLogo(true, panel);
                }
            }
        }, (error) => {
            console.error(`Error al restaurar textura para panel P${orderNumber}:`, error);
        });
    } else if (behaviorData.textureInfo && behaviorData.textureInfo.hasLogoActive) {
        if (!logoMeshExists()) createLogo(scene);
        toggleLogo(true, panel);
    }
    
    // Restaurar botón I AGREE
    if (behaviorData.isAgreeButton && behaviorData.termsPanelOrderNumber) {
        panel.isAgreeButton = true;
        setTimeout(() => {
            const termsPanel = panels.find(p => p.orderNumber === behaviorData.termsPanelOrderNumber);
            if (termsPanel) {
                panel.termsPanel = termsPanel;
            }
        }, 100);
    }
}

// 🔥 NUEVO: Función para cargar comportamiento conjunto desde un slot (solo restaura los paneles guardados)
async function loadSelectedPanelsFromSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido.`);
        return false;
    }
    
    // Asegurar que slots esté actualizado
    slots = getSlots();
    // Asegurar que slots esté actualizado
    slots = getSlots();
    const slotDataString = slots[slotIndex];
    if (!slotDataString) {
        console.warn(`Slot ${slotIndex} está vacío.`);
        return false;
    }
    
    try {
        const config = JSON.parse(slotDataString);
        
        // Verificar que es un comportamiento conjunto
        if (config.type !== 'selectedPanels') {
            console.warn(`Slot ${slotIndex} no contiene un comportamiento conjunto. Es una configuración completa.`);
            console.log('Usando loadFromSlot() en su lugar...');
            return await loadFromSlot(slotIndex);
        }
        
        console.log(`Cargando comportamiento conjunto desde Slot ${slotIndex}: ${config.panelCount} paneles`);
        
        // NO limpiar toda la escena, solo restaurar los paneles guardados
        // Primero, eliminar paneles existentes que coincidan con las posiciones guardadas
        if (config.panels && Array.isArray(config.panels)) {
            for (const panelData of config.panels) {
                // Buscar paneles existentes en las mismas posiciones y eliminarlos
                const existingPanels = panels.filter(p => 
                    !p.isKeyboardKey &&
                    p.minCellIndex.x === panelData.minCellIndex.x &&
                    p.minCellIndex.y === panelData.minCellIndex.y &&
                    p.maxCellIndex.x === panelData.maxCellIndex.x &&
                    p.maxCellIndex.y === panelData.maxCellIndex.y
                );
                
                for (const existingPanel of existingPanels) {
                    removePanelFromScene(existingPanel);
                    const index = panels.indexOf(existingPanel);
                    if (index > -1) {
                        panels.splice(index, 1);
                    }
                }
            }
        }
        
        // Restaurar configuración de grid si es diferente
        if (config.grid && config.grid.divisions !== currentDivisions) {
            const newDivisions = config.grid.divisions;
            if (typeof newDivisions === 'number' && newDivisions >= 2 && newDivisions <= 50) {
                currentDivisions = newDivisions;
                updateGrid(currentDivisions);
            }
        }
        
        // Restaurar los paneles guardados
        const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) {
            console.error('No se pudo obtener la configuración del grid.');
            return false;
        }
        
        // Aplicar solo los paneles guardados (sin limpiar toda la escena)
        const restoredPanels = [];
        const modalsToRestore = []; // Recolectar modales para restaurar después
        
        // Primera pasada: crear todos los paneles y recolectar información de modales
        for (const panelData of config.panels) {
            try {
                const panel = createPanelFromBoundingBox({
                    minX: panelData.minCellIndex.x,
                    maxX: panelData.maxCellIndex.x,
                    minY: panelData.minCellIndex.y,
                    maxY: panelData.maxCellIndex.y
                }, currentGridParams);
                
                if (panel) {
                    // Restaurar propiedades del panel
                    panel.orderNumber = panelData.orderNumber || panel.orderNumber;
                    panel.showOrderNumber = panelData.showOrderNumber !== undefined ? panelData.showOrderNumber : true;
                    panel.selected = panelData.selected !== undefined ? panelData.selected : false;
                    panel.isModelingPanel = panelData.isModelingPanel || false;
                    
                    // Recolectar información de modales (no restaurar aún)
                    if (panelData.behavior && panelData.behavior.modalData && panelData.behavior.modalData.isModal) {
                        modalsToRestore.push({
                            panel: panel,
                            modalData: panelData.behavior.modalData
                        });
                    } else {
                        // Restaurar comportamiento que no es modal
                    if (panelData.behavior) {
                        await restorePanelBehaviorFromData(panel, panelData.behavior, currentGridParams);
                        }
                    }
                    
                    restoredPanels.push(panel);
                }
            } catch (error) {
                console.error('Error al restaurar panel:', error);
            }
        }
        
        // Segunda pasada: restaurar modales después de que todos los paneles estén creados
        for (const { panel, modalData } of modalsToRestore) {
            try {
                const containerMin = modalData.containerMinCellIndex;
                const containerMax = modalData.containerMaxCellIndex;
                
                if (containerMin && containerMax) {
                    // Buscar o crear el containerPanel
                    let containerPanel = panels.find(p => 
                        p.minCellIndex.x === containerMin.x &&
                        p.minCellIndex.y === containerMin.y &&
                        p.maxCellIndex.x === containerMax.x &&
                        p.maxCellIndex.y === containerMax.y
                    );
                    
                    // Si no se encuentra, crear uno temporal
                    if (!containerPanel) {
                        containerPanel = createPanelFromBoundingBox({
                            minX: containerMin.x,
                            maxX: containerMax.x,
                            minY: containerMin.y,
                            maxY: containerMax.y
                        }, currentGridParams);
                    }
                    
                    if (containerPanel) {
                        // Restaurar el modal completo
                        restoreModalFromBehavior(containerPanel, modalData, createPanelFromBoundingBox, getCurrentGridParams, panels, getPanelText, panelsFlashing, updatePanelColor);
                    }
                }
            } catch (error) {
                console.error('Error al restaurar modal:', error);
            }
        }
        
        // Reindexar paneles después de restaurar
        reindexPanels();
        
        console.log(`Comportamiento conjunto cargado: ${restoredPanels.length} paneles restaurados`);
        
        // Flash de confirmación visual
        gridAnimationInProgress = true;
        gridAnimationStep = 2;
        gridAnimationProgress = 0;
        gridFlashCount = 0;
        
        return true;
    } catch (error) {
        console.error(`Error al cargar comportamiento conjunto del Slot ${slotIndex}:`, error);
        return false;
    }
}

// Función para limpiar un slot específico
function clearSlot(slotIndex) {
    // Función para trigger flash
    const triggerFlash = () => {
        gridAnimationInProgress = true;
        gridAnimationStep = 2;
        gridAnimationProgress = 0;
        gridFlashCount = 0;
    };
    
    // Limpiar usando el módulo bioSlots.js
    const success = bioSlotsClearSlot(slotIndex, updateSlotsPanelUI, triggerFlash);
    
    if (success) {
        slots = getSlots(); // Actualizar referencia local
    }
}

// Función para actualizar la interfaz del panel de slots
// Ahora usando bioSlots.js
function updateSlotsPanelUI() {
    const slotsContainer = document.getElementById('slots-container');
    if (!slotsContainer) return;
    
    // Asegurar que slots esté actualizado
    slots = getSlots();
    
    console.log('Actualizando UI del panel de slots. Datos actuales de slots:', slots);

    for (let i = 0; i < MAX_SLOTS; i++) {
        const slotEntry = slotsContainer.querySelector(`.slot-entry[data-slot-index="${i}"]`);
        if (slotEntry) {
            const statusElement = slotEntry.querySelector('.slot-status');
            const slotInfo = getSlotInfo(i);
            
            if (slotInfo.hasData) {
                if (slotInfo.date) {
                    // Mostrar información según el tipo
                    if (slotInfo.type === 'selectedPanels') {
                        statusElement.textContent = `Conjunto: ${slotInfo.panelCount} paneles - ${slotInfo.date.toLocaleDateString()}`;
                        statusElement.title = `Comportamiento conjunto\nGuardado: ${slotInfo.date.toLocaleString()}\nPaneles: ${slotInfo.panelCount}`;
                    } else if (slotInfo.type === 'popup') {
                        statusElement.textContent = `Popup - ${slotInfo.date.toLocaleDateString()}`;
                        statusElement.title = `Popup\nGuardado: ${slotInfo.date.toLocaleString()}\nPaneles: ${slotInfo.panelCount}`;
                    } else {
                        statusElement.textContent = `Guardado: ${slotInfo.date.toLocaleDateString()} ${slotInfo.date.toLocaleTimeString()}`;
                        statusElement.title = `Guardado: ${slotInfo.date.toLocaleString()}\nPaneles: ${slotInfo.panelCount}`;
                    }
                } else {
                    statusElement.textContent = 'Datos sin fecha';
                    statusElement.title = 'Este slot contiene datos pero sin información de fecha.';
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
        saveBtn.title = 'Guardar configuración completa (Ctrl+Shift+' + i + ')';
        saveBtn.addEventListener('click', () => saveToSlot(i));
        actions.appendChild(saveBtn);

        const saveConjuntoBtn = document.createElement('button');
        saveConjuntoBtn.textContent = 'Guardar Conjunto';
        saveConjuntoBtn.title = 'Guardar solo paneles seleccionados';
        saveConjuntoBtn.style.fontSize = '11px';
        saveConjuntoBtn.style.padding = '5px';
        saveConjuntoBtn.addEventListener('click', async () => {
            const success = await saveSelectedPanelsToSlot(i);
            if (success) {
                const originalText = saveConjuntoBtn.textContent;
                saveConjuntoBtn.textContent = '✓ Guardado!';
                setTimeout(() => {
                    saveConjuntoBtn.textContent = originalText;
                }, 1500);
            }
        });
        actions.appendChild(saveConjuntoBtn);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Cargar';
        loadBtn.title = 'Cargar configuración completa (Ctrl+' + i + ')';
        loadBtn.addEventListener('click', () => loadFromSlot(i));
        actions.appendChild(loadBtn);

        const loadConjuntoBtn = document.createElement('button');
        loadConjuntoBtn.textContent = 'Cargar Conjunto';
        loadConjuntoBtn.title = 'Cargar solo paneles guardados (sin limpiar escena)';
        loadConjuntoBtn.style.fontSize = '11px';
        loadConjuntoBtn.style.padding = '5px';
        loadConjuntoBtn.addEventListener('click', async () => {
            const success = await loadSelectedPanelsFromSlot(i);
            if (success) {
                const originalText = loadConjuntoBtn.textContent;
                loadConjuntoBtn.textContent = '✓ Cargado!';
                setTimeout(() => {
                    loadConjuntoBtn.textContent = originalText;
                }, 1500);
            }
        });
        actions.appendChild(loadConjuntoBtn);

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
            // Eliminar el panel contenedor original
            if (containerPanel.group) {
                scene.remove(containerPanel.group);
                const index = panels.indexOf(containerPanel);
                if (index > -1) {
                    panels.splice(index, 1);
                }
                showInfo('Panel contenedor eliminado', output);
            }
            
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

// Función para mostrar términos y condiciones en un panel seleccionado
function handleTermsCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para mostrar los términos y condiciones', output);
        return false;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para mostrar los términos y condiciones', output);
        return false;
    }
    
    const panel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
    
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return false;
    }
    
    // Marcar el panel como contenedor de texto
    panel.hasText = true;
    
    // Asegurar que el estado existe y configurar indicadores de scroll blancos para términos
    if (!panelTextState.has(panel)) {
        panelTextState.set(panel, {
            text: '',
            cursorPosition: 0,
            lines: [''],
            isEditing: false,
            maxCharsPerLine: 0,
            scrollOffset: 0,
            textMeshes: [],
            isPassword: false,
            textAlign: 'center',
            verticalAlign: 'middle',
            useWhiteScrollIndicators: true // Activar indicadores blancos para términos
        });
    } else {
        const textState = panelTextState.get(panel);
        textState.useWhiteScrollIndicators = true;
    }
    
    // Texto de términos y condiciones (en inglés, US-based)
    const termsText = `TERMS AND CONDITIONS OF USE – BIOPRINT SYSTEM

Property of BIOCORP, LLC.

1. ACCEPTANCE OF TERMS
By accessing, operating, or interacting with the BIOPRINT hardware unit, software interface, or associated cloud services (collectively, the "Service"), you ("The User") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to all of these Terms, do not access or use the BIOPRINT machine.

2. DATA COLLECTION AND USER CONSENT
To ensure the optimal calibration of the BIOPRINT system and to provide a hyper-personalized biological synthesis, BIOCORP requires the collection of extensive user data. By using the Service, The User grants BIOCORP an irrevocable, worldwide, royalty-free license to collect, process, and analyze the following categories of data:

2.1. Personal and Biometric Information
The User agrees to provide accurate and complete personal identification data, including but not limited to: full legal name, date of birth, residential address, Social Security Number (for identity verification purposes), and genetic or biological samples required by the BIOPRINT intake module. The User expressly consents to the capture and storage of biometric identifiers, including facial recognition scans, fingerprints, and retinal patterns, to secure their unique User Profile.

2.2. Social Media Integration and Digital Footprint
Access to the BIOPRINT functionality requires the synchronization of The User's primary social media accounts. The User hereby authorizes BIOCORP to access, scrape, and analyze data from connected platforms (including, but not limited to, X/Twitter, Meta/Facebook, Instagram, TikTok, and LinkedIn). This access includes:

* Content Analysis: Scanning of public and private posts, direct messages, and comments to assess psychological states and stress levels.

* Social Graphing: Mapping of friend lists and professional networks to determine social influence factors.

* Sentiment Metrics: Analysis of "likes," shares, and engagement history to refine the User's psychographic profile.

2.3. Consumption Habits and Lifestyle Data
The User authorizes BIOCORP to aggregate data regarding their consumption habits to predict biological needs. This includes accessing:

* Transaction History: Integration with payment gateways to analyze food, supplement, and health-related purchases.

* Digital Behavior: Tracking of browsing history, search queries, and third-party cookies related to lifestyle choices.

* Behavioral Modeling: Algorithmic assessment of sleep patterns, physical activity, and dietary preferences derived from connected wearables or IoT devices.

3. USE OF DATA AND PROPRIETARY ALGORITHMS
The User acknowledges that while the raw personal data belongs to The User, the predictive models, biological blueprints, and synthesized profiles generated by the BIOPRINT system are the sole intellectual property of BIOCORP. BIOCORP reserves the right to use anonymized aggregate data for machine learning training, product development, and commercial partnerships with third-party pharmaceutical or insurance entities.

4. DISCLAIMER OF WARRANTIES
THE BIOPRINT SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, BIOCORP DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. BIOCORP DOES NOT WARRANT THAT THE BIOPRINT RESULTS WILL BE ERROR-FREE OR THAT THE BIOLOGICAL OUTPUT WILL MEET THE USER'S EXPECTATIONS WITHOUT VARIANCE.

5. LIMITATION OF LIABILITY
IN NO EVENT SHALL BIOCORP, ITS AFFILIATES, OFFICERS, OR DIRECTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF THE USE OF THE BIOPRINT MACHINE OR THE DISCLOSURE OF DATA RESULTING FROM UNAUTHORIZED SECURITY BREACHES, BEYOND THE EXTENT OF REASONABLE SECURITY MEASURES.

6. GOVERNING LAW AND ARBITRATION
These Terms shall be governed by and construed in accordance with the laws of the State of [Insert State, e.g., Delaware or California], without regard to its conflict of law principles. Any dispute arising from these Terms or the use of BIOPRINT shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association (AAA). The User waives the right to participate in any class action lawsuit against BIOCORP.`;
    
    // Establecer el texto en el panel
    setPanelText(panel, termsText, currentGridParams.cellSize);
    
    // Buscar el siguiente panel libre para usar como botón AGREE
    const freePanels = findFreePanels();
    
    if (freePanels.length > 0) {
        const agreeButton = freePanels[0];
        
        // Configurar el botón AGREE
        agreeButton.hasText = true;
        agreeButton.isAgreeButton = true; // Marcar como botón AGREE
        agreeButton.termsPanel = panel; // Guardar referencia al panel de términos
        
        // Crear texto en el botón
        createPanelText(agreeButton, currentGridParams.cellSize);
        setPanelText(agreeButton, "I AGREE", currentGridParams.cellSize);
        
        // Centrar el texto
        const agreeTextState = panelTextState.get(agreeButton);
        if (agreeTextState) {
            agreeTextState.textAlign = 'center';
        }
        
        console.log(`Botón I AGREE asignado al panel libre #${agreeButton.orderNumber} para términos en panel #${panel.orderNumber}`);
        showSuccess(`Términos y condiciones cargados en el panel seleccionado. Botón I AGREE asignado al panel #${agreeButton.orderNumber}.`, output);
    } else {
        showError('No se encontró un panel libre para crear el botón AGREE. Cree un panel libre primero.', output);
        showSuccess('Términos y condiciones cargados en el panel seleccionado.', output);
    }
    return true;
}

// Función para crear una rejilla 3x3 de modelos
async function handleModelsCommand(output) {
    // Verificar si hay un panel seleccionado para usar como contenedor
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length !== 1) {
        showError('Selecciona exactamente un panel para usar como contenedor de los modelos', output);
        return;
    }
    
    const containerPanel = selectedPanels[0];
    showInfo('Creando rejilla 3x3 de modelos en el panel seleccionado...', output);
    
    // Lista de modelos disponibles (se pueden agregar más fácilmente)
    const modelNames = ['corazon', 'hueso', 'axolotl', 'discus', 'dog', 'acot', 'tort', 'ham', 'pollo'];
    
    // Asegurar que tenemos exactamente 9 modelos para la rejilla 3x3
    // Si hay menos de 9, repetir algunos modelos
    const gridModels = [];
    for (let i = 0; i < 9; i++) {
        gridModels.push(modelNames[i % modelNames.length]);
    }
    
    try {
        const currentGridParams = getCurrentGridParams();
        if (!currentGridParams) {
            showError('No se pudo obtener la configuración del grid', output);
            return;
        }
        
        // Calcular las dimensiones del panel contenedor
        const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
        const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
        
        // Verificar que el contenedor sea lo suficientemente grande (mínimo 3x3)
        if (containerWidth < 3 || containerHeight < 3) {
            showError('El panel contenedor debe ser de al menos 3x3 unidades para crear la rejilla de modelos', output);
            return;
        }
        
        // Calcular el tamaño de cada celda de la rejilla
        const cellWidth = Math.floor(containerWidth / 3);
        const cellHeight = Math.floor(containerHeight / 3);
        
        const createdPanels = [];
        let modelIndex = 0;
        
        // Crear la rejilla 3x3
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                // Calcular las coordenadas del panel
                const minX = containerPanel.minCellIndex.x + (col * cellWidth);
                const maxX = minX + cellWidth - 1;
                const minY = containerPanel.minCellIndex.y + (row * cellHeight);
                const maxY = minY + cellHeight - 1;
                
                // Crear el panel
                const panel = createPanelFromBoundingBox({
                    minX: minX,
                    maxX: maxX,
                    minY: minY,
                    maxY: maxY
                }, currentGridParams);
                
                if (panel && panel.group) {
                    createdPanels.push(panel);
                    
                    // Cargar el modelo correspondiente en el panel
                    const modelName = gridModels[modelIndex];
                    let modelUrl = `./models/${modelName}.obj`;
                    
                    // Cargar el modelo de forma asíncrona
                    (async () => {
                        try {
                            // Intentar primero con .obj, luego con .fbx si falla
                            let success = await loadModelToPanel(panel, modelUrl, currentGridParams.cellSize);
                            if (!success) {
                                const fbxUrl = `./models/${modelName}.fbx`;
                                console.log(`Intento con .obj falló para ${modelName}, intentando con .fbx`);
                                success = await loadModelToPanel(panel, fbxUrl, currentGridParams.cellSize);
                                if (success) {
                                    modelUrl = fbxUrl; // Actualizar URL si se cargó con .fbx
                                }
                            }
                            
                            if (success) {
                                // Guardar referencia del modelo en el panel como BOTÓN de la rejilla
                                panel.modelData = {
                                    name: modelName,
                                    url: modelUrl,
                                    isRotating: true,
                                    rotationSpeed: 0.005 + (Math.random() * 0.01), // Velocidad ligeramente aleatoria
                                    isModelButton: true, // NUEVO: Marcar como botón de la rejilla 3x3
                                    isFromModelsGrid: true, // NUEVO: Identificar que viene del comando "models"
                                    scientificName: modelScientificNames[modelName] || null // 🔥 NUEVO: Guardar nombre científico
                                };
                                console.log(`Modelo ${modelName} cargado en panel #${panel.orderNumber}`);
                            } else {
                                console.warn(`No se pudo cargar el modelo ${modelName} en panel #${panel.orderNumber}`);
                            }
                        } catch (error) {
                            console.error(`Error cargando modelo ${modelName}:`, error);
                        }
                    })();
                    
                    modelIndex++;
                }
            }
        }
        
        // Eliminar el panel contenedor original (como en los comandos apps y print)
        if (containerPanel.group) {
            scene.remove(containerPanel.group);
            const index = panels.indexOf(containerPanel);
            if (index > -1) {
                panels.splice(index, 1);
            }
        }
        
        showSuccess(`¡Rejilla de modelos creada exitosamente! Se crearon ${createdPanels.length} paneles con modelos.`, output);
        
        // Mostrar información de los modelos cargados
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            <br>Modelos incluidos: ${modelNames.join(', ')}
            <br>Cada modelo rota automáticamente con velocidad aleatoria
            <br>Usa 'model rotate' para alternar rotación en paneles seleccionados
            <br>Usa 'model speed [valor]' para ajustar velocidad de rotación
        `;
        output.appendChild(infoDiv);
        
        // Forzar actualización de la escena
        if (typeof render === 'function') {
            render();
        }
        
    } catch (error) {
        console.error('Error en handleModelsCommand:', error);
        showError(`Error al crear la rejilla de modelos: ${error.message}`, output);
    }
}

// 🔥 NUEVO: Función para asignar un panel como trigger para cargar slot en HUD
function handleHUDCommand(output, args) {
    const selectedPanels = panels.filter(p => p.selected && !p.isKeyboardKey);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para asignar trigger HUD', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para asignar trigger HUD', output);
        return;
    }
    
    if (args.length === 0) {
        showError('Especifique el número de slot (0-29). Ejemplo: hud 5', output);
        return;
    }
    
    const slotIndex = parseInt(args[0]);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        showError(`Número de slot inválido. Debe ser entre 0 y ${MAX_SLOTS - 1}`, output);
        return;
    }
    
    const hudPanel = selectedPanels[0];
    
    // Asignar el slot al panel
    hudPanel.loadToHUDSlot = slotIndex;
    
    // Efecto flash para confirmar
    hudPanel.flashProgress = 0;
    hudPanel.shouldFlash = true;
    panelsFlashing.add(hudPanel);
    
    showSuccess(`Panel #${hudPanel.orderNumber} asignado para cargar Slot ${slotIndex} en HUD al hacer click`, output);
}

// 🔥 NUEVO: Función para convertir un panel en viewer de modelo
function handleViewerCommand(output) {
    const selectedPanels = panels.filter(p => p.selected && !p.isKeyboardKey);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para convertirlo en viewer', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para convertirlo en viewer', output);
        return;
    }
    
    const viewerPanel = selectedPanels[0];
    
    // Marcar el panel como viewer
    if (!viewerPanel.modelData) {
        viewerPanel.modelData = {};
    }
    viewerPanel.modelData.isViewer = true;
    viewerPanel.isViewer = true;
    
    showSuccess(`Panel #${viewerPanel.orderNumber} convertido en viewer de modelo`, output);
    
    // Si hay algún panel con modelo presente, cargarlo en el viewer
    const panelsWithModels = panels.filter(p => 
        p !== viewerPanel && 
        p.modelData && 
        p.modelData.url && 
        !p.isKeyboardKey &&
        (p.modelData.isModelButton || p.modelData.isModelDisplay || p.modelData.isViewer)
    );
    
    if (panelsWithModels.length > 0) {
        // Usar el primer panel con modelo encontrado
        const sourcePanel = panelsWithModels[0];
        const sourceModelData = sourcePanel.modelData;
        
        if (sourceModelData.url) {
            const currentGridParams = getCurrentGridParams();
            if (currentGridParams) {
                loadModelToPanel(viewerPanel, sourceModelData.url, currentGridParams.cellSize).then((success) => {
                    if (success) {
                        viewerPanel.modelData.name = sourceModelData.name;
                        viewerPanel.modelData.url = sourceModelData.url;
                        viewerPanel.modelData.isRotating = true;
                        viewerPanel.modelData.rotationSpeed = sourceModelData.rotationSpeed || 0.005;
                        viewerPanel.modelData.scientificName = sourceModelData.scientificName || modelScientificNames[sourceModelData.name] || null; // 🔥 NUEVO: Preservar o asignar nombre científico
                        
                        showInfo(`Modelo ${sourceModelData.name} cargado en viewer`, output);
                        
                        // Mostrar nombre científico en el panel libre más cercano al viewer
                        const closestFreePanel = findClosestFreePanel(viewerPanel);
                        if (closestFreePanel) {
                            const scientificName = modelScientificNames[sourceModelData.name];
                            
                            if (scientificName) {
                                closestFreePanel.hasText = true;
                                closestFreePanel.speciesPanel = true;
                                closestFreePanel.speciesName = scientificName;
                                createPanelText(closestFreePanel, currentGridParams.cellSize);
                                setPanelText(closestFreePanel, scientificName, currentGridParams.cellSize);
                                
                                // Flash visual en el panel de especie
                                closestFreePanel.flashProgress = 0;
                                closestFreePanel.shouldFlash = true;
                                panelsFlashing.add(closestFreePanel);
                                
                                showInfo(`Nombre científico "${scientificName}" mostrado en panel #${closestFreePanel.orderNumber} (más cercano al viewer)`, output);
                            }
                        }
                    }
                });
            }
        }
    }
}

// 🔥 NUEVO: Función para guardar comportamiento conjunto desde terminal
async function handleSaveConjuntoCommand(args, output) {
    if (args.length === 0) {
        showError('Especifica el número de slot (0-9). Ejemplo: saveconjunto 1', output);
        return;
    }
    
    const slotIndex = parseInt(args[0]);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        showError(`Slot inválido. Usa un número entre 0 y ${MAX_SLOTS - 1}.`, output);
        return;
    }
    
    const selectedPanels = panels.filter(p => p.selected && !p.isKeyboardKey);
    if (selectedPanels.length === 0) {
        showError('Selecciona al menos un panel antes de guardar comportamiento conjunto.', output);
        return;
    }
    
    showInfo(`Guardando ${selectedPanels.length} paneles seleccionados en slot ${slotIndex}...`, output);
    const success = await saveSelectedPanelsToSlot(slotIndex);
    
    if (success) {
        showSuccess(`Comportamiento conjunto guardado en slot ${slotIndex} (${selectedPanels.length} paneles)`, output);
    } else {
        showError('Error al guardar comportamiento conjunto.', output);
    }
}

// 🔥 NUEVO: Función para cargar comportamiento conjunto desde terminal
async function handleLoadConjuntoCommand(args, output) {
    if (args.length === 0) {
        showError(`Especifica el número de slot (0-${MAX_SLOTS - 1}). Ejemplo: loadconjunto 1`, output);
        return;
    }
    
    const slotIndex = parseInt(args[0]);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        showError(`Slot inválido. Usa un número entre 0 y ${MAX_SLOTS - 1}.`, output);
        return;
    }
    
    // Asegurar que slots esté actualizado
    slots = getSlots();
    const slotDataString = slots[slotIndex];
    if (!slotDataString) {
        showError(`Slot ${slotIndex} está vacío.`, output);
        return;
    }
    
    try {
        const config = JSON.parse(slotDataString);
        if (config.type !== 'selectedPanels') {
            showError(`Slot ${slotIndex} contiene una configuración completa, no un comportamiento conjunto. Usa 'load' o Ctrl+${slotIndex} para cargarlo.`, output);
            return;
        }
        
        showInfo(`Cargando comportamiento conjunto desde slot ${slotIndex} (${config.panelCount} paneles)...`, output);
        const success = await loadSelectedPanelsFromSlot(slotIndex);
        
        if (success) {
            showSuccess(`Comportamiento conjunto cargado desde slot ${slotIndex} (${config.panelCount} paneles restaurados)`, output);
        } else {
            showError('Error al cargar comportamiento conjunto.', output);
        }
    } catch (error) {
        showError(`Error al procesar slot ${slotIndex}: ${error.message}`, output);
    }
}

// Función para dividir un panel horizontalmente con altura 3 y separación 1
function handleHorizontalCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para dividir horizontalmente', output);
        return;
    }
    
    const containerPanel = selectedPanels[0];
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Calcular las dimensiones del panel contenedor
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    
    // Verificar que el contenedor sea lo suficientemente grande (mínimo 4 de altura para al menos un panel de 3 + separación)
    if (containerHeight < 4) {
        showError('El panel contenedor debe tener al menos 4 unidades de altura para crear divisiones horizontales', output);
        return;
    }
    
    const panelHeight = 3; // Altura fija de cada panel
    const separationHeight = 1; // Separación entre paneles
    const totalPanelHeight = panelHeight + separationHeight;
    
    // Calcular cuántos paneles caben
    const maxPanels = Math.floor(containerHeight / totalPanelHeight);
    
    if (maxPanels === 0) {
        showError('El panel contenedor es demasiado pequeño para crear divisiones horizontales', output);
        return;
    }
    
    try {
        const createdPanels = [];
        
        // Crear paneles horizontales
        for (let i = 0; i < maxPanels; i++) {
            const minY = containerPanel.minCellIndex.y + (i * totalPanelHeight);
            const maxY = minY + panelHeight - 1;
            
            // Verificar que no se salga del contenedor
            if (maxY > containerPanel.maxCellIndex.y) {
                break;
            }
            
            // Crear el panel
            const panel = createPanelFromBoundingBox({
                minX: containerPanel.minCellIndex.x,
                maxX: containerPanel.maxCellIndex.x,
                minY: minY,
                maxY: maxY
            }, currentGridParams);
            
            if (panel && panel.group) {
                createdPanels.push(panel);
            }
        }
        
        // Eliminar el panel contenedor original
        if (containerPanel.group) {
            scene.remove(containerPanel.group);
            const index = panels.indexOf(containerPanel);
            if (index > -1) {
                panels.splice(index, 1);
            }
        }
        
        showSuccess(`División horizontal completada. Se crearon ${createdPanels.length} paneles de altura 3 con separación 1.`, output);
        
        // Mostrar información de los paneles creados
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `<br>Paneles creados:<br>`;
        createdPanels.forEach((panel, index) => {
            infoDiv.innerHTML += `Panel #${panel.orderNumber}: ${containerWidth}x${panelHeight} unidades<br>`;
        });
        output.appendChild(infoDiv);
        
    } catch (error) {
        console.error('Error en handleHorizontalCommand:', error);
        showError('Error al crear la división horizontal', output);
    }
}

// Función para mostrar estadísticas genómicas de un modelo
function handleMultiTestCommand(output) {
    showInfo('Creando demostración de multiselección biomédica...', output);
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Crear patrón de laboratorio biomédico
    const labLayout = [
        // Fila de muestras genéticas
        { minX: 2, maxX: 4, minY: 2, maxY: 4 },
        { minX: 6, maxX: 8, minY: 2, maxY: 4 },
        { minX: 10, maxX: 12, minY: 2, maxY: 4 },
        
        // Fila de cultivos celulares
        { minX: 3, maxX: 5, minY: 7, maxY: 9 },
        { minX: 7, maxX: 9, minY: 7, maxY: 9 },
        
        // Área de análisis
        { minX: 5, maxX: 9, minY: 12, maxY: 15 }
    ];
    
    const createdPanels = [];
    labLayout.forEach((bounds, index) => {
        const panelData = createPanelFromBoundingBox([bounds], currentGridParams);
        if (panelData) {
            createdPanels.push(panelData);
            // Asignar etiquetas conceptuales
            if (index < 3) {
                panelData.demoLabel = `Muestra Genética ${index + 1}`;
            } else if (index < 5) {
                panelData.demoLabel = `Cultivo Celular ${index - 2}`;
            } else {
                panelData.demoLabel = 'Área de Análisis';
            }
        }
    });
    
    if (createdPanels.length > 0) {
        showSuccess(`
        🧬 LABORATORIO BIOMÉDICO VIRTUAL CREADO
        
        📊 ${createdPanels.length} estaciones de trabajo listas:
        • P1-P3: Muestras genéticas para análisis comparativo
        • P4-P5: Cultivos celulares para observación
        • P6: Área de análisis integrado
        
        🔥 PRUEBA ESTAS OPERACIONES:
        
        🔹 MULTISELECCIÓN:
          • <b>Shift + Click</b> en P1, P2, P3 → Seleccionar muestras genéticas
          • <b>Ctrl + Arrastrar</b> sobre P4-P5 → Añadir cultivos a selección
          • <b>Click normal</b> en P6 → Selección única de análisis
        
        🔹 OPERACIONES EN LOTE:
          • <b>Flechas ← → ↑ ↓</b> → Mover conjunto seleccionado
          • <b>Tecla Supr</b> → Eliminar selección completa
          • <b>"delete selected"</b> → Comando de eliminación
        
        🔹 COMANDOS BIOMÉDICOS:
          • <b>"select 1-3"</b> → Seleccionar muestras genéticas
          • <b>"select all"</b> → Seleccionar todo el laboratorio
          • <b>"list"</b> → Ver estado de selección actual
        
        💡 APLICACIÓN REAL: Procesamiento batch de datos genómicos
        `, output);
        
        // Añadir información técnica
        const techDiv = document.createElement('div');
        techDiv.innerHTML = `
            <br><b>🔬 APLICACIONES BIOMÉDICAS:</b>
            <br>• <b>Análisis comparativo:</b> Selecciona múltiples muestras para correlación
            <br>• <b>Pipeline automatizado:</b> Procesa lotes de datos genómicos
            <br>• <b>Control de calidad:</b> Mueve grupos de muestras entre fases
            <br>• <b>Documentación:</b> Rastrea conjuntos de experimentos
        `;
        output.appendChild(techDiv);
    } else {
        showError('Error al crear el laboratorio virtual', output);
    }
}

// Función para demostración avanzada de multiselección
function handleDemoCommand(output) {
    showInfo('Iniciando demostración avanzada de multiselección biomédica...', output);
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Limpiar solo paneles del demo anterior (no teclado)
    const demoMarkers = panels.filter(p => p.bioType);
    demoMarkers.forEach(panel => {
        if (panel.group) {
            scene.remove(panel.group);
        }
        const index = panels.indexOf(panel);
        if (index > -1) {
            panels.splice(index, 1);
        }
    });
    
    // Función optimizada para detectar área del teclado
    const isKeyboardArea = (minX, maxX, minY, maxY) => {
        const keyboardPanels = panels.filter(panel => panel.isKeyboardKey);
        if (keyboardPanels.length === 0) return false;
        
        return keyboardPanels.some(panel => {
            return !(maxX < panel.minCellIndex.x || 
                     minX > panel.maxCellIndex.x || 
                     maxY < panel.minCellIndex.y || 
                     minY > panel.maxCellIndex.y);
        });
    };
    
    // Función para encontrar áreas libres en TODA la pantalla
    const findFreeArea = (width, height, attempts = 200) => {
        const gridSize = currentGridParams.divisions || 24;
        const usedAreas = createdPanels.map(p => ({
            minX: p.minCellIndex.x,
            maxX: p.maxCellIndex.x,
            minY: p.minCellIndex.y,
            maxY: p.maxCellIndex.y
        }));
        
        // Detectar límites del teclado para evitarlo
        const keyboardPanels = panels.filter(panel => panel.isKeyboardKey);
        let keyboardBounds = null;
        if (keyboardPanels.length > 0) {
            keyboardBounds = {
                minX: Math.min(...keyboardPanels.map(p => p.minCellIndex.x)),
                maxX: Math.max(...keyboardPanels.map(p => p.maxCellIndex.x)),
                minY: Math.min(...keyboardPanels.map(p => p.minCellIndex.y)),
                maxY: Math.max(...keyboardPanels.map(p => p.maxCellIndex.y))
            };
        }
        
        // BÚSQUEDA SISTEMÁTICA por TODO el grid (no aleatoria)
        const positions = [];
        for (let x = 0; x <= gridSize - width; x++) {
            for (let y = 0; y <= gridSize - height; y++) {
                positions.push({ x, y });
            }
        }
        
        // Mezclar posiciones para distribución más natural
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Probar cada posición
        for (const pos of positions) {
            const minX = pos.x;
            const minY = pos.y;
            const maxX = minX + width - 1;
            const maxY = minY + height - 1;
            
            // Verificar límites del grid
            if (maxX >= gridSize || maxY >= gridSize || minX < 0 || minY < 0) continue;
            
            // Verificar colisión con teclado usando bounds calculados
            if (keyboardBounds) {
                const overlapsKeyboard = !(maxX < keyboardBounds.minX || 
                                          minX > keyboardBounds.maxX || 
                                          maxY < keyboardBounds.minY || 
                                          minY > keyboardBounds.maxY);
                if (overlapsKeyboard) continue;
            }
            
            // Verificar colisión con paneles existentes
            const hasCollision = panels.some(panel => {
                if (panel.isKeyboardKey) return false;
                return !(maxX < panel.minCellIndex.x || 
                         minX > panel.maxCellIndex.x || 
                         maxY < panel.minCellIndex.y || 
                         minY > panel.maxCellIndex.y);
            });
            
            // Verificar colisión con áreas ya creadas en esta sesión
            const hasCreatedCollision = usedAreas.some(area => {
                return !(maxX < area.minX || minX > area.maxX || maxY < area.minY || minY > area.maxY);
            });
            
            if (!hasCollision && !hasCreatedCollision) {
                return { minX, maxX, minY, maxY };
            }
        }
        
        return null; // No se encontró espacio libre
    };
    
    // Crear layout de investigación biomédica con tamaños variables distribuidos
    const bioLabModules = [
        // Análisis genómicos (tamaños pequeños distribuidos)
        { name: 'BRCA1 Gene', type: 'genomics', size: [2, 2] },
        { name: 'TP53 Analysis', type: 'genomics', size: [3, 2] },
        { name: 'KRAS Mutation', type: 'genomics', size: [2, 3] },
        { name: 'PIK3CA Variant', type: 'genomics', size: [3, 3] },
        
        // Cultivos celulares (tamaños medianos distribuidos)
        { name: 'HeLa Culture', type: 'cell_culture', size: [4, 3] },
        { name: 'MCF-7 Line', type: 'cell_culture', size: [3, 4] },
        { name: 'Primary Neurons', type: 'cell_culture', size: [5, 2] },
        { name: 'Stem Cells', type: 'cell_culture', size: [2, 5] },
        
        // Equipamiento de laboratorio (tamaños grandes distribuidos)
        { name: 'Flow Cytometer', type: 'equipment', size: [5, 4] },
        { name: 'PCR Station', type: 'equipment', size: [4, 5] },
        { name: 'Microscopy Hub', type: 'equipment', size: [6, 3] },
        { name: 'Sequencer', type: 'equipment', size: [3, 6] },
        
        // Análisis de datos (tamaños rectangulares grandes)
        { name: 'Bioinformatics', type: 'analysis', size: [8, 3] },
        { name: 'Statistical Model', type: 'analysis', size: [6, 5] },
        { name: 'Results Dashboard', type: 'analysis', size: [7, 4] },
        { name: 'AI Processing', type: 'analysis', size: [5, 6] }
    ];
    
    const createdPanels = [];
    const colors = {
        genomics: '#00ff88',    // Verde para genómica
        cell_culture: '#ff6600', // Naranja para cultivos
        equipment: '#0088ff',   // Azul para equipamiento
        analysis: '#ff0088'     // Rosa para análisis
    };
    
    bioLabModules.forEach((module, index) => {
        const [width, height] = module.size;
        const area = findFreeArea(width, height);
        
        if (area) {
                         const panelData = createPanelFromBoundingBox(area, currentGridParams);
            if (panelData) {
                createdPanels.push(panelData);
                
                // Asignar metadatos biomédicos
                panelData.bioType = module.type;
                panelData.bioName = module.name;
                panelData.bioSize = `${width}x${height}`;
                panelData.bioColor = colors[module.type];
                
                // Añadir un indicador visual del tipo
                const typeIndicator = module.type.charAt(0).toUpperCase();
                panelData.typeIndicator = typeIndicator;
                
                                 showInfo(`📍 Creado: ${module.name} (${width}x${height}) en [${area.minX},${area.minY}] - [${area.maxX},${area.maxY}]`, output);
                 
                 // Debug del panel creado (sin forzar números)
                 if (panelData.group) {
                     panelData.group.visible = true;
                     updatePanelColor(panelData); // Actualizar colores
                     console.log(`Panel ${panelData.orderNumber} creado en posición:`, panelData.group.position);
                 }
            }
        } else {
            showInfo(`⚠️ No se pudo colocar: ${module.name} (${width}x${height}) - Sin espacio libre`, output);
        }
    });
    
    if (createdPanels.length > 0) {
        showSuccess(`
        🧬 LABORATORIO BIOMÉDICO DISTRIBUIDO DESPLEGADO
        
        📊 ${createdPanels.length} módulos de investigación activos:
        
        🧪 MÓDULOS GENÓMICOS (Verde):
          • Análisis de genes BRCA1, TP53, KRAS
          • Detección de mutaciones puntuales
          • Secuenciación de nueva generación
        
        🔬 CULTIVOS CELULARES (Naranja):
          • Líneas celulares inmortalizadas
          • Cultivos primarios de neuronas
          • Ensayos de viabilidad celular
        
        ⚗️ EQUIPAMIENTO ESPECIALIZADO (Azul):
          • Citometría de flujo multiparamétrica
          • Estaciones de PCR en tiempo real
          • Microscopía avanzada de alta resolución
        
        📈 ANÁLISIS COMPUTACIONAL (Rosa):
          • Pipeline bioinformático completo
          • Modelos estadísticos complejos
          • Dashboard de resultados integrados
        
        🔥 FUNCIONALIDADES DINÁMICAS:
        
        ✨ DISTRIBUCIÓN INTELIGENTE:
          • Paneles de tamaños variables (2x2 hasta 7x3)
          • Evita automáticamente el espacio del teclado
          • Distribución aleatoria en espacio libre
        
        🎯 FLUJOS DE TRABAJO ADAPTATIVOS:
          1. "select" + tipo → Seleccionar por categoría
          2. Shift + Arrastrar → Multiselección de área
          3. Flechas → Reorganización espacial inteligente
          4. "list" → Inventario completo del laboratorio
          
        🧬 APLICACIONES BIOMÉDICAS:
          • Workflow de medicina personalizada
          • Pipeline de descubrimiento de fármacos
          • Análisis multi-ómico integrado
          • Investigación traslacional
        `, output);
        
        // Auto-seleccionar módulos genómicos para empezar
        // Estadísticas de distribución 
        const stats = {
            total: createdPanels.length,
            attempted: bioLabModules.length,
            coverage: Math.round((createdPanels.length / bioLabModules.length) * 100)
        };
        
        const typeStats = Object.entries(typeColors).map(([type, _]) => {
            const count = createdPanels.filter(p => p.bioType === type).length;
            return `${type}: ${count}`;
        }).join(', ');
        
        showSuccess(
            `🧬 LABORATORIO EXPANDIDO: ${stats.total}/${stats.attempted} módulos (${stats.coverage}% cobertura) ` +
            `distribuidos por toda la pantalla - ${typeStats}`, 
            output
        );
        
        // Diagnóstico completo de paneles creados
        showInfo(`🔬 DIAGNÓSTICO DE LABORATORIO:`, output);
        panels.forEach((panel, index) => {
            if (panel.bioType) {
                const pos = panel.group ? panel.group.position : 'sin posición';
                const visible = panel.group ? panel.group.visible : 'no visible';
                showInfo(`   Panel #${panel.orderNumber}: ${panel.bioName} (${panel.bioSize}) - Pos: ${JSON.stringify(pos)} - Visible: ${visible}`, output);
            }
        });
        
        setTimeout(() => {
            const genomicsPanels = createdPanels.filter(p => p.bioType === 'genomics');
            if (genomicsPanels.length > 0) {
                genomicsPanels.forEach(panel => {
                    panel.selected = true;
                });
                refreshSelectedPanelsColors();
                showInfo(`✨ Auto-seleccionados: ${genomicsPanels.length} módulos genómicos para comenzar`, output);
            }
        }, 2000);
        
        // Mostrar números SOLO en paneles del demo, NO en teclado
        setTimeout(() => {
            createdPanels.forEach(panel => {
                if (panel.bioType) {
                    panel.showOrderNumber = true;
                    createPanelOrderLabel(panel);
                }
            });
            showInfo('📊 Números activados solo para módulos del laboratorio', output);
        }, 1000);
        
    } else {
        showError('Error: No se pudo crear ningún módulo del laboratorio - Grid saturado', output);
    }
}

// Función auxiliar para actualizar estadísticas genómicas en un panel existente
function updateStatgPanelWithModel(panel, modelName, currentGridParams) {
    // Base de datos de estadísticas genómicas por modelo (copiada de handleStatgCommand)
    const genomicStats = {
        corazon: {
            species: "Homo sapiens (Corazón Humano)",
            chromosomes: "23 pares (2n=46)",
            genomeSize: "3.2 Gb",
            genes: "20,687 genes codificantes",
            proteins: "20,430 proteínas únicas",
            gcContent: "41%",
            repetitiveElements: "45%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,881 tRNA, 45 rRNA",
            functionalDomains: "Contracción cardíaca, Conducción eléctrica, Metabolismo energético",
            mutations: "SNPs: 4.3M, Indels: 0.6M",
            phylogeny: "Primates, Familia Hominidae",
            biomedical: "Cardiomiopatías, arritmias, insuficiencia cardíaca, modelos de regeneración"
        },
        hueso: {
            species: "Homo sapiens (Tejido Óseo)",
            chromosomes: "23 pares (2n=46)",
            genomeSize: "3.2 Gb",
            genes: "20,687 genes codificantes",
            proteins: "20,430 proteínas únicas",
            gcContent: "41%",
            repetitiveElements: "45%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,881 tRNA, 45 rRNA",
            functionalDomains: "Osteogénesis, Remodelación ósea, Homeostasis del calcio",
            mutations: "SNPs: 4.3M, Indels: 0.6M",
            phylogeny: "Primates, Familia Hominidae",
            biomedical: "Osteoporosis, Fracturas, Displasia ósea"
        },
        axolotl: {
            species: "Ambystoma mexicanum",
            chromosomes: "14 pares (2n=28)",
            genomeSize: "32.4 Gb",
            genes: "23,251 genes codificantes",
            proteins: "22,472 proteínas únicas",
            gcContent: "27.8%",
            repetitiveElements: "65.8%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "2,341 tRNA, 45 rRNA",
            functionalDomains: "Regeneración de extremidades, Neotenia, Cicatrización",
            mutations: "SNPs: 45.7M, Indels: 3.8M",
            phylogeny: "Anfibios, Familia Ambystomatidae",
            biomedical: "Medicina regenerativa, Cicatrización de heridas"
        },
        discus: {
            species: "Symphysodon discus",
            chromosomes: "24 pares (2n=48)",
            genomeSize: "0.9 Gb",
            genes: "28,644 genes codificantes",
            proteins: "26,735 proteínas únicas",
            gcContent: "40.8%",
            repetitiveElements: "28.4%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,523 tRNA, 45 rRNA",
            functionalDomains: "Navegación acuática, Coloración, Cuidado parental",
            mutations: "SNPs: 12.4M, Indels: 1.1M",
            phylogeny: "Perciformes, Familia Cichlidae",
            biomedical: "Modelos de comportamiento social"
        },
        dog: {
            species: "Canis lupus familiaris",
            chromosomes: "39 pares (2n=78)",
            genomeSize: "2.41 Gb",
            genes: "19,856 genes codificantes",
            proteins: "19,074 proteínas únicas",
            gcContent: "41.5%",
            repetitiveElements: "31.2%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,334 tRNA, 45 rRNA",
            functionalDomains: "Olfato avanzado, Comunicación social, Domesticación",
            mutations: "SNPs: 58.6M, Indels: 4.2M",
            phylogeny: "Carnívoros, Familia Canidae",
            biomedical: "Modelos de cáncer, epilepsia, cardiomiopatía"
        },
        acot: {
            species: "Acotylosaurus arcuatus",
            chromosomes: "18 pares (2n=36)",
            genomeSize: "1.8 Gb",
            genes: "21,334 genes codificantes",
            proteins: "20,156 proteínas únicas",
            gcContent: "38.9%",
            repetitiveElements: "42.1%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,567 tRNA, 45 rRNA",
            functionalDomains: "Metabolismo herbívoro, Defensa corporal",
            mutations: "SNPs: 28.9M, Indels: 2.3M",
            phylogeny: "Dinosauria, Familia Nodosauridae",
            biomedical: "Paleogenómica, Evolución de armaduras"
        },
        tort: {
            species: "Chelonia mydas (Tortuga Verde)",
            chromosomes: "26 pares (2n=52)",
            genomeSize: "2.24 Gb",
            genes: "21,796 genes codificantes",
            proteins: "20,623 proteínas únicas",
            gcContent: "42.3%",
            repetitiveElements: "39.7%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,445 tRNA, 45 rRNA",
            functionalDomains: "Longevidad extrema, Navegación magnética, Caparazón",
            mutations: "SNPs: 35.2M, Indels: 2.7M",
            phylogeny: "Reptilia, Familia Cheloniidae",
            biomedical: "Estudios de longevidad, resistencia a cáncer"
        },
        ham: {
            species: "Sus scrofa (Jamón de Cerdo)",
            chromosomes: "19 pares (2n=38)",
            genomeSize: "2.8 Gb",
            genes: "21,640 genes codificantes",
            proteins: "20,823 proteínas únicas",
            gcContent: "42.1%",
            repetitiveElements: "38.5%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,789 tRNA, 45 rRNA",
            functionalDomains: "Metabolismo lipídico, Desarrollo muscular, Producción cárnica",
            mutations: "SNPs: 8.9M, Indels: 1.2M",
            phylogeny: "Artiodáctilos, Familia Suidae",
            biomedical: "Xenotrasplantes, modelos de obesidad, investigación nutricional"
        },
        pollo: {
            species: "Gallus gallus domesticus",
            chromosomes: "39 pares (2n=78)",
            genomeSize: "1.23 Gb",
            genes: "20,867 genes codificantes",
            proteins: "17,954 proteínas únicas",
            gcContent: "41.2%",
            repetitiveElements: "9.7%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,234 tRNA, 45 rRNA",
            functionalDomains: "Producción de huevos, Metabolismo rápido, Vuelo limitado",
            mutations: "SNPs: 19.8M, Indels: 1.4M",
            phylogeny: "Aves, Familia Phasianidae",
            biomedical: "Modelos de desarrollo embrionario, vacunas aviares"
        }
    };

    // Verificar si el modelo existe
    if (!genomicStats[modelName]) {
        console.warn(`Modelo '${modelName}' no encontrado para estadísticas genómicas`);
        return false;
    }

    const stats = genomicStats[modelName];
    
    // Actualizar datos del panel
    panel.statgModelName = modelName;
    
    // Generar el texto de estadísticas genómicas
    const statsText = `ESTADÍSTICAS GENÓMICAS - ${modelName.toUpperCase()}

═══════════════════════════════════════════════════════════

INFORMACIÓN TAXONÓMICA
Especie: ${stats.species}
Filogenia: ${stats.phylogeny}

ARQUITECTURA GENÓMICA
Cromosomas: ${stats.chromosomes}
Tamaño del genoma: ${stats.genomeSize}
Contenido GC: ${stats.gcContent}
Elementos repetitivos: ${stats.repetitiveElements}

ANOTACIÓN GÉNICA
Genes codificantes: ${stats.genes}
Proteínas únicas: ${stats.proteins}
Genes mitocondriales: ${stats.mitochondrialGenes}
Genes de RNA: ${stats.rnaGenes}

VARIACIÓN GENÉTICA
Mutaciones: ${stats.mutations}

DOMINIOS FUNCIONALES
${stats.functionalDomains}

APLICACIONES BIOMÉDICAS
${stats.biomedical}

═══════════════════════════════════════════════════════════
Datos generados por BioPrint Genomics Suite v2.1
Actualizado: ${new Date().toLocaleDateString('es-ES')}`;
    
    // Establecer el texto en el panel
    setPanelText(panel, statsText, currentGridParams.cellSize);
    
    // Flash visual para indicar la actualización
    panel.flashProgress = 0;
    panel.shouldFlash = true;
    panelsFlashing.add(panel);
    
    console.log(`✅ Estadísticas genómicas actualizadas en panel #${panel.orderNumber}: ${modelName} → ${stats.species}`);
    return true;
}

// 🧬 FUNCIONES ESPECIALES HOMO PRINTEMPS
function initializeHomoPrintempsMode(modelPanel, displayPanel, gridParams, cyclicBarPanel) {
    console.log("🧬 Iniciando modo HOMO PRINTEMPS...");
    console.log("🧬 ModelPanel:", modelPanel);
    console.log("🧬 DisplayPanel:", displayPanel);
    console.log("🧬 CyclicBarPanel:", cyclicBarPanel);
    
    try {
        // 1. Detener rotación y posicionar modelo flatlay
        setModelToFlatlayPosition(modelPanel, gridParams);
        
        // 2. Crear scanline súper visible en el panel del modelo
        createHomoPrintempsScanline(modelPanel, gridParams, cyclicBarPanel);
        
        console.log("🧬 Modo HOMO PRINTEMPS activado completamente");
    } catch (err) {
        console.error("Error en HOMO PRINTEMPS:", err);
    }
}

function createHomoPrintempsScanline(targetPanel, gridParams, cyclicBarPanel) {
    console.log("🧬 === CREANDO SCANLINE HOMO PRINTEMPS ===");
    console.log("🧬 Panel objetivo:", targetPanel.type || "desconocido");
    console.log("🧬 Panel tiene grupo:", !!targetPanel.group);
    console.log("🧬 CyclicBarPanel válido:", !!cyclicBarPanel);
    console.log("🧬 CyclicBarPanel.cycleProgress inicial:", cyclicBarPanel.cycleProgress);
    
    // Crear material SÚPER BRILLANTE Y VISIBLE
    const scanlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff, // BLANCO PURO
        transparent: false,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        emissive: 0xffffff, // EMITE LUZ BLANCA
        emissiveIntensity: 1.0 // INTENSIDAD MÁXIMA
    });
    
    // Calcular dimensiones del panel
    const panelWidth = (targetPanel.maxCellIndex.x - targetPanel.minCellIndex.x + 1) * gridParams.cellSize;
    const panelHeight = (targetPanel.maxCellIndex.y - targetPanel.minCellIndex.y + 1) * gridParams.cellSize;
    
    // 🧬 SCANLINE ABARCA TODO EL ANCHO DEL PANEL
    const scanlineWidth = panelWidth; // 100% del ancho del panel, sin reducir
    const scanlineGeometry = new THREE.PlaneGeometry(scanlineWidth, 0.3); // Altura normal
    const scanlineMesh = new THREE.Mesh(scanlineGeometry, scanlineMaterial);
    
    // Posicionamiento inicial en la parte inferior del panel
    const startY = -panelHeight / 2;
    const endY = panelHeight / 2;
    scanlineMesh.position.set(0, startY, 2.0); // Z=2.0 MUY por encima
    
    // Asegurar que esté visible
    scanlineMesh.visible = true;
    scanlineMesh.frustumCulled = false; // No hacer culling
    
    // Añadir al grupo del panel
    targetPanel.group.add(scanlineMesh);
    
    console.log("🧬 Scanline añadida al grupo del panel");
    console.log("🧬 Posición inicial:", scanlineMesh.position);
    console.log("🧬 Dimensiones:", panelWidth * 0.95, "x", 0.3);
    console.log("🧬 Rango movimiento Y:", startY, "a", endY);
    console.log("🧬 Material emisivo activado con intensidad máxima");
    
    // Variable para controlar la animación
    let isAnimating = true;
    
    // Función de animación simple
    function animateScanline() {
        if (!isAnimating) return;
        
        try {
            // Obtener progreso de la barra cíclica
            const rawProgress = cyclicBarPanel.cycleProgress || 0;
            const normalizedProgress = rawProgress / 100;
            
                         // Calcular nueva posición Y
             const newY = startY + (endY - startY) * normalizedProgress;
             scanlineMesh.position.y = newY;
             
             // Efecto de parpadeo para máxima visibilidad  
             const time = Date.now() * 0.01;
             
             // Sincronizar efecto voxel del modelo con la scanline
             updateModelVoxelReveal(targetPanel, newY, time);
             const pulse = Math.sin(time) * 0.3 + 0.7; // Parpadeo entre 0.4 y 1.0
             scanlineMaterial.emissiveIntensity = pulse;
             
             // 🧬 EFECTO DE ESCALA SOLO EN Y (altura) PARA MANTENER ANCHO COMPLETO
             const scaleY = 1.0 + Math.sin(time * 1.5) * 0.2; // Pulso vertical más marcado
             scanlineMesh.scale.set(1.0, scaleY, 1.0); // Solo escalar en altura, mantener ancho completo
             
             // Debug cada 30 frames (~2 veces por segundo)
             if (Date.now() % 500 < 20) {
                 console.log("🧬 SCANLINE ACTIVA:", {
                     rawProgress: rawProgress,
                     normalizedProgress: normalizedProgress,
                     positionY: newY,
                     pulse: pulse,
                     scaleY: scaleY, // 🧬 CORREGIDO: usar scaleY en lugar de scale
                     visible: scanlineMesh.visible,
                     inScene: !!scanlineMesh.parent
                 });
             }
            
            // Continuar animación
            requestAnimationFrame(animateScanline);
        } catch (error) {
            console.error("🧬 Error en animación scanline:", error);
            isAnimating = false;
        }
    }
    
    // Iniciar animación inmediatamente
    animateScanline();
    
    // Guardar referencias
    targetPanel.homoPrintempsScanline = scanlineMesh;
    targetPanel.homoPrintempsActive = true;
    
    console.log("🧬 === SCANLINE HOMO PRINTEMPS COMPLETADA ===");
    
    return scanlineMesh;
}

// Funciones auxiliares para HOMO PRINTEMPS

function setModelToFlatlayPosition(modelPanel, gridParams) {
    console.log("🧬 Configurando modelo flatlay con revelado voxelizado...");
    
    try {
        // 🧬 MANTENER ROTACIÓN PERO DESDE CENTRO DEL GRID  
        if (modelPanel && modelPanel.modelData) {
            // NO detener la rotación, solo marcar el modo especial
            modelPanel.modelData.isHomoPrintemps = true;
            // Mantener velocidad de rotación actual o usar una moderada
            if (!modelPanel.modelData.rotationSpeed) {
                modelPanel.modelData.rotationSpeed = 0.01; // Velocidad moderada
            }
            console.log("🧬 Rotación mantenida en modo HOMO PRINTEMPS con velocidad:", modelPanel.modelData.rotationSpeed);
        }
        
        // Buscar el modelo en el panel
        const modelGroup = modelPanel.group.children.find(child => 
            child.userData && child.userData.isModel);
        
        if (modelGroup) {
            // Buscar el grupo isométrico
            const isoGroup = modelGroup.children.find(child => 
                child.name === 'IsoGroup');
            
            if (isoGroup && isoGroup.children.length > 0) {
                const model = isoGroup.children[0];
                
                console.log("🧬 Modelo encontrado, aplicando transformación flatlay con revelado");
                
                // Resetear todas las rotaciones del grupo isométrico
                isoGroup.rotation.set(0, 0, 0);
                // 🧬 POSICIONAR EN CENTRO DE LA VISTA DE CÁMARA (0,0,0)
                isoGroup.position.set(0, 0, 0);
                
                // Resetear rotaciones del modelo y orientar de frente
                model.rotation.set(0, 0, 0);
                
                // Calcular bounding box para centrado correcto
                const bbox = new THREE.Box3().setFromObject(model);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                bbox.getCenter(center);
                bbox.getSize(size);
                
                // 🧬 CALCULAR DIMENSIONES Y CENTRO DEL PANEL
                const panelWidth = (modelPanel.maxCellIndex.x - modelPanel.minCellIndex.x + 1) * gridParams.cellSize;
                const panelHeight = (modelPanel.maxCellIndex.y - modelPanel.minCellIndex.y + 1) * gridParams.cellSize;
                const panelCenterX = -gridParams.halfWidth + (modelPanel.minCellIndex.x + panelWidth/gridParams.cellSize/2) * gridParams.cellSize;
                const panelCenterY = -gridParams.halfHeight + (modelPanel.minCellIndex.y + panelHeight/gridParams.cellSize/2) * gridParams.cellSize;
                
                // 🧬 ESCALADO ADAPTATIVO: TRANSFORMAR EL MODELO A LA MEDIDA DEL PANEL
                // Calcular el factor de escala para que el modelo use óptimamente el panel
                const margenSeguridad = 0.85; // Usar 85% del panel para dejar margen visual
                const espacioDisponibleX = panelWidth * margenSeguridad;
                const espacioDisponibleY = panelHeight * margenSeguridad;
                
                // Calcular factores de escala para X e Y
                const factorEscalaX = espacioDisponibleX / size.x;
                const factorEscalaY = espacioDisponibleY / size.y;
                
                // Usar el menor factor para mantener proporciones (escalado uniforme)
                const factorEscalaUniforme = Math.min(factorEscalaX, factorEscalaY);
                
                // Aplicar escalado adaptativo
                model.scale.multiplyScalar(factorEscalaUniforme);
                
                // Recalcular bounding box después del escalado adaptativo
                const scaledBbox = new THREE.Box3().setFromObject(model);
                const scaledCenter = new THREE.Vector3();
                scaledBbox.getCenter(scaledCenter);
                
                // 🧬 CENTRAR EL MODELO ESCALADO EN EL PANEL
                const posicionYModelo = -scaledCenter.y;
                
                model.position.set(
                    -scaledCenter.x, // Centrar en X relativo al modelo escalado
                    posicionYModelo, // Pies tocando la base del panel
                    -scaledCenter.z + 0.1  // Ligeramente por encima del plano
                );
                
                // 🧬 MOVER EL GRUPO AL CENTRO DEL PANEL (para que rote desde ahí)
                modelGroup.position.set(panelCenterX, panelCenterY, 0);
                
                // Crear efecto de revelado voxelizado
                createVoxelRevealEffect(model, bbox, panelHeight);
                
                // Guardar referencias para el efecto de revelado
                modelPanel.homoPrintempsModel = model;
                modelPanel.homoPrintempsBbox = bbox;
                modelPanel.homoPrintempsPanelHeight = panelHeight;
                
                console.log("🧬 Modelo posicionado flatlay con efecto voxel:", {
                    modelPos: model.position,
                    bbox: { min: bbox.min, max: bbox.max },
                    center: center,
                    panelHeight: panelHeight
                });
            } else {
                console.log("🧬 No se encontró grupo isométrico o modelo");
            }
        } else {
            console.log("🧬 No se encontró grupo de modelo en el panel");
        }
    } catch (error) {
        console.error("🧬 Error en setModelToFlatlayPosition:", error);
    }
}

function createVoxelRevealEffect(model, bbox, panelHeight) {
    console.log("🧬 Creando efecto de revelado voxelizado...");
    
    // Crear shader material personalizado para el efecto de revelado
    const voxelShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            scanlineY: { value: -panelHeight/2 }, // Posición Y de la scanline
            panelMinY: { value: -panelHeight/2 }, // 🧬 USAR RANGO DEL PANEL
            panelMaxY: { value: panelHeight/2 },  // 🧬 USAR RANGO DEL PANEL
            voxelSize: { value: 24.0 }, // 🧬 VOXELES MONSTRUOSOS PARA MÁXIMA VISIBILIDAD
            time: { value: 0.0 },
            opacity: { value: 1.0 },
            progress: { value: 0.0 } // 🧬 NUEVO: progreso de impresión para resolución
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vPosition;
            
            void main() {
                vPosition = position;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float scanlineY;
            uniform float panelMinY; // 🧬 RANGO DEL PANEL EN LUGAR DEL MODELO
            uniform float panelMaxY; // 🧬 RANGO DEL PANEL EN LUGAR DEL MODELO
            uniform float voxelSize;
            uniform float time;
            uniform float opacity;
            uniform float progress; // 🧬 Progreso de impresión (0.0 a 1.0)
            
            varying vec3 vWorldPosition;
            varying vec3 vPosition;
            
            void main() {
                // 🧬 REVELAR TODO LO QUE ESTÉ DEBAJO DE LA SCANLINE EN EL PANEL
                float revealThreshold = scanlineY + 0.1; // Offset pequeño para suavizar
                
                // Solo mostrar partes que estén por debajo de la scanline
                if (vWorldPosition.y > revealThreshold) {
                    discard;
                }
                
                // 🧬 ASEGURAR QUE SE PROCESA TODO EL RANGO DEL PANEL
                if (vWorldPosition.y < panelMinY - 1.0 || vWorldPosition.y > panelMaxY + 1.0) {
                    discard; // Fuera del rango del panel
                }
                
                // 🧬 RESOLUCIÓN PROGRESIVA: voxelSize disminuye MUY LENTAMENTE
                float minVoxelSize = 4.5;  // 🧬 RESOLUCIÓN FINAL GIGANTESCA (el triple: 1.5 * 3)
                float maxVoxelSize = 24.0; // 🧬 VOXELES INICIALES MONSTRUOSOS (el triple: 8.0 * 3)
                
                // 🧬 CURVA SÚPER LENTA: mantiene blocky el 80% del tiempo
                float slowProgress = progress * progress * progress; // Curva cúbica = muy lenta
                slowProgress = slowProgress * 0.6; // Solo usar 60% del rango para cambiar más lento
                
                float currentVoxelSize = mix(maxVoxelSize, minVoxelSize, slowProgress);
                
                // 🧬 EFECTO VOXELIZADO MUY VISIBLE
                vec3 voxelPos = floor(vPosition / currentVoxelSize) * currentVoxelSize;
                
                // 🧬 CREAR BORDES DE VOXEL SÚPER MARCADOS 
                vec3 voxelCenter = voxelPos + currentVoxelSize * 0.5;
                vec3 distanceFromCenter = abs(vPosition - voxelCenter);
                float edgeDistance = max(max(distanceFromCenter.x, distanceFromCenter.y), distanceFromCenter.z);
                float voxelEdge = smoothstep(currentVoxelSize * 0.2, currentVoxelSize * 0.4, edgeDistance); // Bordes más gruesos
                
                // 🧬 COLORES VOXEL MUY CONTRASTANTES
                float voxelNoise = sin(voxelPos.x * 5.0) * sin(voxelPos.y * 5.0) * sin(voxelPos.z * 5.0);
                
                // 🧬 COLORES VOXEL MUY DRAMÁTICOS
                float distanceToScanline = abs(vWorldPosition.y - scanlineY);
                float glowIntensity = 1.0 - smoothstep(0.0, 0.5, distanceToScanline);
                
                // 🧬 COLORES VOXEL ALTERNADOS (como bloques de Minecraft)
                float voxelColorCode = mod(voxelPos.x + voxelPos.y + voxelPos.z, 3.0);
                vec3 voxelColor1 = vec3(0.2, 0.8, 1.0); // Cyan biomédico
                vec3 voxelColor2 = vec3(1.0, 0.3, 0.8); // Rosa biomédico  
                vec3 voxelColor3 = vec3(0.8, 1.0, 0.2); // Verde biomédico
                
                vec3 baseVoxelColor = voxelColor1;
                if (voxelColorCode < 1.0) baseVoxelColor = voxelColor1;
                else if (voxelColorCode < 2.0) baseVoxelColor = voxelColor2;
                else baseVoxelColor = voxelColor3;
                
                // 🧬 EFECTO DE BRILLO EN LA SCANLINE
                vec3 glowColor = vec3(1.0, 1.0, 1.0); // Blanco brillante
                vec3 finalColor = mix(baseVoxelColor, glowColor, glowIntensity * 0.8);
                
                // 🧬 INTENSIDAD DE VOXEL SE MANTIENE CASI SIEMPRE
                float voxelIntensity = 1.0 - progress * 0.1; // Mantener blocky casi todo el tiempo
                
                // 🧬 BORDES DE VOXEL SÚPER DRAMÁTICOS
                finalColor = mix(finalColor * 0.1, finalColor, voxelEdge); // Oscurecer bordes mucho más
                
                float voxelAlpha = 0.9 + voxelNoise * 0.3 * voxelIntensity;
                
                gl_FragColor = vec4(finalColor, voxelAlpha * opacity);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    // 🧬 APLICAR EL MATERIAL VOXEL A TODOS LOS MESHES DEL MODELO
    console.log("🧬 Aplicando material voxel a todos los meshes...");
    
    // Función recursiva para aplicar material a todos los meshes
    function applyVoxelMaterialToModel(object) {
        if (object.isMesh && object.geometry) {
            console.log("🧬 Aplicando material voxel a mesh:", object.name || "sin nombre");
            // Guardar material original si no existe
            if (!object.originalMaterial) {
                object.originalMaterial = object.material;
            }
            // Aplicar material voxel
            object.material = voxelShaderMaterial.clone(); // Clonar para cada mesh
        }
        
        // Aplicar recursivamente a todos los hijos
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => {
                applyVoxelMaterialToModel(child);
            });
        }
    }
    
    // Aplicar a todo el modelo
    applyVoxelMaterialToModel(model);
    
    // Guardar referencia al shader principal
    model.homoPrintempsShader = voxelShaderMaterial;
    
    console.log("🧬 Efecto voxel aplicado al modelo");
}

function updateModelVoxelReveal(targetPanel, scanlineY, time, progress = 0.0) {
    // Actualizar el shader del modelo con la posición actual de la scanline
    if (targetPanel.homoPrintempsModel) {
        
        // 🧬 CALCULAR PROGRESO BASADO EN LA POSICIÓN DE LA SCANLINE
        const modelBbox = targetPanel.homoPrintempsBbox;
        const panelHeight = targetPanel.homoPrintempsPanelHeight;
        
        if (modelBbox && panelHeight) {
            // 🧬 USAR EL RANGO COMPLETO DEL PANEL PARA EL PROGRESO
            const panelBottom = -panelHeight / 2;
            const panelTop = panelHeight / 2;
            const scanlineProgress = Math.max(0, Math.min(1, 
                (scanlineY - panelBottom) / (panelTop - panelBottom)
            ));
            progress = scanlineProgress;
            
            // Debug mejorado
            if (Date.now() % 2000 < 20) {
                console.log("🧬 PROGRESO VOXEL:", {
                    scanlineY: scanlineY,
                    panelBottom: panelBottom,
                    panelTop: panelTop,
                    progress: progress,
                    modelBbox: { min: modelBbox.min.y, max: modelBbox.max.y }
                });
            }
        }
        
        // 🧬 ACTUALIZAR TODOS LOS SHADERS VOXEL DEL MODELO
        function updateVoxelShader(object) {
            if (object.isMesh && object.material && 
                object.material.uniforms && object.material.uniforms.scanlineY) {
                
                // Actualizar uniforms del shader voxel
                object.material.uniforms.scanlineY.value = scanlineY;
                object.material.uniforms.time.value = time;
                object.material.uniforms.progress.value = progress;
            }
            
            // Aplicar recursivamente a todos los hijos
            if (object.children && object.children.length > 0) {
                object.children.forEach(child => {
                    updateVoxelShader(child);
                });
            }
        }
        
        // Aplicar actualización a todo el modelo
        updateVoxelShader(targetPanel.homoPrintempsModel);
        
        // Debug ocasional
        if (Date.now() % 1000 < 20) {
            console.log("🧬 Actualizando revelado voxel - ScanlineY:", scanlineY, "Progress:", progress);
        }
    }
}

function handleStatgCommand(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para mostrar las estadísticas genómicas', output);
        return;
    }
    
    if (selectedPanels.length > 1) {
        showError('Seleccione solo un panel para mostrar las estadísticas genómicas', output);
        return;
    }
    
    const panel = selectedPanels[0];
    
    // 🔥 OBTENER MODELO AUTOMÁTICAMENTE DEL ÚLTIMO CLICKEADO EN MODELS
    let modelName;
    
    if (args.length > 0) {
        // Si se especifica un modelo manualmente, usarlo (retrocompatibilidad)
        modelName = args[0].toLowerCase();
        console.log(`📋 Usando modelo especificado manualmente: ${modelName}`);
    } else {
        // Usar el último modelo clickeado desde la rejilla models
        modelName = lastClickedModelFromGrid.name;
        console.log(`📋 Usando último modelo clickeado desde rejilla models: ${modelName}`);
        
        if (!modelName || modelName === 'corazon') {
            showInfo(`Usando modelo por defecto: ${modelName}. Para cambiar, haz click en un modelo de la rejilla 'models' primero.`, output);
        } else {
            showInfo(`Cargando estadísticas del modelo seleccionado: ${modelName}`, output);
        }
    }
    const currentGridParams = getCurrentGridParams();
    
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Base de datos de estadísticas genómicas por modelo
    const genomicStats = {
        corazon: {
            species: "Homo sapiens (Corazón Humano)",
            chromosomes: "23 pares (2n=46)",
            genomeSize: "3.2 Gb",
            genes: "20,687 genes codificantes",
            proteins: "20,430 proteínas únicas",
            gcContent: "41%",
            repetitiveElements: "45%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,881 tRNA, 45 rRNA",
            functionalDomains: "Contracción cardíaca, Conducción eléctrica, Metabolismo energético",
            mutations: "SNPs: 4.3M, Indels: 0.6M",
            phylogeny: "Primates, Familia Hominidae",
            biomedical: "Cardiomiopatías, arritmias, insuficiencia cardíaca, modelos de regeneración"
        },
        hueso: {
            species: "Homo sapiens (Tejido Óseo)",
            chromosomes: "23 pares (2n=46)",
            genomeSize: "3.2 Gb",
            genes: "20,687 genes codificantes",
            proteins: "20,430 proteínas únicas",
            gcContent: "41%",
            repetitiveElements: "45%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,881 tRNA, 45 rRNA",
            functionalDomains: "Osteogénesis, Remodelación ósea, Homeostasis del calcio",
            mutations: "SNPs: 4.3M, Indels: 0.6M",
            phylogeny: "Primates, Familia Hominidae",
            biomedical: "Osteoporosis, Fracturas, Displasia ósea"
        },
        axolotl: {
            species: "Ambystoma mexicanum",
            chromosomes: "14 pares (2n=28)",
            genomeSize: "32.4 Gb",
            genes: "23,251 genes codificantes",
            proteins: "22,472 proteínas únicas",
            gcContent: "27.8%",
            repetitiveElements: "65.8%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "2,341 tRNA, 45 rRNA",
            functionalDomains: "Regeneración de extremidades, Neotenia, Cicatrización",
            mutations: "SNPs: 45.7M, Indels: 3.8M",
            phylogeny: "Anfibios, Familia Ambystomatidae",
            biomedical: "Medicina regenerativa, Cicatrización de heridas"
        },
        discus: {
            species: "Symphysodon discus",
            chromosomes: "24 pares (2n=48)",
            genomeSize: "0.9 Gb",
            genes: "28,644 genes codificantes",
            proteins: "26,735 proteínas únicas",
            gcContent: "40.8%",
            repetitiveElements: "28.4%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,523 tRNA, 45 rRNA",
            functionalDomains: "Navegación acuática, Coloración, Cuidado parental",
            mutations: "SNPs: 12.4M, Indels: 1.1M",
            phylogeny: "Perciformes, Familia Cichlidae",
            biomedical: "Modelos de comportamiento social"
        },
        dog: {
            species: "Canis lupus familiaris",
            chromosomes: "39 pares (2n=78)",
            genomeSize: "2.41 Gb",
            genes: "19,856 genes codificantes",
            proteins: "19,074 proteínas únicas",
            gcContent: "41.5%",
            repetitiveElements: "31.2%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,334 tRNA, 45 rRNA",
            functionalDomains: "Olfato avanzado, Comunicación social, Domesticación",
            mutations: "SNPs: 58.6M, Indels: 4.2M",
            phylogeny: "Carnívoros, Familia Canidae",
            biomedical: "Modelos de cáncer, epilepsia, cardiomiopatía"
        },
        acot: {
            species: "Acotylosaurus arcuatus",
            chromosomes: "18 pares (2n=36)",
            genomeSize: "1.8 Gb",
            genes: "21,334 genes codificantes",
            proteins: "20,156 proteínas únicas",
            gcContent: "38.9%",
            repetitiveElements: "42.1%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,567 tRNA, 45 rRNA",
            functionalDomains: "Metabolismo herbívoro, Defensa corporal",
            mutations: "SNPs: 28.9M, Indels: 2.3M",
            phylogeny: "Dinosauria, Familia Nodosauridae",
            biomedical: "Paleogenómica, Evolución de armaduras"
        },
        tort: {
            species: "Chelonia mydas (Tortuga Verde)",
            chromosomes: "26 pares (2n=52)",
            genomeSize: "2.24 Gb",
            genes: "21,796 genes codificantes",
            proteins: "20,623 proteínas únicas",
            gcContent: "42.3%",
            repetitiveElements: "39.7%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,445 tRNA, 45 rRNA",
            functionalDomains: "Longevidad extrema, Navegación magnética, Caparazón",
            mutations: "SNPs: 35.2M, Indels: 2.7M",
            phylogeny: "Reptilia, Familia Cheloniidae",
            biomedical: "Estudios de longevidad, resistencia a cáncer"
        },
        ham: {
            species: "Sus scrofa (Jamón de Cerdo)",
            chromosomes: "19 pares (2n=38)",
            genomeSize: "2.8 Gb",
            genes: "21,640 genes codificantes",
            proteins: "20,823 proteínas únicas",
            gcContent: "42.1%",
            repetitiveElements: "38.5%",
            mitochondrialGenes: "37 genes",
            rnaGenes: "1,789 tRNA, 45 rRNA",
            functionalDomains: "Metabolismo lipídico, Desarrollo muscular, Producción cárnica",
            mutations: "SNPs: 8.9M, Indels: 1.2M",
            phylogeny: "Artiodáctilos, Familia Suidae",
            biomedical: "Xenotrasplantes, modelos de obesidad, investigación nutricional"
        },
                 pollo: {
             species: "Gallus gallus domesticus",
             chromosomes: "39 pares (2n=78)",
             genomeSize: "1.23 Gb",
             genes: "20,867 genes codificantes",
             proteins: "17,954 proteínas únicas",
             gcContent: "41.2%",
             repetitiveElements: "9.7%",
             mitochondrialGenes: "37 genes",
             rnaGenes: "1,234 tRNA, 45 rRNA",
             functionalDomains: "Producción de huevos, Metabolismo rápido, Vuelo limitado",
             mutations: "SNPs: 19.8M, Indels: 1.4M",
             phylogeny: "Aves, Familia Phasianidae",
             biomedical: "Modelos de desarrollo embrionario, vacunas aviares"
         }
    };
    
    // Verificar si el modelo existe
    if (!genomicStats[modelName]) {
        showError(`Modelo '${modelName}' no encontrado. Modelos disponibles: ${Object.keys(genomicStats).join(', ')}`, output);
        return;
    }
    
    const stats = genomicStats[modelName];
    
    // Marcar el panel como contenedor de texto y estadísticas genómicas
    panel.hasText = true;
    panel.isStatgPanel = true; // NUEVO: Identificar como panel de estadísticas genómicas
    panel.statgModelName = modelName; // NUEVO: Guardar el modelo actual
    
    // Crear o actualizar el contenedor de texto
    createPanelText(panel, currentGridParams.cellSize);
    
    // Generar el texto de estadísticas genómicas
    const statsText = `ESTADÍSTICAS GENÓMICAS - ${modelName.toUpperCase()}

═══════════════════════════════════════════════════════════

INFORMACIÓN TAXONÓMICA
Especie: ${stats.species}
Filogenia: ${stats.phylogeny}

ARQUITECTURA GENÓMICA
Cromosomas: ${stats.chromosomes}
Tamaño del genoma: ${stats.genomeSize}
Contenido GC: ${stats.gcContent}
Elementos repetitivos: ${stats.repetitiveElements}

ANOTACIÓN GÉNICA
Genes codificantes: ${stats.genes}
Proteínas únicas: ${stats.proteins}
Genes mitocondriales: ${stats.mitochondrialGenes}
Genes de RNA: ${stats.rnaGenes}

VARIACIÓN GENÉTICA
Mutaciones: ${stats.mutations}

DOMINIOS FUNCIONALES
${stats.functionalDomains}

APLICACIONES BIOMÉDICAS
${stats.biomedical}

═══════════════════════════════════════════════════════════
Datos generados por BioPrint Genomics Suite v2.1
Actualizado: ${new Date().toLocaleDateString('es-ES')}`;
    
    // Establecer el texto en el panel
    setPanelText(panel, statsText, currentGridParams.cellSize);
    
    showSuccess(`Estadísticas genómicas de ${modelName} (${stats.species}) cargadas en el panel seleccionado`, output);
    
    // Mostrar resumen en la terminal
    const summaryDiv = document.createElement('div');
    summaryDiv.innerHTML = `
        <br>📊 Resumen para ${stats.species}:
        <br>🧬 Cromosomas: ${stats.chromosomes}
        <br>💾 Genoma: ${stats.genomeSize}
        <br>🔬 Genes: ${stats.genes}
        <br>🎯 Especialización: ${stats.functionalDomains.split(',')[0]}
    `;
    output.appendChild(summaryDiv);
}
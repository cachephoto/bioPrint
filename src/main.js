import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { 
    initPanelText, 
    createPanelText, 
    handleTextInput, 
    startTextEditing, 
    stopTextEditing, 
    setPanelText, 
    updatePanelText,
    cleanupPanelText 
} from './panelText.js';
import { initBioFX, setColorEffect, render as renderBioFX, setBloomEffect } from './bioFX.js';
import { animateModels, loadModelToPanel, cleanupPanelModels, toggleModelRotation, setModelRotationSpeed, preserveModel, restoreModel } from './panelModel.js';
import { loadGenomToPanel, animateGenoms, cleanupGenomModels, loadGTACToPanel } from './genomModel.js';

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

            // Cargar la configuración guardada después de que termine la animación
            setTimeout(() => {
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
        opacity: visible ? 0.5 : 0,
        transparent: true
    });
    
    const centerLineMaterial = new THREE.LineBasicMaterial({
        color: color,
        opacity: visible ? 1 : 0,
        transparent: true
    });
    
    const borderMaterial = new THREE.LineBasicMaterial({
        color: color,
        opacity: visible ? 0.5 : 0,
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
        bioFXPanel
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
const panels = []; // Almacenar objetos de panel: { mesh, minCellIndex, maxCellIndex, selected, hovered }

// Materiales para los paneles (Mesh - ahora obsoletos, los dejamos por si acaso)
/* ... MeshMaterials ... */

// NUEVO: Materiales de LÍNEA para los paneles (Escala de Grises)
const panelLineMaterialNormal = new THREE.LineBasicMaterial({ 
    color: 0xaaaaaa, // Gris medio
    linewidth: 1 // Nota: linewidth no funciona en WebGL
});
const panelLineMaterialHover = new THREE.LineBasicMaterial({ 
    color: 0xcccccc, // Gris claro
    linewidth: 1
});
const panelLineMaterialSelected = new THREE.LineBasicMaterial({ 
    color: 0xffffff, // Blanco
    linewidth: 2 // Más grueso al seleccionar
});

// NUEVO: Materiales de RELLENO para los paneles (Escala de Grises)
const panelFillMaterialNormal = new THREE.MeshBasicMaterial({ 
    color: 0xaaaaaa, // Gris medio
    transparent: true, 
    opacity: 0.2, // Más transparente que las líneas
    side: THREE.DoubleSide 
});
const panelFillMaterialHover = new THREE.MeshBasicMaterial({ 
    color: 0xcccccc, // Gris claro
    transparent: true, 
    opacity: 0.3, 
    side: THREE.DoubleSide 
});
const panelFillMaterialSelected = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, // Blanco
    transparent: true, 
    opacity: 0.4, 
    side: THREE.DoubleSide 
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
    touchStartTime = currentTime;
    
    // Detectar doble tap
    const timeSinceLastTap = currentTime - lastTapTime;
    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
        // Es un doble tap
        const touch = event.touches[0];
        const mouse = new THREE.Vector2(
            (touch.clientX / window.innerWidth) * 2 - 1,
            -(touch.clientY / window.innerHeight) * 2 + 1
        );
        
        raycaster.setFromCamera(mouse, camera);
        
        // Recopilar todos los objetos seleccionables
        const allSelectable = [];
        const allFillMeshes = panels.map(p => p.fillMesh).filter(Boolean);
        const allBorderLines = panels.flatMap(p => p.borderLines || []).filter(Boolean);
        allSelectable.push(...allFillMeshes, ...allBorderLines);
        
        const intersects = raycaster.intersectObjects(allSelectable, false);
        
        if (intersects.length > 0) {
            // Encontrar el panel correspondiente
            let currentObject = intersects[0].object;
            let panelData = null;
            
            // Buscar el panel en la jerarquía
            while (currentObject && !panelData) {
                if (currentObject.userData && currentObject.userData.panelDataRef) {
                    panelData = currentObject.userData.panelDataRef;
                    break;
                }
                currentObject = currentObject.parent;
            }
            
            if (panelData) {
                // Iniciar animación de flash
                panelData.flashProgress = 0;
                panelData.shouldFlash = true;
                panelsFlashing.add(panelData);
                
                // Seleccionar el panel
                if (!event.shiftKey) {
                    // --- Shift + Click: Añadir/Quitar de la selección --- 
                    clickedPanelData.selected = !clickedPanelData.selected; 
                    updatePanelColor(clickedPanelData);
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
        
        // Resetear el tiempo del último tap
        lastTapTime = 0;
    } else {
        // Guardar el tiempo del tap para detectar el siguiente
        lastTapTime = currentTime;
    }
    
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
    // Ignorar atajos de teclado si la terminal está visible, excepto Escape
    if (terminalVisible && event.key !== 'Escape') {
        return;
    }

    let newDivisions = currentDivisions;
    let resolutionChanged = false;
    let moveDelta = { dx: 0, dy: 0 };
    let deleteTriggered = false;

    switch (event.key) {
        case '+':
        case '=': // Tecla '+' a menudo comparte con '='
            newDivisions = Math.min(currentDivisions + 1, 50);
            resolutionChanged = true;
            break;
        case '-':
        case '_': // Tecla '-' a menudo comparte con '_'
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
        case 'Delete': // Añadir tecla Supr
            deleteTriggered = true;
            break;
        case 'c':
        case 'C':
            // Limpiar TODOS los paneles
            clearAllPanels();
            return;
        case 'a':
        case 'A':
            // Centrar grid en la cámara
            centerGridInCamera();
            return;
        case 'v':
        case 'V':
            // Alternar visibilidad de controles
            toggleControlsVisibility();
            return;
        case 't':
        case 'T':
            // Mostrar u ocultar la consola terminal
            event.preventDefault(); // Prevenir el comportamiento por defecto
            toggleTerminal(true);
            return;
        case 'Escape':
            // Mostrar u ocultar la consola terminal
            toggleTerminal(false);
            return;
    }

    // --- Procesar Cambio de Resolución --- 
    if (resolutionChanged && newDivisions !== currentDivisions) {
        // NO eliminamos los grupos de paneles de la escena aquí.
        // updateGrid se encargará de actualizar su contenido y posición.
        updateGrid(newDivisions); 
    }
    
    // --- Procesar Movimiento --- 
    else if (moveDelta.dx !== 0 || moveDelta.dy !== 0) {
        const selectedPanels = panels.filter(p => p.selected);
        if (selectedPanels.length > 0) {
            const currentGridParams = getCurrentGridParams();
            if (!currentGridParams) return;

            // Comprobar si TODOS los paneles seleccionados pueden moverse
            let canMoveAll = true;
            for (const panel of selectedPanels) {
                if (checkPanelMoveConflict(panel, moveDelta.dx, moveDelta.dy, currentGridParams)) {
                    canMoveAll = false;
                    break;
                }
            }

            // Si todos pueden moverse, actualizar sus índices y geometría/posición
            if (canMoveAll) {
                selectedPanels.forEach(panel => {
                    panel.minCellIndex.x += moveDelta.dx;
                    panel.maxCellIndex.x += moveDelta.dx;
                    panel.minCellIndex.y += moveDelta.dy;
                    panel.maxCellIndex.y += moveDelta.dy;
                    updatePanelGeometryAndPosition(panel, currentGridParams); // Actualizar mesh
                });
            } else {
                 console.warn("Movimiento cancelado: Conflicto de límites o colisión.");
            }
        }
    }

    // --- Procesar Borrado --- 
    else if (deleteTriggered) {
        const remainingPanels = [];
        let deletedSomething = false;
        panels.forEach(panel => {
            if (panel.selected) {
                if(panel.group) {
                    scene.remove(panel.group);
                    // Limpiar geometrías de los hijos (líneas)
                    while(panel.group.children.length > 0){
                         const child = panel.group.children[0]; 
                         panel.group.remove(child);
                         if (child.geometry) child.geometry.dispose();
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
            panels.length = 0; 
            panels.push(...remainingPanels); 
        }
    }

    // Desactivar snap to grid mientras se presiona Shift durante arrastre
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
    const currentGridParams = getCurrentGridParams(); // Obtener parámetros actuales
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

    // Crear el objeto panel (sin mesh ni group inicial)
    const panelData = {
        group: null, // Usaremos group en lugar de mesh
        minCellIndex: { x: pMinX, y: pMinY },
        maxCellIndex: { x: pMaxX, y: pMaxY },
        orderNumber: panelOrderCounter++, // Asignar número de orden
        showOrderNumber: false, // Por defecto, ocultar el número
        hasText: false // Nuevo flag para indicar si el panel tiene texto
    };

    // Calcular y asignar geometría/posición inicial (ahora crea el group y líneas)
    updatePanelGeometryAndPosition(panelData, currentGridParams);

    if(panelData.group) { // Comprobar si el grupo se creó
        scene.add(panelData.group); // Añadir el grupo a la escena
        panels.push(panelData); // Almacenar el objeto completo
        
        // Seleccionar el nuevo panel
        panelData.selected = true;
        updatePanelColor(panelData);
        
        // El flash ya se inicia en updatePanelGeometryAndPosition
        
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
    }
    
    // Solo crear etiqueta si showOrderNumber es true
    if (panelData.showOrderNumber) {
        // Crear canvas para la etiqueta
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        // Estilo del número
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.font = 'bold 40px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(panelData.orderNumber.toString(), canvas.width/2, canvas.height/2);
        
        // Crear textura y sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Ajustar tamaño y posición
        sprite.scale.set(0.2, 0.2, 1);
        sprite.position.set(0, 0, 0.02); // Ligeramente por encima del panel
        
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
            if (child === panelData.fillMesh) {
                 delete panelData.fillMesh;
            }
        }
        panelData.borderLines = []; // Resetear array para nuevas líneas
        delete panelData.orderLabel; // Eliminar referencia a la etiqueta eliminada
    }

    // Asegurarnos de que se mantenga el número de orden y estado del texto
    panelData.orderNumber = orderNumber;
    panelData.showOrderNumber = showOrderNumber;
    panelData.hasText = hasText;

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
    
    // Recrear etiqueta de número de orden si es necesario
    if (showOrderNumber) {
        createPanelOrderLabel(panelData);
    }
    
    // Solo actualizar el texto si el panel ya tenía texto
    if (hasText) {
        createPanelText(panelData, gridParams.cellSize);
    }
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

    if (panelData.selected) {
        targetLineMaterial = panelLineMaterialSelected;
        targetFillMaterial = panelFillMaterialSelected;
    } else if (panelData.hovered) {
        targetLineMaterial = panelLineMaterialHover;
        targetFillMaterial = panelFillMaterialHover;
    } else {
        targetLineMaterial = panelLineMaterialNormal;
        targetFillMaterial = panelFillMaterialNormal;
    }

    // Aplicar el material a todas las líneas dentro del grupo
    panelData.group.children.forEach(child => {
        if (child instanceof THREE.Line) {
            child.material = targetLineMaterial;
        } 
        // Aplicar al mesh de relleno si existe
        else if (child === panelData.fillMesh) { 
             child.material = targetFillMaterial;
        }
    });

    // Guardar referencia a materiales actuales para animación de flash
    panelData.currentLineMaterial = targetLineMaterial;
    panelData.currentFillMaterial = targetFillMaterial;
}

// Event listeners para selección
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
                // Guardar la posición inicial del mouse ahora
                const mouseStartPosition = { 
                    x: event.clientX, 
                    y: event.clientY 
                };
                
                // Guardar posición inicial del panel
                const panelStartPosition = { 
                    x: clickedPanelData.group.position.x, 
                    y: clickedPanelData.group.position.y 
                };
                
                // Guardar índices de celda iniciales
                const cellStartIndices = {
                    minX: clickedPanelData.minCellIndex.x,
                    minY: clickedPanelData.minCellIndex.y,
                    maxX: clickedPanelData.maxCellIndex.x,
                    maxY: clickedPanelData.maxCellIndex.y
                };
                
                // Procesar la selección de inmediato (no se espera para esto)
                if (event.shiftKey) {
                    // --- Shift + Click: Añadir/Quitar de la selección --- 
                    clickedPanelData.selected = !clickedPanelData.selected; 
                    updatePanelColor(clickedPanelData);
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
                
                // Configurar temporizador para iniciar el arrastre después del retraso
                // Cancelar cualquier temporizador existente primero
                if (dragStartTimer) {
                    clearTimeout(dragStartTimer);
                }
                
                // Guardar panel potencial para arrastrar
                potentialDragPanel = clickedPanelData;
                
                // Iniciar nuevo temporizador
                dragStartTimer = setTimeout(() => {
                    // Si todavía está presionado el botón del mouse después del retraso,
                    // iniciar el arrastre
                    if (potentialDragPanel) {
                        draggedPanel = potentialDragPanel;
                        isDraggingPanel = true;
                        
                        // Transferir valores guardados
                        dragStartPosition = mouseStartPosition;
                        dragStartPanelPosition = panelStartPosition;
                        dragStartCellIndices = cellStartIndices;
                        
                        // Cambiar cursor para indicar arrastre activo
                        renderer.domElement.style.cursor = 'move';
                    }
                }, dragStartDelay);
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
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) return null;
    
    const { width, height } = calculateGridSize();
    
    // Serializar los paneles con su comportamiento
    const serializedPanels = panels.map((panel, index) => {
        return {
            minCellIndex: { ...panel.minCellIndex },
            maxCellIndex: { ...panel.maxCellIndex },
            orderNumber: panel.orderNumber,
            showOrderNumber: panel.showOrderNumber,
            selected: panel.selected,
            behavior: {
                hasText: panel.hasText || false,
                textContent: panel.textContent || '',
                messageBuffer: panel.messageBuffer || [],
                maxLines: panel.maxLines,
                isGATCActive: gatcIntervals.has(panel),
                modelData: panel.modelData ? {
                    modelUrl: panel.modelData.url,
                    isRotating: panel.modelData.isRotating,
                    rotationSpeed: panel.modelData.rotationSpeed
                } : null
            }
        };
    });
    
    return {
        grid: {
            divisions: currentDivisions,
            size: {
                width: width,
                height: height,
                maxSize: 24, // El tamaño base del grid
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
        date: new Date().toISOString()
    };
}

function saveConfiguration() {
    try {
        // Obtener la configuración actual
        const config = getSerializableConfig();
        if (!config) {
            console.error('No se pudo obtener la configuración para guardar');
            return;
        }
        
        // Guardar la configuración
        const configString = JSON.stringify(config);
        localStorage.setItem('gridConfig', configString);
        
        // Guardar backup
        localStorage.setItem('gridConfig_backup', configString);
        
        // Verificar que se guardó correctamente
        const savedConfig = localStorage.getItem('gridConfig');
        if (!savedConfig) {
            console.error('Error: La configuración no se guardó correctamente');
            return;
        }

        // Verificar que los datos guardados son correctos
        const parsedSavedConfig = JSON.parse(savedConfig);
        if (!parsedSavedConfig.grid || !parsedSavedConfig.panels) {
            console.error('Error: Los datos guardados están incompletos');
            return;
        }

        console.log('Configuración guardada exitosamente:', {
            divisiones: parsedSavedConfig.grid.divisions,
            paneles: parsedSavedConfig.panels.length,
            fecha: parsedSavedConfig.date
        });

        // NO recargar automáticamente, solo mostrar mensaje de éxito
        console.log('Estado guardado correctamente. Use el botón de cargar para restaurar si es necesario.');

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

        const configString = localStorage.getItem('gridConfig');
        if (!configString) {
            console.log('No hay configuración guardada en localStorage.');
            return;
        }

        const config = JSON.parse(configString);
        console.log('Cargando configuración:', {
            divisiones: config.grid.divisions,
            paneles: config.panels.length,
            fecha: config.date
        });

        // Limpiar paneles actuales sin guardar la configuración
        clearAllPanels(true);

        // Actualizar la división del grid solo si es diferente
        const newDivisions = config.grid.divisions;
        if (typeof newDivisions === 'number' && newDivisions !== currentDivisions) {
            console.log(`Actualizando grid de ${currentDivisions} a ${newDivisions} divisiones`);
            currentDivisions = newDivisions;
            updateGrid(newDivisions);
        }

        // Actualizar la división del grid
        if (config.grid.divisions && typeof config.grid.divisions === 'number') {
            console.log(`Restaurando grid a ${config.grid.divisions} divisiones`);
            currentDivisions = config.grid.divisions;
            updateGrid(config.grid.divisions);
        } else {
            console.log('No se encontró el número de divisiones en la configuración, usando valor actual');
            updateGrid(currentDivisions);
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
        
        // Recrear paneles
        requestAnimationFrame(() => {
            const currentGridParams = getCurrentGridParams();
            if (!currentGridParams) {
                console.error("No se pudieron obtener los parámetros del grid después de cargar.");
                return;
            }

            // Verificar que los parámetros del grid coincidan
            if (config.grid.size) {
                const loadedSize = config.grid.size;
                const currentSize = calculateGridSize();
                console.log('Tamaño del grid cargado:', loadedSize);
                console.log('Tamaño del grid actual:', currentSize);
            }

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
                            panelData.textContent = panelInfo.behavior.textContent;
                            panelData.messageBuffer = panelInfo.behavior.messageBuffer;
                            panelData.maxLines = panelInfo.behavior.maxLines;
                            if (panelData.textContent) {
                                setPanelText(panelData, panelData.textContent, currentGridParams.cellSize);
                            }
                        }

                        if (panelInfo.behavior.isGATCActive) {
                            handleGATCCommand({ appendChild: () => {} }, panelData);
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
                    }

                    // Restaurar selección
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
    }
}

// Función para descargar la configuración actual como archivo JSON
function downloadConfiguration() {
    const configData = getSerializableConfig();
    if (!configData) return;
    
    const jsonData = JSON.stringify(configData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bioPrint_config_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
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
        const borderOpacity = THREE.MathUtils.lerp(0, gridAnimationProps.borderOpacity, gridAnimationProgress);
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
    // Paso 1: Mostrar subdivisiones
    else if (gridAnimationStep === 1) {
        gridAnimationProgress += 0.03;
        
        // Aumentar la opacidad de las líneas internas gradualmente
        const linesOpacity = THREE.MathUtils.lerp(0, 1, gridAnimationProgress);
        linesGroup.children.forEach(line => {
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
        if (!panelData.isResizing || !panelData.group) {
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
            });
        }
        
        // Finalizar animación después de 1 ciclo completo (más rápido)
        if (panelData.flashProgress >= 1) { // Reducido de 2 a 1
            panelData.shouldFlash = false;
            panelsToRemove.push(panelData);
            
            // Restaurar materiales originales
            updatePanelColor(panelData);
        }
    });
    
    // Limpiar paneles que ya no están en animación
    panelsToRemove.forEach(panel => {
        panelsFlashing.delete(panel);
    });
}

// Función para centrar el grid en la cámara con una animación suave
function centerGridInCamera() {
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
function clearAllPanels(skipSave = false) {
    // Limpiar paneles de la escena
    panels.forEach(panel => {
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
    });

    // Limpiar arrays y estados
    panels.length = 0;
    currentlyHoveredPanel = null;
    panelOrderCounter = 1;

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
}

// Inicializar la interfaz de usuario después de cargar
window.addEventListener('load', () => {
    initTerminalConsole();
    controlsVisible = false;
    toggleControlPanels(false);
});

// Por si el documento ya está cargado
if (document.readyState === 'complete') {
    initTerminalConsole();
    controlsVisible = false;
    toggleControlPanels(false);
}

// Inicialización de la consola terminal
function initTerminalConsole() {
    const terminalInput = document.getElementById('terminal-input');
    if (!terminalInput) return;
    
    terminalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const command = terminalInput.value.trim();
            if (command) {
                processTerminalCommand(command);
                terminalInput.value = '';
            }
            event.preventDefault();
        } else if (event.key === 'Escape') {
            // Ocultar la consola con Escape
            toggleTerminal(false);
            event.preventDefault();
        }
    });
    
    // Iniciar con un mensaje de bienvenida
    const output = document.getElementById('terminal-output');
    if (output) {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.innerHTML = 'Consola de bioPrint. Escribe <b>help</b> para ver los comandos disponibles.';
        output.appendChild(welcomeDiv);
    }
}

// Función para cargar configuración desde datos
function applyConfigurationFromData(configData) {
    if (!configData || !configData.grid || !configData.panels) {
        console.error("Formato de configuración inválido");
        return false;
    }
    
    // Restablecer contador de orden global
    panelOrderCounter = 1;
    
    // Limpiar los paneles actuales y sus comportamientos
    clearAllPanels();
    gatcIntervals.forEach(interval => clearInterval(interval));
    gatcIntervals.clear();
    
    // Aplicar configuración de la cuadrícula
    const gridParams = {
        cellSize: configData.grid.cellSize,
        cellsX: configData.grid.cellsX,
        cellsY: configData.grid.cellsY,
        halfWidth: (configData.grid.cellsX * configData.grid.cellSize) / 2,
        halfHeight: (configData.grid.cellsY * configData.grid.cellSize) / 2
    };
    
    // Regenerar cuadrícula
    regenerateGrid(gridParams);
    
    // Recrear los paneles con sus comportamientos
    for (const panelData of configData.panels) {
        // Crear panel base
        const panel = {
            group: null,
            minCellIndex: panelData.minCellIndex,
            maxCellIndex: panelData.maxCellIndex,
            orderNumber: panelData.orderNumber || panelOrderCounter++,
            showOrderNumber: panelData.showOrderNumber !== undefined ? panelData.showOrderNumber : false
        };
        
        // Actualizar geometría y posición
        updatePanelGeometryAndPosition(panel, gridParams);
        
        if(panel.group) {
            scene.add(panel.group);
            panels.push(panel);
            
            // Restaurar comportamiento del panel
            if (panelData.behavior) {
                // Restaurar texto
                if (panelData.behavior.hasText) {
                    panel.hasText = true;
                    panel.textContent = panelData.behavior.textContent;
                    panel.messageBuffer = panelData.behavior.messageBuffer;
                    panel.maxLines = panelData.behavior.maxLines;
                    if (panel.textContent) {
                        setPanelText(panel, panel.textContent, gridParams.cellSize);
                    }
                }
                
                // Restaurar GATC si estaba activo
                if (panelData.behavior.isGATCActive) {
                    handleGATCCommand({ 
                        appendChild: () => {}, // Mock output para la función
                        innerHTML: ''
                    }, panel);
                }
                
                // Restaurar modelo 3D si existía
                if (panelData.behavior.modelData) {
                    const { modelUrl, isRotating, rotationSpeed } = panelData.behavior.modelData;
                    loadModelToPanel(panel, modelUrl, gridParams.cellSize).then(() => {
                        if (isRotating) {
                            toggleModelRotation(panel);
                            if (rotationSpeed) {
                                setModelRotationSpeed(panel, rotationSpeed);
                            }
                        }
                    });
                }
            }
            
            // Crear etiqueta con número de orden
            createPanelOrderLabel(panel);
            
            // Restaurar selección
            if (panelData.selected) {
                panel.selected = true;
                updatePanelColor(panel);
            }
        }
    }
    
    // Actualizar contador para nuevos paneles
    if (configData.panels.length > 0) {
        const maxOrder = Math.max(...configData.panels.map(p => p.orderNumber || 0));
        panelOrderCounter = maxOrder + 1;
    }
    
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

// Función para alternar la visibilidad de los números de los paneles
function togglePanelNumbers() {
    // Recorrer todos los paneles y cambiar su propiedad showOrderNumber
    panels.forEach(panel => {
        panel.showOrderNumber = !panel.showOrderNumber;
        // Actualizar la etiqueta (crear o eliminar según corresponda)
        createPanelOrderLabel(panel);
    });
    
    // Mensaje de confirmación
    console.log(`Números de panel ${panels.length > 0 && panels[0].showOrderNumber ? 'mostrados' : 'ocultados'}`);
}

// Función para mostrar u ocultar la consola terminal
function toggleTerminal(show) {
    const terminal = document.getElementById('terminal-console');
    if (!terminal) return;
    
    terminalVisible = show !== undefined ? show : !terminalVisible;
    terminal.style.display = terminalVisible ? 'block' : 'none';
    
    if (terminalVisible) {
        // Dar foco al input cuando se muestra
        const input = document.getElementById('terminal-input');
        if (input) {
            input.focus();
            // Limpiar el input al abrir
            input.value = '';
        }
    }
}

// Función para procesar comandos de la consola
function processTerminalCommand(command) {
    const [cmd, ...args] = command.trim().split(' ');
    const output = document.getElementById('terminal-output');

    switch (cmd.toLowerCase()) {
        case 'help':
            showHelp(output);
            break;
        case 'zeng':
            setColorEffect(0x007dff, parseFloat(intensitySlider.value), parseInt(blendTypePicker.value)); // R0 G125 B255
            showSuccess('Efecto Zeng activado', output);
            break;
        case 'boris':
            setColorEffect(0x00ff87, parseFloat(intensitySlider.value), parseInt(blendTypePicker.value));
            showSuccess('Efecto Boris activado', output);
            break;
        case 'select':
            selectPanels(args, output);
            break;
        case 'show':
            showPanelNumbers(true, output);
            break;
        case 'hide':
            showPanelNumbers(false, output);
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
        case 'txt':
            handleTextCommand(args, output);
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
        case 'splice':
            handleSpliceCommand(output);
            break;
        default:
            showError(`Comando desconocido: ${cmd}. Escribe 'help' para ver comandos disponibles.`, output);
    }
    
    // Scroll al final
    output.scrollTop = output.scrollHeight;
}

// Funciones auxiliares para los comandos
function showHelp(output) {
    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = `
        <div><b>Comandos Disponibles:</b></div>
        
        <div style="margin-top: 10px;"><b>Paneles:</b></div>
        - select [all|number|range] - Selecciona paneles (ej: select 1-3,5,7)
        - show - Muestra números de panel
        - hide - Oculta números de panel
        - list - Lista todos los paneles
        - delete [all|selected|number] - Elimina paneles
        - clear - Limpia todos los paneles
        
        <div style="margin-top: 10px;"><b>Modelos 3D:</b></div>
        - model [nombre] - Carga un modelo en el panel seleccionado
        - model rotate - Alterna la rotación del modelo
        - model speed [0.001-0.1] - Ajusta la velocidad de rotación
        
        <div style="margin-top: 10px;"><b>Texto y Secuencias:</b></div>
        - txt - Inicia modo de edición de texto en el panel seleccionado
        - txt clear - Limpia el texto del panel seleccionado
        - gtac - Activa secuencia aleatoria de GATC en el panel seleccionado
        - splice - Inicia proceso de empalme genético con barra de progreso
        
        <div style="margin-top: 10px;"><b>Visualización:</b></div>
        - grid [número] - Ajusta la resolución del grid (2-50)
        - zoom [número] - Ajusta el nivel de zoom de la cámara
        - center - Centra la vista en el grid
        - zeng - Activa efecto de color azul brillante
        - boris - Activa efecto de color verde trébol
        
        <div style="margin-top: 10px;"><b>Estados:</b></div>
        - save [1-10] - Guarda el estado actual en el slot especificado
        - load [1-10] - Carga un estado guardado
        - export - Exporta todos los estados a un archivo
        - import - Importa estados desde un archivo
        
        <div style="margin-top: 10px;"><b>Terminal:</b></div>
        - clear - Limpia la consola
        - help - Muestra esta ayuda
        - exit - Cierra la terminal
        
        <div style="margin-top: 10px;"><b>Atajos de Teclado:</b></div>
        - Ctrl - Mantener presionado para rotar vista
        - V - Mostrar/ocultar paneles de control
        - T - Abrir/cerrar terminal
        - ESC - Cerrar terminal
        - + / - - Ajustar resolución del grid
        - Flechas - Mover paneles seleccionados
        - Delete/X - Eliminar paneles seleccionados
        - C - Limpiar todos los paneles
        - A - Centrar vista
    `.replace(/\n\s+/g, '\n');
    
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
            updatePanelColor(panel);
            selected++;
        }
    });
    
    showSuccess(`${selected} paneles seleccionados`, output);
}

function showPanelNumbers(show, output) {
    panels.forEach(panel => {
        panel.showOrderNumber = show;
        createPanelOrderLabel(panel);
    });
    
    showSuccess(`Números de panel ${show ? 'mostrados' : 'ocultados'}`, output);
}

function listPanels(output) {
    if (panels.length === 0) {
        showInfo('No hay paneles en el diseño actual', output);
        return;
    }
    
    const listDiv = document.createElement('div');
    listDiv.innerHTML = `<div><b>Paneles (${panels.length}):</b></div>`;
    
    panels.forEach(panel => {
        const panelInfo = document.createElement('div');
        panelInfo.textContent = `Panel #${panel.orderNumber}: [${panel.minCellIndex.x},${panel.minCellIndex.y}] a [${panel.maxCellIndex.x},${panel.maxCellIndex.y}] - ${panel.selected ? '(Seleccionado)' : ''}`;
        listDiv.appendChild(panelInfo);
    });
    
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
        // Llamar a la función existente
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
        
        // Eliminar los paneles seleccionados
        const remainingPanels = [];
        
        panels.forEach(panel => {
            if (panel.selected) {
                if (panel.group) {
                    scene.remove(panel.group);
                    // Limpiar geometrías
                    while (panel.group.children.length > 0) {
                        const child = panel.group.children[0];
                        panel.group.remove(child);
                        if (child.geometry) child.geometry.dispose();
                    }
                }
            } else {
                remainingPanels.push(panel);
            }
        });
        
        panels.length = 0;
        panels.push(...remainingPanels);
        
        showSuccess(`${count} paneles eliminados`, output);
        return;
    }
    
    // Si llegamos aquí, args[0] es un número o lista de números
    // Se podría implementar la eliminación por número específico si se necesita
    showError('Opción no implementada: ' + args[0], output);
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

function mapLogo(args, output) {
    const selectedPanels = scene.children.filter(obj => obj.userData.isPanel && obj.userData.selected);
    
    if (selectedPanels.length === 0) {
        showError("No hay paneles seleccionados. Por favor, selecciona un panel primero.", output);
        return;
    }

    if (selectedPanels.length > 1) {
        showError("Por favor, selecciona solo un panel para mapear el logo.", output);
        return;
    }

    const panel = selectedPanels[0];
    const texture = new THREE.TextureLoader().load('img/bioprint_logo.png', function(texture) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8
        });
        
        // Guardamos el material original
        panel.userData.originalMaterial = panel.material;
        panel.material = material;
        
        showSuccess("Logo mapeado exitosamente en el panel seleccionado.", output);
    });
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
    
    showSuccess('Modo de edición de texto activado. Presione ESC para salir.', output);
}

// Exportar funciones para controlar los efectos desde la consola
window.setColorEffect = setColorEffect;

// Función para mostrar/ocultar todos los paneles de control
function toggleControlPanels(show) {
    const controlsPanel = document.getElementById('controls');
    const bioFXPanel = document.getElementById('bioFX-panel');
    
    if (show === undefined) {
        // Si no se especifica, alternar basado en el estado actual
        show = controlsPanel.style.display === 'none';
    }
    
    controlsPanel.style.display = show ? 'block' : 'none';
    bioFXPanel.style.display = show ? 'block' : 'none';
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
    
    if (hasCollision) {
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

renderer.domElement.addEventListener('touchmove', (event) => {
    event.preventDefault();
    
    if (isTwoFingerDrag && event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calcular punto medio actual
        const currentMidPoint = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
        
        // Calcular distancia actual entre dedos
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        // Si la distancia entre dedos no ha cambiado significativamente,
        // considerarlo como un drag (evitar confundir con pinch)
        const distanceChange = Math.abs(currentDistance - previousTouchDistance);
        if (distanceChange < 20) { // tolerancia de 20px
            // Simular evento de mousemove con botón derecho
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: currentMidPoint.x,
                clientY: currentMidPoint.y,
                button: 2,
                buttons: 2,
                bubbles: true,
                cancelable: true
            });
            event.target.dispatchEvent(mouseEvent);
        }
        
        previousTouchDistance = currentDistance;
        
    } else if (event.touches.length === 1) {
        const touch = event.touches[0];
        
        // Simular evento de mousemove con botón izquierdo
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true
        });
        event.target.dispatchEvent(mouseEvent);
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', (event) => {
    event.preventDefault();
    
    // Limpiar tiempos de inicio para los toques que terminaron
    Array.from(event.changedTouches).forEach(touch => {
        touchStartTimes.delete(touch.identifier);
    });
    
    if (isTwoFingerDrag) {
        // Simular evento de mouseup con botón derecho
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: twoFingerStartPosition.x,
            clientY: twoFingerStartPosition.y,
            button: 2,
            buttons: 0,
            bubbles: true,
            cancelable: true
        });
        event.target.dispatchEvent(mouseEvent);
        
        isTwoFingerDrag = false;
    } else {
        // Simular evento de mouseup con botón izquierdo
        const touch = event.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0,
            buttons: 0,
            bubbles: true,
            cancelable: true
        });
        event.target.dispatchEvent(mouseEvent);
    }
}, { passive: false });

// Añadir soporte para click derecho real del mouse
renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevenir menú contextual por defecto
    
    // Aquí puedes manejar el click derecho igual que el two-finger drag
    if (isCtrlPressed) {
        controls.enabled = true;
        controls.enableRotate = true;
        renderer.domElement.style.cursor = 'move';
        isOrbiting = true;
        
        if (orbitReturnTimeout) {
            clearTimeout(orbitReturnTimeout);
            orbitReturnTimeout = null;
        }
        returnAnimationStartTime = null;
    }
});

// Función para manejar el comando model
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
        showError('Especifique el nombre del modelo (ej: axolotl)', output);
        return;
    }
    
    const panel = selectedPanels[0];
    const modelName = args[0].toLowerCase();
    
    // Mapeo de modelos disponibles y sus rutas
    const modelPaths = {
        'axolotl': '/models/axolotl.obj',
        'dna': '/models/dna.obj',
        'protein': '/models/protein.obj',
        'cell': '/models/cell.obj',
        'virus': '/models/virus.obj',
        'bacteria': '/models/bacteria.obj'
    };

    // Verificar si el modelo existe
    if (!modelPaths[modelName]) {
        showError(`Modelo "${modelName}" no encontrado. Modelos disponibles: ${Object.keys(modelPaths).join(', ')}`, output);
        return;
    }

    const modelUrl = modelPaths[modelName];
    
    try {
        // Mostrar mensaje de carga
        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = `Cargando modelo ${modelName}...`;
        output.appendChild(loadingMessage);

        const { loadModelToPanel } = await import('./panelModel.js');
        const success = await loadModelToPanel(panel, modelUrl, currentGrid.userData.cellSize);
        
        if (success) {
            // Actualizar mensaje de carga a éxito
            loadingMessage.className = 'terminal-success';
            loadingMessage.textContent = `Modelo ${modelName} cargado exitosamente en el panel #${panel.orderNumber}`;
            
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
                isRotating: false,
                rotationSpeed: 0.01
            };
        } else {
            // Actualizar mensaje de carga a error
            loadingMessage.className = 'terminal-error';
            loadingMessage.textContent = `Error al cargar el modelo ${modelName}`;
        }
    } catch (error) {
        showError(`Error al cargar el modelo: ${error.message}`, output);
        console.error('Error detallado:', error);
    }
}

// Función para manejar la rotación del modelo
function handleModelRotation(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel con modelo para controlar la rotación', output);
        return;
    }
    
    const { toggleModelRotation } = require('./panelModel.js');
    const panel = selectedPanels[0];
    const isRotating = toggleModelRotation(panel);
    
    showSuccess(`Rotación ${isRotating ? 'activada' : 'desactivada'} para el panel #${panel.orderNumber}`, output);
}

// Función para manejar la velocidad de rotación
function handleModelSpeed(args, output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel con modelo para ajustar la velocidad', output);
        return;
    }
    
    if (args.length === 0) {
        showError('Especifique la velocidad (entre 0.001 y 0.1)', output);
        return;
    }
    
    const speed = parseFloat(args[0]);
    if (isNaN(speed) || speed < 0.001 || speed > 0.1) {
        showError('La velocidad debe estar entre 0.001 y 0.1', output);
        return;
    }
    
    const { setModelRotationSpeed } = require('./panelModel.js');
    const panel = selectedPanels[0];
    setModelRotationSpeed(panel, speed);
    
    showSuccess(`Velocidad de rotación ajustada a ${speed} para el panel #${panel.orderNumber}`, output);
}

// Función para manejar el comando genom
async function handleGenomCommand(output) {
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
    const success = await loadGenomToPanel(panel, currentGrid.userData.cellSize);
    
    if (success) {
        showSuccess(`Red de proteínas generada exitosamente en el panel #${panel.orderNumber}`, output);
    } else {
        showError('Error al generar la red de proteínas', output);
    }
}

// Variables para el sistema GATC
const gatcIntervals = new Map();
const DNA_BASES = ['G', 'A', 'T', 'C'];

function handleGATCCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para mostrar la secuencia GATC', output);
        return false;
    }
    
    const panel = selectedPanels[0];
    
    if (gatcIntervals.has(panel)) {
        clearInterval(gatcIntervals.get(panel));
    }
    
    panel.hasText = true;
    
    // Calcular dimensiones una sola vez
    const width = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
    const height = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
    const charsPerLine = Math.max(1, Math.floor(width * 1.8) - 2);
    const maxLines = Math.floor(height * 1.2);
    
    // Inicializar buffer circular
    panel.lineBuffer = Array(maxLines).fill('');
    let currentLine = '';
    let linePos = 0;
    
    function writeChar() {
        // Generar nuevo carácter
        const char = DNA_BASES[Math.floor(Math.random() * 4)];
        currentLine += char;
        
        // Si la línea está completa, agregarla al buffer
        if (currentLine.length >= charsPerLine) {
            // Desplazar líneas hacia arriba
            panel.lineBuffer.shift();
            panel.lineBuffer.push(currentLine);
            currentLine = '';
            
            // Actualizar texto visible
            const visibleText = panel.lineBuffer.join('\n');
            setPanelText(panel, visibleText, currentGrid.userData.cellSize);
        }
    }
    
    // Escribir caracteres cada 50ms
    const interval = setInterval(writeChar, 50);
    gatcIntervals.set(panel, interval);
    
    return true;
}

// Constantes para el comando splice
const SPLICE_MESSAGES = [
    "Iniciando análisis preliminar del genoma...",
    "Cargando bases de datos genómicas...",
    "Verificando integridad de secuencias...",
    "Calibrando enzimas de restricción...",
    "Analizando sitios de corte potenciales...",
    "Identificando regiones promotoras...",
    "Escaneando secuencias reguladoras...",
    "Verificando marcos de lectura abiertos...",
    "Analizando estructura secundaria...",
    "Evaluando estabilidad térmica...",
    "Calculando energía libre de Gibbs...",
    "Identificando motivos conservados...",
    "Verificando compatibilidad de codones...",
    "Analizando contenido GC...",
    "Evaluando repeticiones invertidas...",
    "Identificando elementos transponibles...",
    "Verificando secuencias palindrómicas...",
    "Analizando regiones intergénicas...",
    "Evaluando sitios de splicing...",
    "Identificando enhancers...",
    "Verificando silenciadores...",
    "Analizando islas CpG...",
    "Evaluando modificaciones epigenéticas...",
    "Identificando factores de transcripción...",
    "Verificando elementos reguladores...",
    "Analizando estructura de la cromatina...",
    "Evaluando accesibilidad del ADN...",
    "Identificando regiones hipersensibles...",
    "Verificando estados de metilación...",
    "Analizando modificaciones de histonas...",
    "Evaluando estructura nucleosomal...",
    "Identificando sitios de unión...",
    "Verificando elementos de respuesta...",
    "Analizando dominios proteicos...",
    "Evaluando interacciones moleculares...",
    "Identificando motivos estructurales...",
    "Verificando plegamiento proteico...",
    "Analizando estabilidad conformacional...",
    "Evaluando modificaciones post-traduccionales...",
    "Identificando señales de localización...",
    "Verificando topología proteica...",
    "Analizando interfaces de interacción...",
    "Evaluando especificidad de sustrato...",
    "Identificando cofactores necesarios...",
    "Verificando estado redox...",
    "Analizando balance energético...",
    "Evaluando homeostasis celular...",
    "Identificando vías metabólicas...",
    "Verificando rutas de señalización...",
    "Analizando cascadas enzimáticas...",
    "Evaluando retroalimentación...",
    "Identificando puntos de control...",
    "Verificando ciclos regulatorios...",
    "Analizando redes génicas...",
    "Evaluando expresión diferencial...",
    "Identificando patrones temporales...",
    "Verificando sincronización...",
    "Analizando coordinación celular...",
    "Evaluando respuesta al estrés...",
    "Identificando mecanismos adaptativos...",
    "Verificando plasticidad fenotípica...",
    "Analizando robustez del sistema...",
    "Evaluando redundancia funcional...",
    "Identificando vías alternativas...",
    "Verificando puntos de bifurcación...",
    "Analizando estados estables...",
    "Evaluando transiciones de fase...",
    "Identificando atractores dinámicos...",
    "Verificando estados metaestables...",
    "Analizando paisajes epigenéticos...",
    "Evaluando barreras energéticas...",
    "Identificando estados intermedios...",
    "Verificando rutas de transición...",
    "Analizando estabilidad estructural...",
    "Evaluando perturbaciones locales...",
    "Identificando efectos globales...",
    "Verificando propagación de señales...",
    "Analizando sincronización de redes...",
    "Evaluando coherencia temporal...",
    "Identificando patrones espaciales...",
    "Verificando organización tisular...",
    "Analizando arquitectura celular...",
    "Evaluando polaridad celular...",
    "Identificando gradientes morfogénicos...",
    "Verificando campos morfogenéticos...",
    "Analizando patrones de desarrollo...",
    "Evaluando especificación celular...",
    "Identificando destinos celulares...",
    "Verificando linajes celulares...",
    "Analizando diferenciación...",
    "Evaluando plasticidad celular...",
    "Identificando estados pluripotentes...",
    "Verificando reprogramación...",
    "Analizando memoria epigenética...",
    "Evaluando herencia transgeneracional...",
    "Identificando marcas epigenéticas...",
    "Verificando improntas genómicas...",
    "Analizando regulación alélica...",
    "Evaluando dosificación génica...",
    "Identificando compensación de dosis...",
    "Verificando inactivación cromosómica...",
    "Analizando territorios nucleares...",
    "Evaluando organización 3D...",
    "Identificando loops cromosómicos...",
    "Verificando dominios topológicos...",
    "Analizando compartimentos nucleares...",
    "Evaluando dinámica cromosómica...",
    "Identificando sitios de anclaje...",
    "Verificando matriz nuclear...",
    "Analizando cuerpos nucleares...",
    "Evaluando fábricas transcripcionales...",
    "Identificando territorios cromosómicos...",
    "Verificando posicionamiento nuclear...",
    "Analizando migración nuclear...",
    "Evaluando división celular...",
    "Identificando checkpoints...",
    "Verificando segregación cromosómica...",
    "Analizando citocinesis...",
    "Evaluando ciclo celular...",
    "Identificando señales mitóticas...",
    "Verificando punto de restricción...",
    "Analizando replicación del ADN...",
    "Evaluando puntos de origen...",
    "Identificando horquillas de replicación...",
    "Verificando licenciamiento...",
    "Analizando timing de replicación...",
    "Evaluando coordinación S-fase...",
    "Identificando cohesión cromosómica...",
    "Verificando condensación...",
    "Analizando estructura cromosómica...",
    "Evaluando compactación del ADN...",
    "Identificando dominios estructurales...",
    "Verificando arquitectura genómica...",
    "Analizando elementos móviles...",
    "Evaluando estabilidad genómica...",
    "Identificando elementos repetitivos...",
    "Verificando transposición...",
    "Analizando recombinación...",
    "Evaluando crossing-over...",
    "Identificando hotspots...",
    "Verificando sinapsis...",
    "Analizando conversión génica...",
    "Evaluando reparación del ADN...",
    "Identificando lesiones...",
    "Verificando daño oxidativo...",
    "Analizando roturas doble cadena...",
    "Evaluando vías de reparación...",
    "Identificando checkpoints de daño...",
    "Verificando respuesta al daño...",
    "Analizando senescencia...",
    "Evaluando telómeros...",
    "Identificando actividad telomerasa...",
    "Verificando longitud telomérica...",
    "Analizando caps teloméricos...",
    "Evaluando protección terminal...",
    "Identificando ALT...",
    "Verificando mantenimiento telomérico...",
    "Analizando envejecimiento celular...",
    "Evaluando estrés oxidativo...",
    "Identificando daño mitocondrial...",
    "Verificando función mitocondrial...",
    "Analizando biogénesis...",
    "Evaluando dinámica mitocondrial...",
    "Identificando fusión/fisión...",
    "Verificando mitofagia...",
    "Analizando metabolismo energético...",
    "Evaluando fosforilación oxidativa...",
    "Identificando especies reactivas...",
    "Verificando estado redox celular...",
    "Analizando señalización redox...",
    "Evaluando defensas antioxidantes...",
    "Identificando vías de detoxificación...",
    "Verificando homeostasis redox...",
    "Analizando estrés proteotóxico...",
    "Evaluando plegamiento proteico...",
    "Identificando chaperonas...",
    "Verificando control de calidad...",
    "Analizando agregación proteica...",
    "Evaluando degradación proteica...",
    "Identificando ubiquitinación...",
    "Verificando proteasoma...",
    "Analizando autofagia...",
    "Evaluando flujo autofágico...",
    "Identificando selectividad...",
    "Verificando formación de autofagosomas...",
    "Analizando fusión lisosomal...",
    "Evaluando degradación lisosomal...",
    "Identificando reciclaje celular...",
    "Verificando homeostasis celular...",
    "Analizando muerte celular...",
    "Evaluando apoptosis...",
    "Identificando señales de muerte...",
    "Verificando activación de caspasas...",
    "Analizando fragmentación nuclear...",
    "Evaluando exposición de fosfatidilserina...",
    "Identificando cuerpos apoptóticos...",
    "Verificando fagocitosis...",
    "Analizando necrosis...",
    "Evaluando permeabilidad...",
    "Identificando DAMPs...",
    "Verificando inflamación...",
    "Analizando piroptosis...",
    "Evaluando inflammasoma...",
    "Identificando IL-1β...",
    "Verificando gasdermin...",
    "Analizando necroptosis...",
    "Evaluando RIPK1/RIPK3...",
    "Identificando MLKL...",
    "Verificando permeabilización...",
    "Analizando ferroptosis...",
    "Evaluando peroxidación lipídica...",
    "Identificando GPX4...",
    "Verificando metabolismo del hierro...",
    "Analizando parthanatos...",
    "Evaluando daño al ADN...",
    "Identificando PARP...",
    "Verificando depleción de NAD+...",
    "Analizando autofagia...",
    "Evaluando señalización mTOR...",
    "Identificando ULK1...",
    "Verificando PI3K clase III...",
    "Analizando conjugación LC3...",
    "Evaluando selectividad cargo...",
    "Identificando receptores autofágicos...",
    "Verificando adaptadores...",
    "Analizando fusión vesicular...",
    "Evaluando acidificación...",
    "Identificando hidrolasas...",
    "Verificando reciclaje...",
    "Analizando senescencia...",
    "Evaluando SASP...",
    "Identificando p53/p21...",
    "Verificando p16/pRB...",
    "Analizando remodelación cromatina...",
    "Evaluando SAHF...",
    "Identificando DNA-SCARS...",
    "Verificando inflamación estéril...",
    "Analizando diferenciación terminal...",
    "Evaluando compromiso celular...",
    "Identificando factores pioneros...",
    "Verificando remodelación epigenética...",
    "Analizando determinación...",
    "Evaluando plasticidad...",
    "Identificando transdiferenciación...",
    "Verificando desdiferenciación...",
    "Analizando reprogramación...",
    "Evaluando pluripotencia...",
    "Identificando factores Yamanaka...",
    "Verificando redes regulatorias...",
    "Analizando memoria epigenética...",
    "Evaluando barrera epigenética...",
    "Identificando estados metaestables...",
    "Verificando paisaje de Waddington...",
    "Analizando desarrollo...",
    "Evaluando morfogénesis...",
    "Identificando organizadores...",
    "Verificando inductores...",
    "Analizando competencia...",
    "Evaluando especificación...",
    "Identificando determinación...",
    "Verificando diferenciación...",
    "Analizando migración...",
    "Evaluando quimiotaxis...",
    "Identificando adhesión...",
    "Verificando matriz extracelular...",
    "Analizando mecanotransducción...",
    "Evaluando tensegridad...",
    "Identificando fuerzas mecánicas...",
    "Verificando señalización mecánica...",
    "Analizando polaridad...",
    "Evaluando asimetría...",
    "Identificando determinantes...",
    "Verificando segregación...",
    "Analizando morfogénesis...",
    "Evaluando forma celular...",
    "Identificando citoesqueleto...",
    "Verificando remodelación...",
    "Analizando organización tisular...",
    "Evaluando arquitectura...",
    "Identificando nichos...",
    "Verificando homeostasis...",
    "Analizando regeneración...",
    "Evaluando reparación...",
    "Identificando células madre...",
    "Verificando progenitores...",
    "Analizando renovación...",
    "Evaluando quiescencia...",
    "Identificando activación...",
    "Verificando compromiso...",
    "Analizando diferenciación terminal...",
    "Evaluando especialización...",
    "Identificando función...",
    "Verificando integración...",
    "Analizando coordinación...",
    "Evaluando sincronización...",
    "Identificando emergencia...",
    "Verificando propiedades colectivas...",
    "Analizando autoorganización...",
    "Evaluando patrones...",
    "Identificando simetría...",
    "Verificando escalamiento...",
    "Analizando robustez...",
    "Evaluando adaptación...",
    "Identificando evolución...",
    "Verificando selección...",
    "Analizando fitness...",
    "Evaluando variación...",
    "Identificando innovación...",
    "Verificando conservación...",
    "Analizando divergencia...",
    "Evaluando convergencia...",
    "Identificando homología...",
    "Verificando analogía...",
    "Analizando modularidad...",
    "Evaluando pleiotropía...",
    "Identificando epistasis...",
    "Verificando dominancia...",
    "Analizando penetrancia...",
    "Evaluando expresividad...",
    "Identificando heredabilidad...",
    "Verificando transmisión...",
    "Analizando segregación...",
    "Evaluando recombinación...",
    "Identificando ligamiento...",
    "Verificando interferencia...",
    "Analizando deriva...",
    "Evaluando flujo génico...",
    "Identificando migración...",
    "Verificando aislamiento...",
    "Analizando especiación...",
    "Evaluando adaptación...",
    "Identificando radiación...",
    "Verificando extinción...",
    "Analizando resiliencia...",
    "Evaluando persistencia...",
    "Identificando innovación...",
    "Verificando optimización...",
    "Analizando complejidad...",
    "Evaluando emergencia...",
    "Identificando orden...",
    "Verificando organización...",
    "Analizando integración...",
    "Evaluando coherencia...",
    "Identificando estabilidad...",
    "Verificando dinámica...",
    "Analizando evolución...",
    "Evaluando adaptación...",
    "Identificando selección...",
    "Iniciando secuenciación del ADN...",
    "Identificando sitios de restricción...",
    "Preparando enzimas de restricción...",
    "Analizando secuencias palindrómicas...",
    "Separando cadenas complementarias...",
    "Activando ligasa de ADN...",
    "Verificando extremos cohesivos...",
    "Insertando fragmento de ADN...",
    "Reparando enlaces fosfodiéster...",
    "Completando proceso de empalme..."
];

// Función para formatear el timestamp de forma más concisa
function getTimestamp() {
    const now = new Date();
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const millis = now.getMilliseconds().toString().padStart(3, '0');
    return `[${seconds}.${millis}]`;
}

// Función para manejar el comando splice
async function handleSpliceCommand(output) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        showError('Seleccione un panel para realizar el splice', output);
        return;
    }
    
    const panel = selectedPanels[0];
    
    // 100 mensajes detallados del proceso
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

    // Crear panel de progreso
    const progressPanel = {
        group: null,
        minCellIndex: { 
            x: panel.minCellIndex.x, 
            y: panel.maxCellIndex.y + 2
        },
        maxCellIndex: { 
            x: panel.maxCellIndex.x, 
            y: panel.maxCellIndex.y + 2
        },
        orderNumber: panelOrderCounter++,
        hasText: true
    };
    
    const currentGridParams = getCurrentGridParams();
    updatePanelGeometryAndPosition(progressPanel, currentGridParams);
    
    if (progressPanel.group && progressPanel.fillMesh) {
        scene.add(progressPanel.group);
        panels.push(progressPanel);
        
        // Obtener dimensiones reales del panel
        const panelWidth = (progressPanel.maxCellIndex.x - progressPanel.minCellIndex.x + 1) * currentGridParams.cellSize;
        const panelHeight = currentGridParams.cellSize * 0.8; // Altura reducida para aspecto visual
        
        // Crear canvas con proporción correcta
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024; // Resolución base
        canvas.height = Math.floor(canvas.width * (panelHeight / panelWidth));
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        
        // Ajustar repetición de textura para que coincida con el panel
        texture.repeat.set(1, 1);
        texture.offset.set(0, 0);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        const progressMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        progressPanel.fillMesh.material = progressMaterial;
        
        function drawProgress(progress, pulse = 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Color de fondo semi-transparente
            ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dibujar borde con efecto de brillo
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
            
            // Calcular ancho de progreso proporcional al canvas
            const progressWidth = Math.floor((canvas.width - 8) * (progress / 100));
            
            // Crear gradiente para la barra de progreso
            const gradient = ctx.createLinearGradient(4, 0, progressWidth + 4, 0);
            const baseOpacity = 0.6 + pulse * 0.2;
            gradient.addColorStop(0, `rgba(0, 255, 135, ${baseOpacity})`);
            gradient.addColorStop(1, `rgba(0, 150, 255, ${baseOpacity})`);
            
            // Dibujar barra de progreso con gradiente
            ctx.fillStyle = gradient;
            ctx.fillRect(4, 4, progressWidth, canvas.height - 8);
            
            // Efecto de brillo en el borde de progreso
            if (progressWidth > 4) {
                const glowWidth = Math.min(8, progressWidth / 4);
                const glowGradient = ctx.createLinearGradient(progressWidth - glowWidth, 0, progressWidth + glowWidth, 0);
                glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)');
                glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.fillStyle = glowGradient;
                ctx.fillRect(progressWidth - glowWidth, 4, glowWidth * 2, canvas.height - 8);
            }
            
            texture.needsUpdate = true;
        }
        
        progressPanel.drawProgress = drawProgress;
    }
    
    // Configuración del panel de texto
    panel.hasText = true;
    panel.messageBuffer = [];
    panel.maxLines = Math.floor((panel.maxCellIndex.y - panel.minCellIndex.y + 1) * 1.2);
    
    function addFormattedMessage(message, type = 'info') {
        const timestamp = getTimestamp();
        const symbol = type === 'success' ? '✓' : 
                      type === 'error' ? '✗' : 
                      type === 'warning' ? '!' : 
                      '▶';
        
        const formattedMessage = `${timestamp} ${symbol} ${message}`;
        panel.messageBuffer.push(formattedMessage);
        
        if (panel.messageBuffer.length > panel.maxLines) {
            panel.messageBuffer.shift();
        }
        
        const visibleText = panel.messageBuffer.join('\n');
        setPanelText(panel, visibleText, currentGridParams.cellSize);
    }
    
    // Iniciar animación
    let messageIndex = 0;
    let progress = 0;
    let lastUpdateTime = Date.now();
    const duration = 16000; // mantener 16 segundos
    const messagesCount = SELECTED_MESSAGES.length;
    const progressInterval = 16; // 60fps
    const timePerMessage = duration / messagesCount;

    addFormattedMessage('Iniciando proceso de splice genético avanzado...', 'info');

    return new Promise((resolve) => {
        const updateInterval = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastUpdateTime;
            lastUpdateTime = currentTime;
            
            // Calcular incremento de progreso basado en el tiempo real transcurrido
            const progressIncrement = (deltaTime / duration) * 100;
            // Limitar el incremento máximo por frame para evitar saltos
            const maxIncrementPerFrame = 0.5; // Reducido para más suavidad
            progress = Math.min(100, progress + Math.min(progressIncrement, maxIncrementPerFrame));
            
            // Calcular cuántos mensajes deberían mostrarse
            const expectedMessages = Math.floor((progress / 100) * messagesCount);
            
            // Mostrar mensajes pendientes
            while (messageIndex < expectedMessages && messageIndex < messagesCount) {
                addFormattedMessage(SELECTED_MESSAGES[messageIndex], 'info');
                messageIndex++;
            }
            
            // Actualizar barra de progreso
            if (progressPanel.drawProgress) {
                const pulse = Math.sin(currentTime * 0.01) * 0.5 + 0.5;
                progressPanel.drawProgress(progress, pulse);
            }
            
            // Mostrar porcentaje
            const progressText = `${Math.floor(progress)}% completado`;
            setPanelText(progressPanel, progressText, currentGridParams.cellSize);
            
            if (progress >= 100) {
                clearInterval(updateInterval);
                
                // Asegurar que se muestren todos los mensajes
                while (messageIndex < messagesCount) {
                    addFormattedMessage(SELECTED_MESSAGES[messageIndex], 'info');
                    messageIndex++;
                }
                
                addFormattedMessage("Proceso de splice completado exitosamente", 'success');
                
                setTimeout(() => {
                    scene.remove(progressPanel.group);
                    const index = panels.indexOf(progressPanel);
                    if (index > -1) {
                        panels.splice(index, 1);
                    }
                    resolve();
                }, 1000);
            }
        }, progressInterval);
    });
}

// Función para dibujar la barra de progreso
function drawProgress(progress, pulse = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Color de fondo semi-transparente
    ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar borde con efecto de brillo
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Calcular ancho de la barra de progreso con suavizado
    const progressWidth = (canvas.width - 8) * (progress / 100);
    
    // Crear gradiente para la barra de progreso
    const gradient = ctx.createLinearGradient(4, 0, progressWidth + 4, 0);
    const baseOpacity = 0.6 + pulse * 0.2;
    gradient.addColorStop(0, `rgba(0, 255, 135, ${baseOpacity})`);
    gradient.addColorStop(1, `rgba(0, 150, 255, ${baseOpacity})`);
    
    // Dibujar barra de progreso con gradiente
    ctx.fillStyle = gradient;
    ctx.fillRect(4, 4, progressWidth, canvas.height - 8);
    
    // Efecto de brillo en el borde de progreso
    const glowWidth = Math.min(8, progressWidth / 4);
    const glowGradient = ctx.createLinearGradient(progressWidth - glowWidth, 0, progressWidth + glowWidth, 0);
    glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)');
    glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(progressWidth - glowWidth, 4, glowWidth * 2, canvas.height - 8);
    
    texture.needsUpdate = true;
}
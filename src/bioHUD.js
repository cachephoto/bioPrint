// bioHUD.js - Módulo para sistema HUD (grid secundario)
/**
 * Módulo encargado de gestionar el HUD como una instancia completa del grid original.
 * El HUD es efectivamente un segundo grid independiente, solo más cerca de la cámara.
 * 
 * CONEXIONES:
 * - main.js: Acceso a scene, camera, renderer, funciones de grid y paneles
 * - bioSlots.js: Guardar/cargar estados del HUD en slots
 * - panelText.js, panelModel.js: Crear paneles en el HUD
 * 
 * FUNCIONALIDAD:
 * - Crear/eliminar HUD en z=8 (más cerca de la cámara que el grid original en z=0)
 * - Gestión de grid del HUD completamente independiente del grid original
 * - Gestión de paneles en el HUD (array separado: hudPanels)
 * - Resolución independiente (cambiable con M y N, igual que + y - para grid original)
 * - Carga de slots con Ctrl+Número (igual que Número para grid original)
 * - Renderizado en capa separada con prioridad de casting
 * 
 * FILOSOFÍA PROCEDURAL:
 * - El HUD es una instancia completa del grid original
 * - Funciona exactamente igual, solo más cerca de la cámara
 * - Carga rápida e instanciación optimizada
 * - Renderizado eficiente en GPU
 */

import * as THREE from 'three';

// Configuración del HUD
export const HUD_PLANE_Z = 8; // Más cerca de la cámara (z=10) para estar en primer plano
const DEFAULT_HUD_DIVISIONS = 24; // Divisiones por defecto del grid HUD

// Variables de estado del HUD
let hudScene = null;        // Grupo Three.js para el HUD
let hudGrid = null;         // Grid del HUD
let hudPanels = [];         // Array de paneles del HUD
let hudActive = false;      // Estado activo/inactivo del HUD
let hudDivisions = DEFAULT_HUD_DIVISIONS; // Divisiones actuales del grid HUD
let darkeningPlane = null;  // Plano negro semitransparente para opacar el fondo

// Referencias externas (se inyectan desde main.js)
let sceneRef = null;
let createGridSimpleRef = null;
let getCurrentGridParamsRef = null;
let calculateGridSizeRef = null;
let updatePanelGeometryAndPositionRef = null;
let updatePanelColorRef = null;
let createPanelOrderLabelRef = null;
let cameraRef = null; // Referencia a la cámara para calcular tamaño del plano

/**
 * Inicializa el módulo de HUD con referencias necesarias
 * @param {object} refs - Referencias a objetos de main.js
 */
export function initBioHUD(refs) {
    sceneRef = refs.scene;
    createGridSimpleRef = refs.createGridSimple;
    getCurrentGridParamsRef = refs.getCurrentGridParams;
    calculateGridSizeRef = refs.calculateGridSize;
    updatePanelGeometryAndPositionRef = refs.updatePanelGeometryAndPosition;
    updatePanelColorRef = refs.updatePanelColor;
    createPanelOrderLabelRef = refs.createPanelOrderLabel;
    cameraRef = refs.camera;
    console.log('bioHUD.js inicializado');
}

/**
 * Crea el HUD con su grid
 * @param {number} divisions - Divisiones del grid (opcional)
 * @param {number} color - Color del grid (opcional)
 * @returns {boolean}
 */
export function createHUD(divisions = DEFAULT_HUD_DIVISIONS, color = 0x888888) {
    if (!sceneRef || !createGridSimpleRef) {
        console.error('bioHUD no está inicializado. Llama a initBioHUD() primero.');
        return false;
    }
    
    // Si ya existe un HUD, eliminarlo primero
    if (hudScene) {
        destroyHUD();
    }
    
    try {
        // Crear grupo para el HUD
        hudScene = new THREE.Group();
        hudScene.position.z = HUD_PLANE_Z;
        hudScene.userData = {
            isHUD: true,
            type: 'hud'
        };
        // 🔥 CRITICAL: Establecer renderOrder alto para que el HUD esté por encima de la cortina
        hudScene.renderOrder = 200; // Mayor que la cortina (100) para estar por encima
        
        // Crear grid para HUD
        hudDivisions = divisions;
        hudGrid = createGridSimpleRef(divisions, color, true);
        // Preservar userData completo del grid
        hudGrid.userData = {
            ...hudGrid.userData,
            isHUDGrid: true
        };
        // Asegurar que el grid del HUD también tenga renderOrder alto
        hudGrid.renderOrder = 200;
        hudScene.add(hudGrid);
        
        // Asegurar que el HUD sea visible
        hudScene.visible = true;
        hudGrid.visible = true;
        
        // Añadir a escena principal
        sceneRef.add(hudScene);
        
        hudActive = true;
        hudPanels = [];
        
        // Ajustar opacidad del grid del HUD a 20% (0.2)
        setHUDGridOpacity(0.2);
        
        // Crear plano negro semitransparente para opacar el fondo
        createDarkeningPlane();
        
        console.log(`HUD creado en z=${HUD_PLANE_Z} con ${divisions} divisiones`);
        return true;
    } catch (error) {
        console.error('Error al crear HUD:', error);
        return false;
    }
}

/**
 * Destruye el HUD y limpia todos sus recursos
 */
export function destroyHUD() {
    if (!hudScene) {
        return;
    }
    
    // Limpiar paneles
    clearHUDPanels();
    
    // Remover plano de oscurecimiento
    destroyDarkeningPlane();
    
    // Remover grid
    if (hudGrid) {
        hudScene.remove(hudGrid);
        hudGrid.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        hudGrid = null;
    }
    
    // Remover de escena principal
    if (sceneRef && sceneRef.children.includes(hudScene)) {
        sceneRef.remove(hudScene);
    }
    
    // Limpiar recursos del grupo
    hudScene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
    
    hudScene = null;
    hudActive = false;
    hudPanels = [];
    
    console.log('HUD destruido');
}

/**
 * Verifica si el HUD está activo
 * @returns {boolean}
 */
export function isHUDActive() {
    return hudActive && hudScene !== null;
}

/**
 * Obtiene el grupo de la escena HUD
 * @returns {THREE.Group|null}
 */
export function getHUDScene() {
    return hudScene;
}

/**
 * Obtiene el grid del HUD
 * @returns {THREE.Group|null}
 */
export function getHUDGrid() {
    return hudGrid;
}

/**
 * Obtiene los paneles del HUD
 * @returns {Array}
 */
export function getHUDPanels() {
    return hudPanels;
}

/**
 * Añade un panel al HUD
 * @param {object} panel - Panel a añadir
 */
export function addHUDPanel(panel) {
    if (!hudPanels.includes(panel)) {
        hudPanels.push(panel);
        
        // 🔥 CRITICAL: Establecer renderOrder alto en el panel y todos sus hijos para que esté por encima de la cortina
        if (panel.group) {
            panel.group.renderOrder = 200;
            // Asegurar que todos los hijos también tengan renderOrder alto
            panel.group.traverse((child) => {
                if (child.renderOrder !== undefined) {
                    child.renderOrder = 200;
                }
            });
            // Asegurar explícitamente que los borderLines tengan renderOrder alto
            if (panel.borderLines) {
                panel.borderLines.forEach(borderLine => {
                    borderLine.renderOrder = 200;
                });
            }
        }
    }
}

/**
 * Remueve un panel del HUD
 * @param {object} panel - Panel a remover
 */
export function removeHUDPanel(panel) {
    const index = hudPanels.indexOf(panel);
    if (index > -1) {
        hudPanels.splice(index, 1);
    }
}

/**
 * Limpia todos los paneles del HUD
 * @param {function} cleanupPanel - Función opcional para limpiar recursos del panel
 */
export function clearHUDPanels(cleanupPanel = null) {
    if (!hudScene) {
        hudPanels = [];
        return;
    }
    
    hudPanels.forEach(panel => {
        if (cleanupPanel) {
            cleanupPanel(panel);
        }
        
        if (panel.group && hudScene.children.includes(panel.group)) {
            hudScene.remove(panel.group);
            
            panel.group.traverse((child) => {
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
    });
    
    hudPanels = [];
    console.log(`HUD limpiado: ${hudPanels.length} paneles restantes`);
}

/**
 * Obtiene los parámetros del grid HUD
 * @returns {object|null}
 */
export function getHUDGridParams() {
    if (!hudGrid) {
        console.warn('getHUDGridParams: hudGrid no existe');
        return null;
    }
    
    // Usar directamente los parámetros guardados en userData del grid
    if (hudGrid.userData && hudGrid.userData.cellSize) {
        const cellSize = hudGrid.userData.cellSize;
        const cellsX = hudGrid.userData.cellsX || hudDivisions;
        const cellsY = hudGrid.userData.cellsY || hudDivisions;
        const halfWidth = hudGrid.userData.halfWidth || (cellsX * cellSize / 2);
        const halfHeight = hudGrid.userData.halfHeight || (cellsY * cellSize / 2);
        const adjustedWidth = hudGrid.userData.adjustedWidth || (cellsX * cellSize);
        const adjustedHeight = hudGrid.userData.adjustedHeight || (cellsY * cellSize);
        
        return {
            cellSize: cellSize,
            cellsX: cellsX,
            cellsY: cellsY,
            adjustedWidth: adjustedWidth,
            adjustedHeight: adjustedHeight,
            halfWidth: halfWidth,
            halfHeight: halfHeight
        };
    } else {
        // Fallback: calcular desde cero
        console.warn('getHUDGridParams: userData incompleto, usando fallback');
        if (!calculateGridSizeRef) {
            return null;
        }
        const { width, height } = calculateGridSizeRef();
        const cellSize = Math.min(width, height) / hudDivisions;
        const cellsX = hudDivisions;
        const cellsY = hudDivisions;
        const adjustedWidth = cellsX * cellSize;
        const adjustedHeight = cellsY * cellSize;
        const halfWidth = adjustedWidth / 2;
        const halfHeight = adjustedHeight / 2;
        
        return {
            cellSize: cellSize,
            cellsX: cellsX,
            cellsY: cellsY,
            adjustedWidth: adjustedWidth,
            adjustedHeight: adjustedHeight,
            halfWidth: halfWidth,
            halfHeight: halfHeight
        };
    }
}

/**
 * Actualiza el grid del HUD con nuevas divisiones
 * @param {number} divisions - Nuevas divisiones
 * @param {number} color - Color del grid (opcional)
 * @returns {boolean}
 */
export function updateHUDGrid(divisions, color = 0x888888) {
    if (!hudScene || !createGridSimpleRef) {
        console.warn('No se puede actualizar grid HUD: HUD no está activo');
        return false;
    }
    
    // IMPORTANTE: Usar hudDivisions como fuente de verdad única
    // No usar getHUDGridParams() aquí porque puede estar desactualizado
    const currentDivisions = hudDivisions;
    
    // Verificar si las divisiones son las mismas que las actuales
    if (divisions === currentDivisions && hudGrid) {
        console.log(`Grid HUD ya tiene ${divisions} divisiones, no se actualiza`);
        return true;
    }
    
    console.log(`updateHUDGrid: Actualizando de ${currentDivisions} a ${divisions} divisiones`);
    
    // Remover grid anterior
    if (hudGrid) {
        hudScene.remove(hudGrid);
        hudGrid.traverse((child) => {
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
    
    // IMPORTANTE: Actualizar hudDivisions ANTES de crear el nuevo grid
    // para que esté sincronizado inmediatamente
    hudDivisions = divisions;
    
    // Crear nuevo grid
    hudGrid = createGridSimpleRef(divisions, color, true);
    hudGrid.userData = {
        ...hudGrid.userData,
        isHUDGrid: true
    };
    // Asegurar que el grid del HUD también tenga renderOrder alto
    hudGrid.renderOrder = 200;
    hudScene.add(hudGrid);
    
    // Asegurar visibilidad
    hudScene.visible = true;
    hudGrid.visible = true;
    
    // Ajustar opacidad del grid del HUD a 20% (0.2)
    setHUDGridOpacity(0.2);
    
    console.log(`Grid HUD actualizado a ${divisions} divisiones (hudDivisions=${hudDivisions})`);
    return true;
}

/**
 * Ajusta la resolución (divisiones) del grid del HUD
 * @param {number} delta - Cambio en las divisiones (positivo = aumentar, negativo = disminuir)
 * @returns {boolean}
 */
export function adjustHUDResolution(delta) {
    if (!hudScene || !hudGrid) {
        console.warn('adjustHUDResolution: HUD no está activo');
        return false;
    }
    
    // Obtener divisiones actuales del HUD - usar hudDivisions directamente como fuente de verdad única
    const currentDivisions = hudDivisions;
    
    // Calcular nuevas divisiones con límites
    const MIN_DIVISIONS = 2;
    const MAX_DIVISIONS = 50;
    const newDivisions = Math.max(MIN_DIVISIONS, Math.min(MAX_DIVISIONS, currentDivisions + delta));
    
    // Si las divisiones no cambiaron (límite alcanzado), no hacer nada
    if (newDivisions === currentDivisions) {
        console.log(`Resolución HUD ya está en el límite: ${currentDivisions} divisiones (delta=${delta > 0 ? '+' : ''}${delta} no aplicable)`);
        return true;
    }
    
    // Actualizar el grid del HUD con las nuevas divisiones
    console.log(`Ajustando resolución HUD: ${currentDivisions} → ${newDivisions} divisiones (delta=${delta > 0 ? '+' : ''}${delta}, hudDivisions actual=${hudDivisions})`);
    const success = updateHUDGrid(newDivisions);
    
    // Verificar que la actualización fue exitosa y que hudDivisions se actualizó
    if (success) {
        // Verificar sincronización
        if (hudDivisions !== newDivisions) {
            console.warn(`ADVERTENCIA: Desincronización detectada. hudDivisions=${hudDivisions}, newDivisions=${newDivisions}. Forzando sincronización.`);
            hudDivisions = newDivisions;
        }
        
        // Asegurar visibilidad
        if (hudScene) {
            hudScene.visible = true;
            hudScene.traverse((child) => {
                child.visible = true;
            });
        }
        if (hudGrid) {
            hudGrid.visible = true;
        }
        
        // Llamar al callback para actualizar paneles si está disponible
        if (updateHUDPanelsCallback) {
            updateHUDPanelsCallback();
        }
        
        console.log(`Resolución HUD ajustada exitosamente a ${newDivisions} divisiones (verificado: hudDivisions=${hudDivisions})`);
    } else {
        console.error(`Error al ajustar resolución HUD de ${currentDivisions} a ${newDivisions}`);
    }
    
    return success;
}

/**
 * Función callback para actualizar paneles del HUD cuando cambia la resolución
 */
let updateHUDPanelsCallback = null;

/**
 * Establece el callback para actualizar paneles del HUD
 * @param {function} callback - Función que actualiza los paneles del HUD
 */
export function setUpdateHUDPanelsCallback(callback) {
    updateHUDPanelsCallback = callback;
}

/**
 * Obtiene la posición Z del plano HUD
 * @returns {number}
 */
export function getHUDPlaneZ() {
    return HUD_PLANE_Z;
}

/**
 * Crea un plano negro semitransparente para opacar el fondo cuando el HUD está activo
 * El plano se posiciona entre el grid principal (z=0) y el HUD (z=8)
 */
function createDarkeningPlane() {
    if (darkeningPlane) {
        // Si ya existe, no crear otro
        return;
    }
    
    if (!sceneRef || !cameraRef) {
        console.warn('No se puede crear plano de oscurecimiento: faltan referencias');
        return;
    }
    
    // Calcular el tamaño del plano basado en el viewport de la cámara ortográfica
    // La cámara ortográfica tiene left, right, top, bottom definidos
    const width = cameraRef.right - cameraRef.left;
    const height = cameraRef.top - cameraRef.bottom;
    
    // Crear geometría del plano (más grande que el viewport para asegurar cobertura completa)
    const planeGeometry = new THREE.PlaneGeometry(width * 1.5, height * 1.5);
    
    // Crear material negro semitransparente
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000, // Negro
        transparent: true,
        opacity: 0.95, // 95% opacidad para oscurecer significativamente
        side: THREE.DoubleSide,
        depthTest: false, // Desactivar depth test para que siempre se renderice encima
        depthWrite: false // No escribir en el buffer de profundidad
    });
    
    // Crear el mesh del plano
    darkeningPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    
    // Posicionar el plano entre el grid principal (z=0) y el HUD (z=8)
    // Usar z=7 para estar justo antes del HUD
    darkeningPlane.position.set(0, 0, 7);
    
    // Asegurar que el plano se renderice después del fondo pero antes del HUD
    // Usar renderOrder alto para estar por encima de todo el contenido del fondo
    darkeningPlane.renderOrder = 100; // Muy alto para estar por encima de paneles (0-10) y grid
    
    // Marcar para que no sea interactivo
    darkeningPlane.userData = {
        isDarkeningPlane: true,
        ignoreRaycast: true
    };
    darkeningPlane.raycast = () => null; // Desactivar raycasting
    
    // Añadir a la escena principal
    sceneRef.add(darkeningPlane);
    
    console.log('Plano de oscurecimiento creado');
}

/**
 * Destruye el plano de oscurecimiento
 */
function destroyDarkeningPlane() {
    if (!darkeningPlane) {
        return;
    }
    
    // Remover de la escena
    if (sceneRef && sceneRef.children.includes(darkeningPlane)) {
        sceneRef.remove(darkeningPlane);
    }
    
    // Limpiar recursos
    if (darkeningPlane.geometry) {
        darkeningPlane.geometry.dispose();
    }
    if (darkeningPlane.material) {
        darkeningPlane.material.dispose();
    }
    
    darkeningPlane = null;
    console.log('Plano de oscurecimiento destruido');
}

/**
 * Actualiza el tamaño del plano de oscurecimiento cuando cambia el tamaño de la ventana
 */
export function updateDarkeningPlaneSize() {
    if (!darkeningPlane || !cameraRef) {
        return;
    }
    
    // Recalcular tamaño basado en el viewport actual de la cámara
    const width = cameraRef.right - cameraRef.left;
    const height = cameraRef.top - cameraRef.bottom;
    
    // Actualizar geometría
    darkeningPlane.geometry.dispose();
    darkeningPlane.geometry = new THREE.PlaneGeometry(width * 1.5, height * 1.5);
    
    console.log('Tamaño del plano de oscurecimiento actualizado');
}

/**
 * Establece la opacidad del grid del HUD
 * @param {number} opacity - Opacidad (0.0 a 1.0)
 */
function setHUDGridOpacity(opacity) {
    if (!hudGrid) {
        return;
    }
    
    // Recorrer todos los objetos del grid y ajustar opacidad de materiales
    hudGrid.traverse((child) => {
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    if (mat.opacity !== undefined) {
                        mat.opacity = opacity;
                        mat.transparent = opacity < 1.0;
                    }
                });
            } else {
                if (child.material.opacity !== undefined) {
                    child.material.opacity = opacity;
                    child.material.transparent = opacity < 1.0;
                }
            }
        }
    });
}


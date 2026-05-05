import * as THREE from 'three';
import { setPanelText, getPanelText } from './panelText.js';

/**
 * MÓDULO BIOMODAL - Sistema de División Modal de Paneles
 * -----------------------------------------------------------------------------
 * Responsabilidad:
 * - Divide paneles horizontalmente en N secciones
 * - Crea botones + y - en cada sección
 * - Muestra y actualiza porcentajes en cada división
 * 
 * Flujo:
 * 1. handleModalCommand: Procesa comando "modal #" desde terminal
 * 2. createModalDivision: Divide el panel horizontalmente
 * 3. createModalButtons: Crea botones + y - con porcentaje
 * 4. updateModalPercentage: Actualiza el porcentaje al hacer click
 * 
 * Conexiones:
 * - main.js: processTerminalCommand() para registrar comando
 * - main.js: Event listeners de clicks para botones
 * - panelText.js: setPanelText() para mostrar porcentajes
 * - panelModel.js: Estructura de paneles
 * 
 * Estructura de cada división:
 * - Botón "-" (izquierda, altura = base)
 * - Texto porcentaje "100%" (centro)
 * - Botón "+" (derecha, altura = base)
 * -----------------------------------------------------------------------------
 */

// Estado global para modales
const modalState = new Map(); // panel -> { divisions: [], percentages: [] }
const restoredModals = new Set(); // Para evitar restaurar el mismo modal múltiples veces

// Términos de impresión genética
const GENETIC_PRINT_TERMS = [
    "BONE DENSITY",
    "SIZE",
    "INFILL DENSITY",
    "LAYER HEIGHT",
    "WALL THICKNESS",
    "PRINT SPEED",
    "TEMPERATURE",
    "MATERIAL FLOW",
    "SUPPORT DENSITY",
    "BRIDGE SPEED"
];

/**
 * Maneja el comando "modal #" para dividir un panel horizontalmente
 * @param {Array} args - Argumentos del comando [número]
 * @param {Object} output - Elemento de salida de terminal
 * @param {Function} createPanelFromBoundingBox - Función para crear paneles
 * @param {Function} getCurrentGridParams - Función para obtener parámetros del grid
 * @param {Array} panels - Array de paneles
 * @param {Function} showError - Función para mostrar errores
 * @param {Function} showSuccess - Función para mostrar éxito
 */
export function handleModalCommand(args, output, createPanelFromBoundingBox, getCurrentGridParams, panels, showError, showSuccess, panelsFlashing, updatePanelColor) {
    // Verificar que hay un panel seleccionado
    const selectedPanels = panels.filter(p => p.selected);
    if (selectedPanels.length === 0) {
        showError('Selecciona un panel para aplicar el comando modal', output);
        return;
    }
    
    const containerPanel = selectedPanels[0];
    
    // 🔥 CRITICAL: Limpiar modal anterior si existe en este panel
    if (modalState.has(containerPanel)) {
        const existingModalData = modalState.get(containerPanel);
        if (existingModalData && existingModalData.divisions) {
            // Eliminar todos los paneles del modal anterior de la escena y del array de paneles
            existingModalData.divisions.forEach(division => {
                // Función helper para limpiar un panel completamente
                const cleanupPanel = (panel) => {
                    if (!panel || !panel.group) return;
                    
                    const scene = panel.group.parent;
                    if (scene) {
                        // Limpiar geometrías y materiales antes de remover
                        panel.group.traverse((child) => {
                            if (child.geometry) {
                                child.geometry.dispose();
                            }
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                        scene.remove(panel.group);
                    }
                    
                    // Remover del array de paneles
                    const index = panels.indexOf(panel);
                    if (index > -1) {
                        panels.splice(index, 1);
                    }
                };
                
                cleanupPanel(division.minusButton);
                cleanupPanel(division.plusButton);
                cleanupPanel(division.percentagePanel);
                cleanupPanel(division.termPanel);
            });
        }
        // Limpiar el estado del modal anterior
        modalState.delete(containerPanel);
    }
    
    // 🔥 CRITICAL: Si el containerPanel ya es parte de otro modal (como botón, porcentaje o término),
    // necesitamos encontrar el containerPanel original
    let actualContainerPanel = containerPanel;
    if (containerPanel.containerPanel) {
        actualContainerPanel = containerPanel.containerPanel;
        // Limpiar el modal anterior del containerPanel original
        if (modalState.has(actualContainerPanel)) {
            const existingModalData = modalState.get(actualContainerPanel);
            if (existingModalData && existingModalData.divisions) {
                // Función helper para limpiar un panel completamente
                const cleanupPanel = (panel) => {
                    if (!panel || !panel.group) return;
                    
                    const scene = panel.group.parent;
                    if (scene) {
                        // Limpiar geometrías y materiales antes de remover
                        panel.group.traverse((child) => {
                            if (child.geometry) {
                                child.geometry.dispose();
                            }
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                        scene.remove(panel.group);
                    }
                    
                    // Remover del array de paneles
                    const index = panels.indexOf(panel);
                    if (index > -1) {
                        panels.splice(index, 1);
                    }
                };
                
                existingModalData.divisions.forEach(division => {
                    cleanupPanel(division.minusButton);
                    cleanupPanel(division.plusButton);
                    cleanupPanel(division.percentagePanel);
                    cleanupPanel(division.termPanel);
                });
            }
            modalState.delete(actualContainerPanel);
        }
    }
    
    // Usar el containerPanel correcto
    const finalContainerPanel = actualContainerPanel;
    
    // Obtener el número de divisiones
    if (args.length === 0) {
        showError('Especifica el número de divisiones: modal #', output);
        return;
    }
    
    const numDivisions = parseInt(args[0]);
    if (isNaN(numDivisions) || numDivisions < 1) {
        showError('El número de divisiones debe ser un entero positivo', output);
        return;
    }
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        showError('No se pudo obtener la configuración del grid', output);
        return;
    }
    
    // Calcular dimensiones del panel contenedor
    const containerWidth = finalContainerPanel.maxCellIndex.x - finalContainerPanel.minCellIndex.x + 1;
    const containerHeight = finalContainerPanel.maxCellIndex.y - finalContainerPanel.minCellIndex.y + 1;
    
    // Verificar que el contenedor sea lo suficientemente grande
    // Cada división necesita al menos 1 unidad de altura (la base)
    if (containerHeight < numDivisions) {
        showError(`El panel debe tener al menos ${numDivisions} unidades de altura (actual: ${containerHeight})`, output);
        return;
    }
    
    // Calcular altura de cada división
    const divisionHeight = Math.floor(containerHeight / numDivisions);
    
    // Reservar espacio para columna de términos a la derecha (duplicado: 80% del ancho)
    const separationSpace = 1; // 1 espacio de separación entre controles y términos
    // Asegurar que los controles tengan espacio mínimo para botones cuadrados y porcentaje
    const minControlsWidth = divisionHeight * 2 + 5; // Mínimo: 2 botones cuadrados + espacio para porcentaje
    // Calcular ancho de términos (duplicado: 80% del ancho total)
    const desiredTermsWidth = Math.floor(containerWidth * 0.8);
    const termsColumnWidth = Math.max(10, desiredTermsWidth); // Mínimo 10 celdas, 80% del ancho (duplicado de 40%)
    // Calcular ancho de controles (el resto después de términos y separación)
    const availableControlsWidth = containerWidth - termsColumnWidth - separationSpace;
    // Si los controles quedan muy comprimidos, ajustar para darles el mínimo necesario
    const controlsWidth = Math.max(minControlsWidth, availableControlsWidth);
    // Si tuvimos que ajustar controles, recalcular términos para usar el espacio restante
    const finalTermsColumnWidth = containerWidth - controlsWidth - separationSpace;
    
    try {
        const createdDivisions = [];
        const percentages = [];
        const termPanels = []; // Almacenar paneles de términos para colocarlos después
        
        // Crear las divisiones horizontales (solo controles primero)
        for (let i = 0; i < numDivisions; i++) {
            const minY = finalContainerPanel.minCellIndex.y + (i * divisionHeight);
            const maxY = minY + divisionHeight - 1;
            
            // Verificar que no se salga del contenedor
            if (maxY > finalContainerPanel.maxCellIndex.y) {
                break;
            }
            
            // Calcular dimensiones de botones y porcentaje (solo en el área de controles)
            // Los botones deben ser cuadrados: ancho = altura
            const buttonWidth = divisionHeight; // Ancho igual a la altura (botones cuadrados)
            const centerWidth = controlsWidth - (buttonWidth * 2); // Ancho restante para el porcentaje
            
            // Botón "-" (izquierda, en área de controles)
            const minusButton = createPanelFromBoundingBox({
                minX: finalContainerPanel.minCellIndex.x,
                maxX: finalContainerPanel.minCellIndex.x + buttonWidth - 1,
                minY: minY,
                maxY: maxY
            }, currentGridParams);
            
            if (minusButton && minusButton.group) {
                minusButton.isModalMinusButton = true;
                minusButton.modalIndex = i;
                minusButton.containerPanel = finalContainerPanel;
                minusButton.selected = false; // Asegurar que no esté seleccionado
                // Remover del flash automático de creación
                if (minusButton.shouldFlash) {
                    minusButton.shouldFlash = false;
                    panelsFlashing.delete(minusButton);
                }
                setPanelText(minusButton, "-", currentGridParams.cellSize);
                updatePanelColor(minusButton); // Actualizar color para reflejar selected: false
            }
            
            // Panel para porcentaje (centro, en área de controles)
            const percentagePanel = createPanelFromBoundingBox({
                minX: finalContainerPanel.minCellIndex.x + buttonWidth,
                maxX: finalContainerPanel.minCellIndex.x + buttonWidth + centerWidth - 1,
                minY: minY,
                maxY: maxY
            }, currentGridParams);
            
            if (percentagePanel && percentagePanel.group) {
                percentagePanel.isModalPercentage = true;
                percentagePanel.modalIndex = i;
                percentagePanel.containerPanel = finalContainerPanel;
                percentagePanel.modalPercentage = 100;
                percentagePanel.selected = false; // Asegurar que no esté seleccionado
                // Remover del flash automático de creación
                if (percentagePanel.shouldFlash) {
                    percentagePanel.shouldFlash = false;
                    panelsFlashing.delete(percentagePanel);
                }
                setPanelText(percentagePanel, "100%", currentGridParams.cellSize);
                updatePanelColor(percentagePanel); // Actualizar color para reflejar selected: false
            }
            
            // Botón "+" (derecha de controles, antes del espacio de separación, cuadrado)
            const plusButtonStartX = finalContainerPanel.minCellIndex.x + buttonWidth + centerWidth;
            const plusButton = createPanelFromBoundingBox({
                minX: plusButtonStartX,
                maxX: plusButtonStartX + buttonWidth - 1,
                minY: minY,
                maxY: maxY
            }, currentGridParams);
            
            if (plusButton && plusButton.group) {
                plusButton.isModalPlusButton = true;
                plusButton.modalIndex = i;
                plusButton.containerPanel = finalContainerPanel;
                plusButton.selected = false; // Asegurar que no esté seleccionado
                // Remover del flash automático de creación
                if (plusButton.shouldFlash) {
                    plusButton.shouldFlash = false;
                    panelsFlashing.delete(plusButton);
                }
                setPanelText(plusButton, "+", currentGridParams.cellSize);
                updatePanelColor(plusButton); // Actualizar color para reflejar selected: false
            }
            
            // Obtener término de impresión genética (invertir orden: "BONE DENSITY" abajo)
            // El último término (índice 0) va abajo, el primero (último índice) va arriba
            const termIndex = (numDivisions - 1 - i) % GENETIC_PRINT_TERMS.length;
            const geneticTerm = GENETIC_PRINT_TERMS[termIndex];
            
            // Crear panel de término (columna derecha, después del espacio de separación, duplicado)
            // Los términos empiezan después del espacio de separación
            const termsStartX = finalContainerPanel.minCellIndex.x + controlsWidth + separationSpace;
            // Usar finalTermsColumnWidth para asegurar que los términos ocupen todo el espacio disponible
            const termPanel = createPanelFromBoundingBox({
                minX: termsStartX,
                maxX: finalContainerPanel.maxCellIndex.x,
                minY: minY,
                maxY: maxY
            }, currentGridParams);
            
            if (termPanel && termPanel.group) {
                termPanel.isModalTermPanel = true;
                termPanel.modalIndex = i;
                termPanel.containerPanel = finalContainerPanel;
                termPanel.selected = false; // Asegurar que no esté seleccionado
                // Remover del flash automático de creación
                if (termPanel.shouldFlash) {
                    termPanel.shouldFlash = false;
                    panelsFlashing.delete(termPanel);
                }
                setPanelText(termPanel, geneticTerm, currentGridParams.cellSize);
                updatePanelColor(termPanel); // Actualizar color para reflejar selected: false
                termPanels.push(termPanel);
            }
            
            createdDivisions.push({
                termPanel: termPanel,
                minusButton: minusButton,
                percentagePanel: percentagePanel,
                plusButton: plusButton
            });
            
            percentages.push(100); // Inicializar en 100%
        }
        
        // Guardar estado del modal con información del containerPanel original
        modalState.set(finalContainerPanel, {
            divisions: createdDivisions,
            percentages: percentages,
            numDivisions: numDivisions,
            containerMinCellIndex: { x: finalContainerPanel.minCellIndex.x, y: finalContainerPanel.minCellIndex.y },
            containerMaxCellIndex: { x: finalContainerPanel.maxCellIndex.x, y: finalContainerPanel.maxCellIndex.y },
            containerOrderNumber: finalContainerPanel.orderNumber
        });
        
        // Hacer invisible el panel contenedor original y deshabilitar raycasts (pero mantenerlo para referencia)
        if (finalContainerPanel.group) {
            finalContainerPanel.group.visible = false;
            finalContainerPanel.group.traverse((child) => {
                if (child.visible !== undefined) {
                    child.visible = false;
                }
                // Deshabilitar raycasts para que no intercepte clicks/taps
                if (child.userData) {
                    child.userData.ignoreRaycast = true;
                } else {
                    child.userData = { ignoreRaycast: true };
                }
            });
        }
        
        // También marcar fillMesh y borderLines del containerPanel
        if (finalContainerPanel.fillMesh) {
            if (finalContainerPanel.fillMesh.userData) {
                finalContainerPanel.fillMesh.userData.ignoreRaycast = true;
            } else {
                finalContainerPanel.fillMesh.userData = { ignoreRaycast: true };
            }
        }
        
        if (finalContainerPanel.borderLines) {
            finalContainerPanel.borderLines.forEach(line => {
                if (line.userData) {
                    line.userData.ignoreRaycast = true;
                } else {
                    line.userData = { ignoreRaycast: true };
                }
            });
        }
        
        showSuccess(`Modal creado: ${createdDivisions.length} divisiones horizontales`, output);
        
    } catch (error) {
        console.error('Error en handleModalCommand:', error);
        showError('Error al crear la división modal', output);
    }
}

/**
 * Actualiza el porcentaje de una división modal
 * @param {Object} percentagePanel - Panel que muestra el porcentaje
 * @param {number} delta - Cambio en el porcentaje (+10 o -10)
 * @param {Object} currentGridParams - Parámetros del grid
 */
export function updateModalPercentage(percentagePanel, delta, currentGridParams) {
    if (!percentagePanel || !percentagePanel.isModalPercentage) {
        return;
    }
    
    // Obtener el estado del modal desde el panel contenedor
    const containerPanel = percentagePanel.containerPanel;
    if (!containerPanel || !modalState.has(containerPanel)) {
        return;
    }
    
    const modalData = modalState.get(containerPanel);
    const modalIndex = percentagePanel.modalIndex;
    
    if (modalIndex < 0 || modalIndex >= modalData.percentages.length) {
        return;
    }
    
    // Actualizar porcentaje (sin tope hacia arriba, pero mínimo 0)
    const currentPercentage = modalData.percentages[modalIndex];
    const newPercentage = Math.max(0, currentPercentage + delta);
    
    modalData.percentages[modalIndex] = newPercentage;
    percentagePanel.modalPercentage = newPercentage;
    
    // Actualizar el texto del panel
    setPanelText(percentagePanel, `${newPercentage}%`, currentGridParams.cellSize);
    
    console.log(`Modal división ${modalIndex}: ${currentPercentage}% -> ${newPercentage}%`);
}

/**
 * Obtiene el estado de un modal
 * @param {Object} containerPanel - Panel contenedor original
 * @returns {Object|null} Estado del modal o null
 */
export function getModalState(containerPanel) {
    return modalState.get(containerPanel) || null;
}

/**
 * Limpia el estado de un modal
 * @param {Object} containerPanel - Panel contenedor original
 */
export function cleanupModal(containerPanel) {
    modalState.delete(containerPanel);
}

/**
 * Limpia todos los modales
 */
export function cleanupAllModals() {
    modalState.clear();
    restoredModals.clear(); // 🔥 CRITICAL: También limpiar el Set de modales restaurados
}

/**
 * Obtiene información serializable del modal para un panel
 * @param {Object} panel - Panel que puede ser parte de un modal
 * @returns {Object|null} Información serializable del modal o null
 */
export function getModalBehaviorData(panel) {
    if (!panel) return null;
    
    // Buscar el containerPanel desde cualquier panel del modal
    let containerPanel = null;
    
    if (panel.containerPanel) {
        containerPanel = panel.containerPanel;
    } else if (panel.isModalDivision || panel.isModalTermPanel || 
                panel.isModalMinusButton || panel.isModalPlusButton || 
                panel.isModalPercentage) {
        // Si el panel es parte de un modal pero no tiene containerPanel, buscar en el estado
        for (const [container, modalData] of modalState.entries()) {
            const division = modalData.divisions.find(d => 
                d.termPanel === panel || 
                d.minusButton === panel || 
                d.percentagePanel === panel || 
                d.plusButton === panel
            );
            if (division) {
                containerPanel = container;
                break;
            }
        }
    }
    
    if (!containerPanel || !modalState.has(containerPanel)) {
        return null;
    }
    
    const modalData = modalState.get(containerPanel);
    
    // Serializar información del modal
    return {
        isModal: true,
        numDivisions: modalData.numDivisions,
        percentages: [...modalData.percentages], // Copia del array
        containerOrderNumber: modalData.containerOrderNumber || containerPanel.orderNumber, // Guardar número de orden del contenedor
        containerMinCellIndex: modalData.containerMinCellIndex || { x: containerPanel.minCellIndex.x, y: containerPanel.minCellIndex.y },
        containerMaxCellIndex: modalData.containerMaxCellIndex || { x: containerPanel.maxCellIndex.x, y: containerPanel.maxCellIndex.y },
        divisions: modalData.divisions.map((div, index) => ({
            index: index,
            termText: div.termPanel ? (getPanelText ? getPanelText(div.termPanel) : null) : null,
            percentage: div.percentagePanel ? div.percentagePanel.modalPercentage : 100
        }))
    };
}

/**
 * Restaura un modal desde datos serializados
 * @param {Object} containerPanel - Panel contenedor original
 * @param {Object} modalBehaviorData - Datos serializados del modal
 * @param {Function} createPanelFromBoundingBox - Función para crear paneles
 * @param {Function} getCurrentGridParams - Función para obtener parámetros del grid
 * @param {Array} panels - Array de paneles
 * @param {Function} getPanelText - Función para obtener texto de panel (opcional)
 */
export function restoreModalFromBehavior(containerPanel, modalBehaviorData, createPanelFromBoundingBox, getCurrentGridParams, panels, getPanelText = null, panelsFlashing, updatePanelColor) {
    if (!modalBehaviorData || !modalBehaviorData.isModal) {
        return;
    }
    
    // Crear una clave única para este modal basada en los índices del containerPanel
    const containerMin = modalBehaviorData.containerMinCellIndex;
    const containerMax = modalBehaviorData.containerMaxCellIndex;
    if (containerMin && containerMax) {
        const modalKey = `${containerMin.x},${containerMin.y}-${containerMax.x},${containerMax.y}`;
        
        // 🔥 CRITICAL: Verificar si el modal ya está restaurado y si los paneles todavía existen
        // Solo evitar restaurar si los paneles del modal todavía están en la escena
        if (restoredModals.has(modalKey)) {
            // Verificar si el modal todavía existe en el estado y tiene paneles visibles
            if (containerPanel && modalState.has(containerPanel)) {
                const existingModalData = modalState.get(containerPanel);
                if (existingModalData && existingModalData.divisions) {
                    const hasVisiblePanels = existingModalData.divisions.some(division => 
                        (division.minusButton && division.minusButton.group && division.minusButton.group.parent) ||
                        (division.plusButton && division.plusButton.group && division.plusButton.group.parent) ||
                        (division.percentagePanel && division.percentagePanel.group && division.percentagePanel.group.parent) ||
                        (division.termPanel && division.termPanel.group && division.termPanel.group.parent)
                    );
                    
                    // Si los paneles todavía están visibles, no restaurar de nuevo
                    if (hasVisiblePanels) {
                        console.log(`Modal ya restaurado y visible, omitiendo restauración duplicada: ${modalKey}`);
                        return;
                    }
                }
            }
            // Si el modal no está visible, limpiar la clave y permitir restaurar
            restoredModals.delete(modalKey);
        }
        restoredModals.add(modalKey);
    }
    
    // Si no se proporciona containerPanel, crear uno temporal basado en los índices guardados
    if (!containerPanel && containerMin && containerMax) {
        containerPanel = createPanelFromBoundingBox({
            minX: containerMin.x,
            maxX: containerMax.x,
            minY: containerMin.y,
            maxY: containerMax.y
        }, getCurrentGridParams());
        
        if (!containerPanel) {
            console.error('No se pudo crear el panel contenedor para restaurar el modal');
            return;
        }
    }
    
    if (!containerPanel) {
        return;
    }
    
    // 🔥 CRITICAL: Limpiar modal anterior si existe en este containerPanel
    if (modalState.has(containerPanel)) {
        const existingModalData = modalState.get(containerPanel);
        if (existingModalData && existingModalData.divisions) {
            // Función helper para limpiar un panel completamente
            const cleanupPanel = (panel) => {
                if (!panel || !panel.group) return;
                
                const scene = panel.group.parent;
                if (scene) {
                    // Limpiar geometrías y materiales antes de remover
                    panel.group.traverse((child) => {
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                    scene.remove(panel.group);
                }
                
                // Remover del array de paneles
                const index = panels.indexOf(panel);
                if (index > -1) {
                    panels.splice(index, 1);
                }
            };
            
            existingModalData.divisions.forEach(division => {
                cleanupPanel(division.minusButton);
                cleanupPanel(division.plusButton);
                cleanupPanel(division.percentagePanel);
                cleanupPanel(division.termPanel);
            });
        }
        // Limpiar el estado del modal anterior
        modalState.delete(containerPanel);
    }
    
    const currentGridParams = getCurrentGridParams();
    if (!currentGridParams) {
        console.error('No se pudieron obtener los parámetros del grid para restaurar modal');
        return;
    }
    
    const numDivisions = modalBehaviorData.numDivisions || 1;
    const percentages = modalBehaviorData.percentages || [];
    
    // Calcular dimensiones del panel contenedor
    const containerWidth = containerPanel.maxCellIndex.x - containerPanel.minCellIndex.x + 1;
    const containerHeight = containerPanel.maxCellIndex.y - containerPanel.minCellIndex.y + 1;
    const divisionHeight = Math.floor(containerHeight / numDivisions);
    
    // Reservar espacio para columna de términos
    const separationSpace = 1;
    const minControlsWidth = divisionHeight * 2 + 5;
    const desiredTermsWidth = Math.floor(containerWidth * 0.8);
    const termsColumnWidth = Math.max(10, desiredTermsWidth);
    const availableControlsWidth = containerWidth - termsColumnWidth - separationSpace;
    const controlsWidth = Math.max(minControlsWidth, availableControlsWidth);
    const finalTermsColumnWidth = containerWidth - controlsWidth - separationSpace;
    
    const createdDivisions = [];
    
    // Recrear las divisiones
    for (let i = 0; i < numDivisions; i++) {
        const minY = containerPanel.minCellIndex.y + (i * divisionHeight);
        const maxY = minY + divisionHeight - 1;
        
        if (maxY > containerPanel.maxCellIndex.y) {
            break;
        }
        
        const buttonWidth = divisionHeight;
        const centerWidth = controlsWidth - (buttonWidth * 2);
        
        // Restaurar porcentaje desde datos guardados
        const savedPercentage = percentages[i] !== undefined ? percentages[i] : 100;
        
        // Botón "-"
        const minusButton = createPanelFromBoundingBox({
            minX: containerPanel.minCellIndex.x,
            maxX: containerPanel.minCellIndex.x + buttonWidth - 1,
            minY: minY,
            maxY: maxY
        }, currentGridParams);
        
        if (minusButton && minusButton.group) {
            minusButton.isModalMinusButton = true;
            minusButton.modalIndex = i;
            minusButton.containerPanel = containerPanel;
            minusButton.selected = false; // Asegurar que no esté seleccionado
            // Remover del flash automático de creación
            if (minusButton.shouldFlash && panelsFlashing) {
                minusButton.shouldFlash = false;
                panelsFlashing.delete(minusButton);
            }
            setPanelText(minusButton, "-", currentGridParams.cellSize);
            if (updatePanelColor) updatePanelColor(minusButton); // Actualizar color para reflejar selected: false
        }
        
        // Panel de porcentaje
        const percentagePanel = createPanelFromBoundingBox({
            minX: containerPanel.minCellIndex.x + buttonWidth,
            maxX: containerPanel.minCellIndex.x + buttonWidth + centerWidth - 1,
            minY: minY,
            maxY: maxY
        }, currentGridParams);
        
        if (percentagePanel && percentagePanel.group) {
            percentagePanel.isModalPercentage = true;
            percentagePanel.modalIndex = i;
            percentagePanel.containerPanel = containerPanel;
            percentagePanel.modalPercentage = savedPercentage;
            percentagePanel.selected = false; // Asegurar que no esté seleccionado
            // Remover del flash automático de creación
            if (percentagePanel.shouldFlash && panelsFlashing) {
                percentagePanel.shouldFlash = false;
                panelsFlashing.delete(percentagePanel);
            }
            setPanelText(percentagePanel, `${savedPercentage}%`, currentGridParams.cellSize);
            if (updatePanelColor) updatePanelColor(percentagePanel); // Actualizar color para reflejar selected: false
        }
        
        // Botón "+"
        const plusButtonStartX = containerPanel.minCellIndex.x + buttonWidth + centerWidth;
        const plusButton = createPanelFromBoundingBox({
            minX: plusButtonStartX,
            maxX: plusButtonStartX + buttonWidth - 1,
            minY: minY,
            maxY: maxY
        }, currentGridParams);
        
        if (plusButton && plusButton.group) {
            plusButton.isModalPlusButton = true;
            plusButton.modalIndex = i;
            plusButton.containerPanel = containerPanel;
            plusButton.selected = false; // Asegurar que no esté seleccionado
            // Remover del flash automático de creación
            if (plusButton.shouldFlash && panelsFlashing) {
                plusButton.shouldFlash = false;
                panelsFlashing.delete(plusButton);
            }
            setPanelText(plusButton, "+", currentGridParams.cellSize);
            if (updatePanelColor) updatePanelColor(plusButton); // Actualizar color para reflejar selected: false
        }
        
        // Panel de término
        const termIndex = (numDivisions - 1 - i) % GENETIC_PRINT_TERMS.length;
        let geneticTerm = GENETIC_PRINT_TERMS[termIndex];
        
        // Intentar restaurar el término desde datos guardados
        if (modalBehaviorData.divisions && modalBehaviorData.divisions[i]) {
            const savedTerm = modalBehaviorData.divisions[i].termText;
            if (savedTerm) {
                geneticTerm = savedTerm;
            }
        }
        
        const termsStartX = containerPanel.minCellIndex.x + controlsWidth + separationSpace;
        const termPanel = createPanelFromBoundingBox({
            minX: termsStartX,
            maxX: containerPanel.maxCellIndex.x,
            minY: minY,
            maxY: maxY
        }, currentGridParams);
        
        if (termPanel && termPanel.group) {
            termPanel.isModalTermPanel = true;
            termPanel.modalIndex = i;
            termPanel.containerPanel = containerPanel;
            termPanel.selected = false; // Asegurar que no esté seleccionado
            // Remover del flash automático de creación
            if (termPanel.shouldFlash && panelsFlashing) {
                termPanel.shouldFlash = false;
                panelsFlashing.delete(termPanel);
            }
            setPanelText(termPanel, geneticTerm, currentGridParams.cellSize);
            if (updatePanelColor) updatePanelColor(termPanel); // Actualizar color para reflejar selected: false
        }
        
        createdDivisions.push({
            termPanel: termPanel,
            minusButton: minusButton,
            percentagePanel: percentagePanel,
            plusButton: plusButton
        });
    }
    
    // Guardar estado del modal restaurado
    modalState.set(containerPanel, {
        divisions: createdDivisions,
        percentages: percentages.length > 0 ? percentages : Array(numDivisions).fill(100),
        numDivisions: numDivisions
    });
    
    // Hacer invisible el containerPanel y deshabilitar raycasts (pero mantenerlo en la escena para referencia)
    if (containerPanel.group) {
        containerPanel.group.visible = false;
        containerPanel.group.traverse((child) => {
            if (child.visible !== undefined) {
                child.visible = false;
            }
            // Deshabilitar raycasts para que no intercepte clicks/taps
            if (child.userData) {
                child.userData.ignoreRaycast = true;
            } else {
                child.userData = { ignoreRaycast: true };
            }
        });
    }
    
    // También marcar fillMesh y borderLines del containerPanel
    if (containerPanel.fillMesh) {
        if (containerPanel.fillMesh.userData) {
            containerPanel.fillMesh.userData.ignoreRaycast = true;
        } else {
            containerPanel.fillMesh.userData = { ignoreRaycast: true };
        }
    }
    
    if (containerPanel.borderLines) {
        containerPanel.borderLines.forEach(line => {
            if (line.userData) {
                line.userData.ignoreRaycast = true;
            } else {
                line.userData = { ignoreRaycast: true };
            }
        });
    }
    
    console.log(`Modal restaurado: ${createdDivisions.length} divisiones con porcentajes`, percentages);
}



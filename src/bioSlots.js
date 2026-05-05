// bioSlots.js - Módulo para gestión de slots de configuración
/**
 * Módulo encargado de la gestión completa del sistema de slots.
 * 
 * CONEXIONES:
 * - main.js: Obtiene configuraciones serializables mediante getSerializableConfig()
 * - localStorage: Persistencia de datos de slots
 * - bioPopups.js: Puede guardar/cargar estados de popups en slots
 * 
 * FUNCIONALIDAD:
 * - Gestión de hasta 30 slots (aumentado desde 10)
 * - Migración automática y segura de datos existentes
 * - Guardado/carga de configuraciones completas
 * - Guardado/carga de conjuntos de paneles seleccionados
 * - UI del panel de slots
 */

// Configuración de slots
export const MAX_SLOTS = 30; // Aumentado de 10 a 30 slots
const STORAGE_KEY = 'bioPrint_slots_data';
const OLD_MAX_SLOTS = 10; // Para migración

// Variables de estado
let slots = null; // Array de slots, inicializado por loadSlotsFromLocalStorage
let currentSlotIndex = 0; // Slot actual cargado

/**
 * Migra datos de slots antiguos (10) a nuevo formato (30)
 * Preserva todos los datos existentes
 */
function migrateSlotsData(oldSlots) {
    if (!Array.isArray(oldSlots)) {
        console.warn('Datos de slots inválidos para migración. Inicializando slots vacíos.');
        return new Array(MAX_SLOTS).fill(null);
    }
    
    // Si ya tiene MAX_SLOTS elementos, no necesita migración
    if (oldSlots.length === MAX_SLOTS) {
        console.log('Slots ya tienen el tamaño correcto. No se requiere migración.');
        return oldSlots;
    }
    
    // Si tiene OLD_MAX_SLOTS elementos, migrar
    if (oldSlots.length === OLD_MAX_SLOTS) {
        console.log(`Migrando slots de ${OLD_MAX_SLOTS} a ${MAX_SLOTS}...`);
        const newSlots = new Array(MAX_SLOTS).fill(null);
        
        // Copiar todos los slots existentes preservando sus datos
        for (let i = 0; i < OLD_MAX_SLOTS; i++) {
            newSlots[i] = oldSlots[i];
        }
        
        console.log(`Migración completada. ${oldSlots.filter(s => s !== null).length} slots preservados.`);
        return newSlots;
    }
    
    // Si tiene otro tamaño, intentar preservar lo que se pueda
    console.warn(`Tamaño inesperado de slots (${oldSlots.length}). Intentando preservar datos...`);
    const newSlots = new Array(MAX_SLOTS).fill(null);
    const maxPreserve = Math.min(oldSlots.length, MAX_SLOTS);
    for (let i = 0; i < maxPreserve; i++) {
        newSlots[i] = oldSlots[i];
    }
    return newSlots;
}

/**
 * Persiste el array de slots completo en localStorage
 */
export function persistSlotsToLocalStorage() {
    if (!slots) {
        console.error('No se puede persistir: slots no está inicializado.');
        return;
    }
    
    try {
        console.log('Intentando persistir slots. Contenido actual de slots antes de stringify:', slots);
        const slotsJSON = JSON.stringify(slots);
        console.log('Slots convertidos a JSON para localStorage:', slotsJSON);
        localStorage.setItem(STORAGE_KEY, slotsJSON);
        console.log('Slots persistidos en localStorage.');
    } catch (error) {
        console.error('Error al persistir slots en localStorage:', error);
        // Considerar informar al usuario si el guardado falla (ej. localStorage lleno)
    }
}

/**
 * Carga el array de slots desde localStorage al iniciar
 * Realiza migración automática si es necesario
 */
export function loadSlotsFromLocalStorage() {
    const storedSlotsData = localStorage.getItem(STORAGE_KEY);
    console.log('Datos crudos de slots leídos desde localStorage al iniciar:', storedSlotsData);
    
    if (storedSlotsData) {
        try {
            const parsedSlots = JSON.parse(storedSlotsData);
            
            // Validar que lo cargado es un array
            if (Array.isArray(parsedSlots)) {
                // Migrar si es necesario
                slots = migrateSlotsData(parsedSlots);
                
                // Persistir la versión migrada si hubo migración
                if (parsedSlots.length !== MAX_SLOTS) {
                    persistSlotsToLocalStorage();
                }
                
                console.log(`Slots cargados desde localStorage (${slots.filter(s => s !== null).length} slots con datos).`);
            } else {
                console.warn('Los datos de slots en localStorage no son un array válido. Se usarán slots vacíos por defecto.');
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
    
    return slots;
}

/**
 * Obtiene el array de slots actual
 */
export function getSlots() {
    if (!slots) {
        console.warn('Slots no inicializado. Inicializando...');
        loadSlotsFromLocalStorage();
    }
    return slots;
}

/**
 * Obtiene el índice del slot actual
 */
export function getCurrentSlotIndex() {
    return currentSlotIndex;
}

/**
 * Establece el índice del slot actual
 */
export function setCurrentSlotIndex(index) {
    if (index >= 0 && index < MAX_SLOTS) {
        currentSlotIndex = index;
    } else {
        console.warn(`Índice de slot inválido: ${index}`);
    }
}

/**
 * Guarda una configuración en un slot específico
 * @param {number} slotIndex - Índice del slot (0-29)
 * @param {object} config - Configuración serializable a guardar
 * @param {function} updateUI - Función opcional para actualizar UI
 * @param {function} triggerFlash - Función opcional para activar flash visual
 */
export function saveToSlot(slotIndex, config, updateUI = null, triggerFlash = null) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido.`);
        return false;
    }
    
    if (!config) {
        console.error('Error: No se proporcionó configuración para guardar.');
        return false;
    }
    
    if (!slots) {
        console.error('Error: Slots no está inicializado.');
        return false;
    }
    
    try {
        console.log(`Intentando guardar en Slot ${slotIndex}. Configuración obtenida:`, JSON.parse(JSON.stringify(config)));
        
        slots[slotIndex] = JSON.stringify(config);
        persistSlotsToLocalStorage();
        
        // Flash de confirmación visual si se proporciona función
        if (triggerFlash) {
            triggerFlash();
        }
        
        // Actualizar UI si se proporciona función
        if (updateUI) {
            updateUI();
        }
        
        return true;
    } catch (error) {
        console.error(`Error al guardar en slot ${slotIndex}:`, error);
        return false;
    }
}

/**
 * Carga una configuración desde un slot específico
 * @param {number} slotIndex - Índice del slot (0-29)
 * @returns {object|null} - Configuración parseada o null si está vacío/error
 */
export function loadFromSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido.`);
        return null;
    }
    
    if (!slots) {
        console.error('Error: Slots no está inicializado.');
        return null;
    }
    
    const slotDataString = slots[slotIndex];
    if (!slotDataString) {
        console.warn(`Slot ${slotIndex} está vacío.`);
        return null;
    }
    
    try {
        const config = JSON.parse(slotDataString);
        console.log(`Cargando configuración desde Slot ${slotIndex}:`, JSON.parse(JSON.stringify(config)));
        
        currentSlotIndex = slotIndex; // Actualizar el slot actual
        return config;
    } catch (error) {
        console.error(`Error al parsear datos del Slot ${slotIndex}:`, error);
        return null;
    }
}

/**
 * Limpia un slot específico
 * @param {number} slotIndex - Índice del slot (0-29)
 * @param {function} updateUI - Función opcional para actualizar UI
 * @param {function} triggerFlash - Función opcional para activar flash visual
 */
export function clearSlot(slotIndex, updateUI = null, triggerFlash = null) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        console.error(`Slot ${slotIndex} inválido para limpiar.`);
        return false;
    }
    
    if (!slots) {
        console.error('Error: Slots no está inicializado.');
        return false;
    }
    
    if (slots[slotIndex]) {
        slots[slotIndex] = null;
        console.log(`Slot ${slotIndex} limpiado.`);
        persistSlotsToLocalStorage();
        
        // Actualizar UI si se proporciona función
        if (updateUI) {
            updateUI();
        }
        
        // Flash de confirmación visual si se proporciona función
        if (triggerFlash) {
            triggerFlash();
        }
        
        return true;
    } else {
        console.log(`Slot ${slotIndex} ya está vacío.`);
        return false;
    }
}

/**
 * Navega al siguiente slot con datos
 * @param {function} loadCallback - Función para cargar el slot encontrado
 * @returns {number|null} - Índice del slot encontrado o null
 */
export function navigateToNextSlot(loadCallback) {
    if (!slots) {
        console.error('Error: Slots no está inicializado.');
        return null;
    }
    
    let nextSlot = currentSlotIndex + 1;
    let attempts = 0;
    
    // Buscar el siguiente slot con datos, circular si es necesario
    while (attempts < MAX_SLOTS) {
        if (nextSlot >= MAX_SLOTS) {
            nextSlot = 0; // Volver al inicio
        }
        
        if (slots[nextSlot]) {
            console.log(`Avanzando al siguiente slot: ${nextSlot}`);
            if (loadCallback) {
                loadCallback(nextSlot);
            }
            return nextSlot;
        }
        
        nextSlot++;
        attempts++;
    }
    
    console.warn('No se encontró ningún slot con datos para avanzar.');
    return null;
}

/**
 * Navega al slot anterior con datos
 * @param {function} loadCallback - Función para cargar el slot encontrado
 * @returns {number|null} - Índice del slot encontrado o null
 */
export function navigateToPreviousSlot(loadCallback) {
    if (!slots) {
        console.error('Error: Slots no está inicializado.');
        return null;
    }
    
    let prevSlot = currentSlotIndex - 1;
    let attempts = 0;
    
    // Buscar el slot anterior con datos, circular si es necesario
    while (attempts < MAX_SLOTS) {
        if (prevSlot < 0) {
            prevSlot = MAX_SLOTS - 1; // Ir al final
        }
        
        if (slots[prevSlot]) {
            console.log(`Retrocediendo al slot anterior: ${prevSlot}`);
            if (loadCallback) {
                loadCallback(prevSlot);
            }
            return prevSlot;
        }
        
        prevSlot--;
        attempts++;
    }
    
    console.warn('No se encontró ningún slot con datos para retroceder.');
    return null;
}

/**
 * Verifica si un slot tiene datos
 * @param {number} slotIndex - Índice del slot
 * @returns {boolean}
 */
export function hasSlotData(slotIndex) {
    if (!slots || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
        return false;
    }
    return slots[slotIndex] !== null && slots[slotIndex] !== undefined;
}

/**
 * Obtiene información de un slot para mostrar en UI
 * @param {number} slotIndex - Índice del slot
 * @returns {object} - Información del slot {hasData, date, type, panelCount}
 */
export function getSlotInfo(slotIndex) {
    if (!hasSlotData(slotIndex)) {
        return {
            hasData: false,
            date: null,
            type: null,
            panelCount: 0
        };
    }
    
    try {
        const config = JSON.parse(slots[slotIndex]);
        const date = config.date ? new Date(config.date) : null;
        
        return {
            hasData: true,
            date: date,
            type: config.type || 'full', // 'full', 'selectedPanels', 'popup'
            panelCount: config.panelCount || (config.panels ? config.panels.length : 0)
        };
    } catch (error) {
        console.error(`Error al obtener información del slot ${slotIndex}:`, error);
        return {
            hasData: true,
            date: null,
            type: 'error',
            panelCount: 0
        };
    }
}


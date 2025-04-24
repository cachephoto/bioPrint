// Módulo para manejar texto editable en paneles
import * as THREE from 'three';

// Estado global del texto
export const panelTextState = new Map();
let currentEditingPanel = null;
let cursorBlinkInterval = null;
let cursorVisible = true;
let pixelFont = null; // Almacenamos la textura de fuente pixelada
let characterCache = new Map(); // Cache de caracteres para evitar parpadeos
let gesturesInitialized = false; // Flag para evitar inicialización múltiple
let lastGridSize = null; // Almacenar último tamaño de grilla global

// Estado para interacción táctil
let touchActive = false;
let lastTouchPosition = { x: 0, y: 0 };
let touchScrollSpeed = 0.05;
let touchStartTime = 0;
let touchMoved = false;
let multiTouchActive = false; // Para detectar gestos con múltiples dedos

// Eventos personalizados
const TOUCH_EVENTS = {
    ORBIT_START: 'touchOrbitStart',
    ORBIT_MOVE: 'touchOrbitMove',
    ORBIT_END: 'touchOrbitEnd',
    PANEL_START: 'touchPanelStart',
    PANEL_MOVE: 'touchPanelMove',
    PANEL_END: 'touchPanelEnd'
};

// Configuración de estilo
export const TEXT_CONFIG = {
    color: 0xffffff,
    cursorColor: 0xffffff,
    cursorBlinkRate: 530,
    padding: 0.8,
    fontSize: 2,        // Tamaño ajustado para mejor visibilidad
    lineHeight: 1.2,     // Reducido aún más (de 1.35) para acomodar una línea extra
    cursorWidth: 0.5,
    cursorHeight: 0.2,
    charSpacing: 0.25,   // Espaciado ajustado para fuente monospace
    fontFamily: 'PressStart2P', // Fuente pixelada
    scrollOffset: 0      // Offset de desplazamiento para texto largo
};

// Añadir a las configuraciones existentes
const CURSOR_CONFIG = {
    width: 0.5,
    height: 0.2,
    color: 0xffffff,
    blinkRate: 530,
    zOffset: 0.03
};

// Inicializar el módulo - cargamos la fuente pixelada
export function initPanelText() {
    // Precargar y generar caracteres comunes para evitar parpadeos
    precacheCommonCharacters();
    
    // Configurar gestos táctiles globales
    setupGlobalTouchHandlers();
    
    // Desactivar gestos del navegador a nivel de HTML/CSS
    disableBrowserGestures();
}

// Desactivar gestos del navegador a nivel de HTML/CSS
function disableBrowserGestures() {
    // Solo inicializar una vez
    if (gesturesInitialized) return;
    gesturesInitialized = true;
    
    // Agregar meta tags para deshabilitar gestos de Windows
    const metaTags = [
        { name: 'msapplication-tap-highlight', content: 'no' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
        { name: 'HandheldFriendly', content: 'true' },
        { name: 'ms-touch-action', content: 'none' }
    ];
    
    metaTags.forEach(tag => {
        let metaTag = document.querySelector(`meta[name="${tag.name}"]`);
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.name = tag.name;
            metaTag.content = tag.content;
            document.head.appendChild(metaTag);
        } else {
            metaTag.content = tag.content;
        }
    });
    
    // Agregar estilos CSS para deshabilitar gestos
    const style = document.createElement('style');
    style.textContent = `
        html, body {
            touch-action: none;
            -ms-touch-action: none;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            overscroll-behavior: none;
        }
        
        canvas {
            touch-action: none !important;
            -ms-touch-action: none !important;
        }
    `;
    document.head.appendChild(style);
    
    // Aplicar propiedades directamente al cuerpo del documento
    document.body.style.touchAction = 'none';
    document.body.style.msContentZooming = 'none';
    document.body.style.msTouchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    
    // Establecer el atributo touch-action en todos los canvas
    const updateCanvasTouchAction = () => {
        document.querySelectorAll('canvas').forEach(canvas => {
            canvas.style.touchAction = 'none';
            canvas.style.msTouchAction = 'none';
            canvas.setAttribute('touch-action', 'none');
        });
    };
    
    // Actualizar al inicio
    updateCanvasTouchAction();
    
    // También configurar un observador para capturar nuevos canvas
    const observer = new MutationObserver(mutations => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                shouldUpdate = true;
            }
        });
        
        if (shouldUpdate) {
            updateCanvasTouchAction();
        }
    });
    
    // Observar cambios en el DOM
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // Prevenir eventos de wheel para evitar zoom con el touchpad
    window.addEventListener('wheel', preventDefaultHandler, { passive: false });
    
    // Para Windows: prevenir eventos MSGesture específicamente
    if (window.navigator.msPointerEnabled || window.PointerEvent) {
        document.addEventListener('MSGestureStart', preventDefaultHandler, { passive: false });
        document.addEventListener('MSGestureChange', preventDefaultHandler, { passive: false });
        document.addEventListener('MSGestureEnd', preventDefaultHandler, { passive: false });
        document.addEventListener('MSInertiaStart', preventDefaultHandler, { passive: false });
        
        // Eventos Pointer para Windows
        document.addEventListener('pointerdown', preventPointerDefaultForMultiple, { passive: false });
        document.addEventListener('pointermove', preventPointerDefaultForMultiple, { passive: false });
        document.addEventListener('pointerup', preventPointerDefaultForMultiple, { passive: false });
        document.addEventListener('pointercancel', preventPointerDefaultForMultiple, { passive: false });
    }
}

// Función simple para prevenir evento por defecto
function preventDefaultHandler(event) {
    event.preventDefault();
    return false;
}

// Prevenir comportamiento por defecto para eventos pointer solo si son múltiples
function preventPointerDefaultForMultiple(event) {
    // Contar el número de puntos de contacto activos
    const pointersCount = Object.keys(event.getCoalescedEvents?.() || []).length || 
                           (event.pointerType === 'touch' ? 1 : 0);
    
    // Prevenir comportamiento por defecto si hay múltiples puntos de contacto
    if (pointersCount > 1 || event.pointerType === 'touch') {
        event.preventDefault();
    }
}

// Precarga caracteres comunes para evitar parpadeos
function precacheCommonCharacters() {
    const commonChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:!?-_+=()[]{}"\'/\\|<>@#$%^&*';
    for (const char of commonChars) {
        createCharacterMesh(char, 1, true); // Usamos tamaño 1 para el cache
    }
}

// Configurar gestos táctiles globales
function setupGlobalTouchHandlers() {
    // Desactivar zoom con gestos táctiles - capturar en ambas fases (capturing y bubbling)
    document.addEventListener('touchstart', preventZoomGesture, { passive: false, capture: true });
    document.addEventListener('touchmove', preventZoomGesture, { passive: false, capture: true });
    document.addEventListener('touchend', preventZoomGesture, { passive: false, capture: true });
    
    // Gestos de orbitado y creación de paneles
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: false, capture: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false, capture: true });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false, capture: true });
    
    // Para iOS: prevenir específicamente gestos de Safari
    document.addEventListener('gesturestart', preventDefaultHandler, { passive: false, capture: true });
    document.addEventListener('gesturechange', preventDefaultHandler, { passive: false, capture: true });
    document.addEventListener('gestureend', preventDefaultHandler, { passive: false, capture: true });
}

// Prevenir gestos de zoom
function preventZoomGesture(event) {
    // Siempre prevenir eventos de toques múltiples para evitar zoom
    if (event.touches.length > 1) {
        event.preventDefault();
        return false;
    }
    
    // Si estamos en modo texto, dejar que el manejador específico se encargue
    if (currentEditingPanel && panelTextState.get(currentEditingPanel)?.isEditing) {
        return;
    }
    
    // Si no, manejar según nuestras reglas
    switch (event.type) {
        case 'touchstart':
            if (event.touches.length === 1) {
                // Un dedo: potencialmente órbita normal
                lastTouchPosition = { 
                    x: event.touches[0].clientX, 
                    y: event.touches[0].clientY 
                };
                touchActive = true;
                touchMoved = false;
            } else if (event.touches.length === 2) {
                // Dos dedos: órbita con Ctrl
                event.preventDefault();
                multiTouchActive = true;
            }
            break;
            
        case 'touchmove':
            // Siempre prevenir el comportamiento por defecto en movimiento
            // para evitar desplazamiento y gestos del navegador
            event.preventDefault();
            break;
    }
}

// Manejar inicio de gestos táctiles globales
function handleGlobalTouchStart(event) {
    // Si estamos editando texto, dejar que el handler específico se encargue
    if (currentEditingPanel && panelTextState.get(currentEditingPanel).isEditing) {
        return;
    }
    
    // Determinar el tipo de gesto basado en número de dedos
    if (event.touches.length === 1) {
        // Un dedo - órbita normal
        const touch = event.touches[0];
        lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        touchActive = true;
        touchMoved = false;
        
        // Disparar evento personalizado para iniciar órbita
        const customEvent = new CustomEvent(TOUCH_EVENTS.ORBIT_START, {
            detail: {
                x: touch.clientX,
                y: touch.clientY,
                ctrlKey: false // Sin Ctrl para un dedo
            }
        });
        document.dispatchEvent(customEvent);
        
    } else if (event.touches.length === 2) {
        // Dos dedos - órbita con Ctrl
        multiTouchActive = true;
        const touch = event.touches[0]; // Usar el primer toque como referencia
        lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        
        // Disparar evento personalizado para iniciar órbita con Ctrl
        const customEvent = new CustomEvent(TOUCH_EVENTS.ORBIT_START, {
            detail: {
                x: touch.clientX,
                y: touch.clientY,
                ctrlKey: true // Con Ctrl para dos dedos
            }
        });
        document.dispatchEvent(customEvent);
    }
}

// Manejar movimiento de gestos táctiles globales
function handleGlobalTouchMove(event) {
    // Si estamos editando texto, dejar que el handler específico se encargue
    if (currentEditingPanel && panelTextState.get(currentEditingPanel).isEditing) {
        return;
    }
    
    // Determinar el tipo de gesto basado en número de dedos
    if (event.touches.length === 1 && touchActive) {
        // Un dedo - órbita normal
        const touch = event.touches[0];
        const deltaX = touch.clientX - lastTouchPosition.x;
        const deltaY = touch.clientY - lastTouchPosition.y;
        
        // Marcar como movido si hay suficiente desplazamiento
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            touchMoved = true;
        }
        
        // Actualizar posición
        lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        
        // Disparar evento personalizado para mover órbita
        const customEvent = new CustomEvent(TOUCH_EVENTS.ORBIT_MOVE, {
            detail: {
                x: touch.clientX,
                y: touch.clientY,
                deltaX: deltaX,
                deltaY: deltaY,
                ctrlKey: false // Sin Ctrl para un dedo
            }
        });
        document.dispatchEvent(customEvent);
        
    } else if (event.touches.length === 2 && multiTouchActive) {
        // Dos dedos - órbita con Ctrl
        const touch = event.touches[0]; // Usar el primer toque como referencia
        const deltaX = touch.clientX - lastTouchPosition.x;
        const deltaY = touch.clientY - lastTouchPosition.y;
        
        // Actualizar posición
        lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        
        // Disparar evento personalizado para mover órbita con Ctrl
        const customEvent = new CustomEvent(TOUCH_EVENTS.ORBIT_MOVE, {
            detail: {
                x: touch.clientX,
                y: touch.clientY,
                deltaX: deltaX,
                deltaY: deltaY,
                ctrlKey: true // Con Ctrl para dos dedos
            }
        });
        document.dispatchEvent(customEvent);
    }
    
    // Prevenir comportamiento predeterminado para evitar desplazamiento de página
    if ((touchActive && touchMoved) || multiTouchActive) {
        event.preventDefault();
    }
}

// Manejar fin de gestos táctiles globales
function handleGlobalTouchEnd(event) {
    // Si estamos editando texto, dejar que el handler específico se encargue
    if (currentEditingPanel && panelTextState.get(currentEditingPanel).isEditing) {
        return;
    }
    
    if (touchActive || multiTouchActive) {
        // Fin de órbita (con o sin Ctrl)
        const customEvent = new CustomEvent(TOUCH_EVENTS.ORBIT_END, {
            detail: {
                x: lastTouchPosition.x,
                y: lastTouchPosition.y,
                ctrlKey: multiTouchActive // Ctrl solo si era multitouch
            }
        });
        document.dispatchEvent(customEvent);
    }
    
    touchActive = false;
    multiTouchActive = false;
    
    // Prevenir comportamiento predeterminado solo si hemos estado interactuando activamente
    if (touchMoved) {
        event.preventDefault();
    }
}

// Manejar inicio de touch para texto
function handleTextTouchStart(event) {
    if (!currentEditingPanel) return;
    
    // Verificar si el toque está dentro del panel
    const panel = currentEditingPanel;
    const touch = event.touches[0];
    
    // Solo procesar si estamos en modo edición y hay un panel actual
    if (panel && panelTextState.get(panel).isEditing) {
        touchActive = true;
        touchStartTime = Date.now();
        touchMoved = false;
        lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        
        // Solo prevenir el comportamiento predeterminado si estamos seguros
        // que queremos manejar este evento
        event.preventDefault();
    }
}

// Manejar movimiento de touch para texto
function handleTextTouchMove(event) {
    if (!touchActive || !currentEditingPanel) return;
    
    const panel = currentEditingPanel;
    const state = panelTextState.get(panel);
    
    // Verificar que seguimos en modo edición
    if (!state || !state.isEditing) {
        touchActive = false;
        return;
    }
    
    const touch = event.touches[0];
    const deltaY = touch.clientY - lastTouchPosition.y;
    
    // Marcar que nos hemos movido
    if (Math.abs(deltaY) > 5) {
        touchMoved = true;
    }
    
    // Actualizar posición
    lastTouchPosition = { x: touch.clientX, y: touch.clientY };
    
    // Solo aplicar desplazamiento si tenemos suficiente texto
    if (state.lines.length > 5) {
        state.scrollOffset += deltaY * touchScrollSpeed;
        
        // Limitar desplazamiento
        const maxLines = state.lines.length;
        const minScroll = 0;
        const maxScroll = Math.max(0, maxLines - 5);
        
        state.scrollOffset = Math.max(minScroll, Math.min(state.scrollOffset, maxScroll));
        
        // Actualizar panel con nuevo desplazamiento
        createPanelText(panel, panel.gridSize);
        
        // Prevenir comportamiento predeterminado para evitar arrastre de página
        event.preventDefault();
    }
}

// Manejar fin de touch para texto
function handleTextTouchEnd(event) {
    // Solo prevenimos el comportamiento por defecto si hemos estado
    // desplazando activamente
    if (touchActive && touchMoved) {
        event.preventDefault();
    }
    touchActive = false;
}

// Crear o actualizar el texto en un panel
export function createPanelText(panel, gridSize) {
    if (!panel.group) return;

    // Limpiar solo elementos que no deben persistir
    for (const child of [...panel.group.children]) {
        if (child.userData.isDynamicTextElement || child.userData.isCursor) {
            panel.group.remove(child);
            if (child.material && !child.userData.isCached) child.material.dispose();
            if (child.geometry && !child.userData.isCached) child.geometry.dispose();
        }
    }

    // Inicializar estado si no existe
    if (!panelTextState.has(panel)) {
        panelTextState.set(panel, {
            text: '',
            cursorPosition: 0,
            lines: [''],
            isEditing: false,
            maxCharsPerLine: 0,
            scrollOffset: 0,
            textMeshes: [], // Almacenar referencias a los meshes de texto
            isPassword: false // Nuevo flag para modo contraseña
        });
    }

    const state = panelTextState.get(panel);
    
    // Si es modo contraseña, mostrar asteriscos pero mantener el texto real
    let displayLines = state.lines;
    if (state.isPassword) {
        // Convertir cada carácter a asterisco para mostrar
        displayLines = state.lines.map(line => '*'.repeat(line.length));
    }
    
    // Asegurar que panel.gridSize esté definido
    if (!panel.gridSize) {
        panel.gridSize = gridSize;
    }
    
    // Calcular dimensiones exactas del panel en unidades de grilla
    const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1);
    const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1);

    // Convertir a unidades de dimensión real
    const width = panelWidth * gridSize;
    const height = panelHeight * gridSize;

    // Calcular tamaño total del panel en unidades
    const totalPanelUnits = panelWidth * panelHeight;

    // Área efectiva para texto con padding
    const paddingSize = gridSize; // Exactamente una celda de padding
    const textAreaWidth = width - (paddingSize * 2);
    const textAreaHeight = height - (paddingSize * 2);

    // Determinar si el contenedor es demasiado pequeño
    const minHeightForText = gridSize * TEXT_CONFIG.fontSize;
    const isTooSmall = textAreaHeight < minHeightForText * 0.8;

    // Detectar contenedores extremadamente pequeños donde no es práctico mostrar texto
    const isTinyContainer = false;

    // Detectar contenedores de una sola línea o muy pequeños
    const isUniline = panelHeight <= 3;
    
    // Usamos siempre el tamaño global, incluso si el contenedor es pequeño
    const charWidth = gridSize * TEXT_CONFIG.fontSize * TEXT_CONFIG.charSpacing;
    
    // Crear contenedor para todo el texto
    const textContainer = new THREE.Group();
    
    // Ajustamos la posición base manteniendo una celda de distancia
    textContainer.position.set(
        -(width / 2) + paddingSize, // Una celda desde el borde izquierdo
        (height / 2) - paddingSize, // Una celda desde el borde superior
        0.02
    );
    textContainer.userData.isDynamicTextElement = true;
    
    // Para contenedores extremadamente pequeños, mostrar un indicador en lugar de texto
    if (isTinyContainer) {
        // Crear un pequeño marcador para indicar que hay texto pero no se puede mostrar
        const indicatorGeometry = new THREE.PlaneGeometry(
            Math.min(textAreaWidth, gridSize * 0.4),
            Math.min(textAreaHeight, gridSize * 0.2)
        );
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.userData.isDynamicTextElement = true;
        textContainer.add(indicator);
        
        // Agregar el contenedor al panel
        panel.group.add(textContainer);
        
        // Guardar una referencia a la gridSize en el panel
        panel.lastGridSize = gridSize;
        
        // No procesar más
        return;
    }
    
    // Para contenedores pequeños o unilinea, adaptamos el texto al espacio disponible
    if (isTooSmall || isUniline) {
        // --- Inicio Modificación Unilinea: Tamaño Estándar Siempre ---
        let customFontSize, effectiveCharSpacing, effectiveLineHeight;

        if (isUniline) {
            // Para Unilinea, SIEMPRE usar tamaño estándar, ignorando isTooSmall para estos params
            customFontSize = TEXT_CONFIG.fontSize;
            effectiveCharSpacing = TEXT_CONFIG.charSpacing;
            effectiveLineHeight = TEXT_CONFIG.lineHeight;
        } else {
            // Si NO es Unilinea (solo isTooSmall), aplicar lógica de escalado anterior
            customFontSize = panelHeight <= 3 ? Math.max(0.2, panelHeight * 0.4) : TEXT_CONFIG.fontSize;
            effectiveCharSpacing = panelWidth <= 3 ? TEXT_CONFIG.charSpacing * 0.3 : TEXT_CONFIG.charSpacing;
            effectiveLineHeight = panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                TEXT_CONFIG.lineHeight;
        }
        // --- Fin Modificación Unilinea: Tamaño Estándar Siempre ---

        // Recalcular el ancho de caracteres basado en el tamaño determinado
        const adjustedCharWidth = gridSize * customFontSize * effectiveCharSpacing;
        
        // Calcular el número máximo de caracteres por línea basado en el espacio disponible
        state.maxCharsPerLine = Math.max(1, Math.floor(textAreaWidth / adjustedCharWidth) - 1);
        
        // En modo unilinea, forzar a que solo haya una línea
        if (isUniline && state.lines.length > 1) {
            // Combinar todas las líneas en una
            const combinedText = state.lines.join(' ');
            state.lines = [combinedText];
            
            // Ajustar la posición del cursor si es necesario
            if (state.cursorPosition > combinedText.length) {
                state.cursorPosition = combinedText.length;
            }
        }
        
        // Para unilinea, limitar a una sola línea visible
        const maxVisibleLines = isUniline ? 1 : Math.max(1, Math.floor(textAreaHeight / (gridSize * effectiveLineHeight)));
        
        // Procesar líneas para asegurar que estén dentro del ancho del panel
        for (let i = 0; i < state.lines.length; i++) {
            let line = state.lines[i];
            
            // Si la línea es más larga que el máximo permitido, dividirla
            if (line.length > state.maxCharsPerLine) {
                if (isUniline) {
                    // En modo unilinea, truncar con "..."
                    state.lines[i] = line.substring(0, state.maxCharsPerLine - 3) + '...';
                } else {
                    // En modo normal, dividir la línea
                    let currentLine = line.substring(0, state.maxCharsPerLine);
                    let remainingText = line.substring(state.maxCharsPerLine);
                    
                    // Intentar dividir en un espacio
                    const lastSpace = currentLine.lastIndexOf(' ');
                    if (lastSpace > state.maxCharsPerLine / 2) {
                        currentLine = line.substring(0, lastSpace);
                        remainingText = line.substring(lastSpace + 1);
                    }
                    
                    // Actualizar la línea actual y añadir la siguiente
                    state.lines[i] = currentLine;
                    state.lines.splice(i + 1, 0, remainingText);
                }
            }
        }
        
        // Calcular índices de líneas visibles considerando el desplazamiento
        const startLineIndex = Math.floor(state.scrollOffset);
        // Intentar mostrar una línea más de la que cabe estrictamente
        const endLineIndex = Math.min(startLineIndex + maxVisibleLines + 1, state.lines.length);

        // Calcular la altura total del texto visible (usar el número real de líneas a mostrar)
        const visibleLineCount = endLineIndex - startLineIndex; // Usar endLineIndex calculado
        const textHeight = Math.min(visibleLineCount * (gridSize * effectiveLineHeight), textAreaHeight);
        
        // Centrado vertical perfecto - mantiene distancia igual a bordes superior e inferior
        // Para paneles muy pequeños, asegurar que el texto use toda la altura disponible
        const verticalOffset = panelHeight <= 1 ? 
                             textAreaHeight * 0.1 : // Usar casi toda la altura disponible
                             (textAreaHeight - textHeight) / 2;
        
        // Generar caracteres visuales para líneas visibles
        for (let lineIndex = startLineIndex; lineIndex < endLineIndex; lineIndex++) {
            const line = state.lines[lineIndex];
            const displayLineIndex = lineIndex - startLineIndex; // Índice relativo para visualización
            
            // Si es unilinea y la línea es más larga que el espacio disponible, ya está truncada
            const displayLine = line;
            
            // Calcular el ancho de esta línea
            // Usar la longitud real del texto, no el máximo disponible
            const lineWidth = Math.min(displayLine.length * adjustedCharWidth, textAreaWidth);
            
            // Calcular el desplazamiento horizontal para centrar esta línea
            const horizontalOffset = isUniline ?
                (textAreaWidth - lineWidth) / 2 // Centrar en el área de texto
                : 0; // <-- EMPEZAR DESDE LA IZQUIERDA para multilinea pequeño
            
            // Para cada carácter en la línea
            for (let i = 0; i < displayLine.length; i++) {
                // Verificar que el carácter cabe en el ancho disponible
                const char = displayLine[i];
                
                // Obtener o crear mesh para el carácter con el tamaño (posiblemente) ajustado
                const charMesh = createCharacterMesh(char, gridSize, false, customFontSize);
                
                // --- Inicio Modificación Posición Vertical Unilinea (Centrado Panel) ---
                charMesh.position.x = horizontalOffset + (i * adjustedCharWidth);

                if (isUniline) {
                    // Centrar verticalmente respecto al CENTRO DEL PANEL
                    const charHeight = charMesh.geometry.parameters.height;
                    // El origen del textContainer está en la esquina superior izquierda del textArea.
                    // Queremos que el centro del carácter (y=0) esté en el centro del textArea.
                    // El centro vertical del textArea está en -textAreaHeight / 2 relativo al origen del textContainer.
                    charMesh.position.y = -(textAreaHeight / 2);
                } else {
                    // --- Inicio Modificación Centrado Vertical Multilinea v3 ---
                    // Calcular la altura total del bloque de texto visible
                    const visibleLineCount = Math.min(endLineIndex - startLineIndex, maxVisibleLines);
                    const textBlockHeight = visibleLineCount * (gridSize * effectiveLineHeight);

                    // Calcular la posición Y del borde superior del bloque de texto cuando está centrado
                    const centeredBlockTopY = -(textAreaHeight / 2) + (textBlockHeight / 2);

                    // Calcular el offset desde el borde superior del bloque hasta el *centro* de la línea actual
                    const offsetToCurrentLineCenter = (displayLineIndex + 0.5) * (gridSize * effectiveLineHeight);

                    // Posicionar el centro del carácter (mesh.position.y) en el centro calculado de la línea actual
                    charMesh.position.y = centeredBlockTopY - offsetToCurrentLineCenter;
                    // --- Fin Modificación Centrado Vertical Multilinea ---
                }
                // --- Fin Modificación Posición Vertical Unilinea (Centrado Panel) ---

                charMesh.userData.isDynamicTextElement = true;
                
                // Mantener una referencia estable para evitar recreaciones innecesarias
                textContainer.add(charMesh.clone());
            }
        }
        
        // En modo unilinea, no mostrar indicadores de desplazamiento
        if (!isUniline && state.lines.length > maxVisibleLines) {
            // Indicador de scroll arriba solo si hay espacio y es necesario
            if (state.scrollOffset > 0 && textAreaWidth > gridSize * 2 && textAreaHeight > gridSize) {
                // Crear indicador de scroll más pequeño para asegurar que quepa
                const upIndicator = createScrollIndicator('▲', gridSize * 0.7);
                // Asegurar que el indicador está completamente dentro del panel
                const indicatorX = Math.min(textAreaWidth - upIndicator.geometry.parameters.width * 0.7, 
                          textAreaWidth - gridSize * 0.5);
                const indicatorY = -upIndicator.geometry.parameters.height * 0.15;
                
                upIndicator.position.set(
                    indicatorX,
                    indicatorY,
                    0.03
                );
                upIndicator.userData.isDynamicTextElement = true;
                textContainer.add(upIndicator);
            }
            
            // Indicador de scroll abajo solo si hay espacio y es necesario
            if (endLineIndex < state.lines.length && textAreaHeight > gridSize * 2) {
                // Crear indicador de scroll más pequeño para asegurar que quepa
                const downIndicator = createScrollIndicator('▼', gridSize * 0.7);
                // Asegurar que el indicador está completamente dentro del panel
                const indicatorX = Math.min(textAreaWidth - downIndicator.geometry.parameters.width * 0.7, 
                          textAreaWidth - gridSize * 0.5);
                const indicatorY = -Math.min(
                    textAreaHeight - downIndicator.geometry.parameters.height * 0.85,
                    textAreaHeight - gridSize * 0.5
                );
                
                downIndicator.position.set(
                    indicatorX,
                    indicatorY,
                    0.03
                );
                downIndicator.userData.isDynamicTextElement = true;
                textContainer.add(downIndicator);
            }
        }
        
        // Agregar el contenedor de texto al panel
        panel.group.add(textContainer);
        
        // Guardar una referencia a la gridSize en el panel para futuras actualizaciones
        panel.lastGridSize = gridSize;

        // Crear cursor (guion bajo) si estamos en modo edición
        if (state.isEditing) {
            const cursorParams = {
                gridSize,
                textAreaWidth,
                textAreaHeight,
                startLineIndex,
                endLineIndex,
                maxVisibleLines,
                charWidth,
                textContainer,
                verticalOffset
            };
            
            const cursor = manageCursor(panel, state, cursorParams);
            if (cursor) {
                panel.group.add(cursor);
            }
        }
    } else {
        // CASO NORMAL - PANEL SUFICIENTEMENTE GRANDE
        
        // Calcular número máximo de líneas visibles
        const maxVisibleLines = Math.max(1, Math.floor(textAreaHeight / (gridSize * TEXT_CONFIG.lineHeight)));
        
        // Calcular máximo de caracteres por línea basado en el ancho del panel
        state.maxCharsPerLine = Math.floor(textAreaWidth / charWidth);
        
        // Procesar líneas para asegurar que estén dentro del ancho del panel
        for (let i = 0; i < state.lines.length; i++) {
            let line = state.lines[i];
            
            // Si la línea es más larga que el máximo permitido, dividirla
            if (line.length > state.maxCharsPerLine) {
                let currentLine = line.substring(0, state.maxCharsPerLine);
                let remainingText = line.substring(state.maxCharsPerLine);
                
                // Intentar dividir en un espacio
                const lastSpace = currentLine.lastIndexOf(' ');
                if (lastSpace > state.maxCharsPerLine / 2) {
                    currentLine = line.substring(0, lastSpace);
                    remainingText = line.substring(lastSpace + 1);
                }
                
                // Actualizar la línea actual y añadir la siguiente
                state.lines[i] = currentLine;
                state.lines.splice(i + 1, 0, remainingText);
            }
        }
        
        // Calcular índices de líneas visibles considerando el desplazamiento
        const startLineIndex = Math.floor(state.scrollOffset);
        // Intentar mostrar una línea más de la que cabe estrictamente
        const endLineIndex = Math.min(startLineIndex + maxVisibleLines + 1, state.lines.length);

        // Calcular la altura total del texto visible (usar el número real de líneas a mostrar)
        const visibleLineCount = endLineIndex - startLineIndex; // Usar endLineIndex calculado
        const textHeight = Math.min(visibleLineCount * (gridSize * TEXT_CONFIG.lineHeight), textAreaHeight);
        
        // Centrado vertical perfecto - mantiene distancia igual a bordes superior e inferior
        const verticalOffset = (textAreaHeight - textHeight) / 2;
        
        // Generar caracteres visuales para líneas visibles
        for (let lineIndex = startLineIndex; lineIndex < endLineIndex; lineIndex++) {
            const line = state.lines[lineIndex];
            const displayLineIndex = lineIndex - startLineIndex; // Índice relativo para visualización
            
            // Calcular el ancho de esta línea
            // Usar la longitud real del texto, no el máximo disponible
            const lineWidth = Math.min(line.length * charWidth, textAreaWidth);
            
            // Calcular el desplazamiento horizontal para centrar esta línea
            const horizontalOffset = 0; // <--- EMPEZAR DESDE LA IZQUIERDA para multilinea normal
            
            // Para cada carácter en la línea
            for (let i = 0; i < line.length; i++) {
                // Verificar que el carácter cabe en el ancho disponible
                const char = line[i];
                
                // Obtener o crear mesh para el carácter
                const charMesh = createCharacterMesh(char, gridSize);
                
                // Posicionar el carácter con espaciado controlado y centrado
                charMesh.position.x = horizontalOffset + (i * charWidth);
                charMesh.position.y = -displayLineIndex * (gridSize * TEXT_CONFIG.lineHeight) - verticalOffset;
                charMesh.userData.isDynamicTextElement = true;
                
                // Mantener una referencia estable para evitar recreaciones innecesarias
                textContainer.add(charMesh.clone());
            }
        }
        
        // Agregar indicador de desplazamiento si hay más texto y espacio suficiente
        if (state.lines.length > maxVisibleLines) {
            // Indicador de scroll arriba
            if (state.scrollOffset > 0 && textAreaWidth > gridSize * 2 && textAreaHeight > gridSize) {
                // Crear indicador de scroll más pequeño para asegurar que quepa
                const upIndicator = createScrollIndicator('▲', gridSize * 0.7);
                // Asegurar que el indicador está completamente dentro del panel
                const indicatorX = Math.min(textAreaWidth - upIndicator.geometry.parameters.width * 0.7, 
                          textAreaWidth - gridSize * 0.5);
                const indicatorY = -upIndicator.geometry.parameters.height * 0.15;
                
                upIndicator.position.set(
                    indicatorX,
                    indicatorY,
                    0.03
                );
                upIndicator.userData.isDynamicTextElement = true;
                textContainer.add(upIndicator);
            }
            
            // Indicador de scroll abajo
            if (endLineIndex < state.lines.length && textAreaHeight > gridSize * 2) {
                // Crear indicador de scroll más pequeño para asegurar que quepa
                const downIndicator = createScrollIndicator('▼', gridSize * 0.7);
                // Asegurar que el indicador está completamente dentro del panel
                const indicatorX = Math.min(textAreaWidth - downIndicator.geometry.parameters.width * 0.7, 
                          textAreaWidth - gridSize * 0.5);
                const indicatorY = -Math.min(
                    textAreaHeight - downIndicator.geometry.parameters.height * 0.85,
                    textAreaHeight - gridSize * 0.5
                );
                
                downIndicator.position.set(
                    indicatorX,
                    indicatorY,
                    0.03
                );
                downIndicator.userData.isDynamicTextElement = true;
                textContainer.add(downIndicator);
            }
        }
        
        panel.group.add(textContainer);
        
        // Guardar una referencia a la gridSize en el panel para futuras actualizaciones
        panel.lastGridSize = gridSize;

        // Crear cursor (guion bajo)
        if (state.isEditing) {
            const cursorParams = {
                gridSize,
                textAreaWidth,
                textAreaHeight,
                startLineIndex,
                endLineIndex,
                maxVisibleLines,
                charWidth,
                textContainer,
                verticalOffset
            };
            
            const cursor = manageCursor(panel, state, cursorParams);
            if (cursor) {
                panel.group.add(cursor);
            }
        }
    }

    // Actualizar cualquier contenedor que sea demasiado pequeño
    if (panel.minCellIndex && panel.maxCellIndex) {
        const panelWidth = panel.maxCellIndex.x - panel.minCellIndex.x + 1;
        const panelHeight = panel.maxCellIndex.y - panel.minCellIndex.y + 1;
        
        // Si alguna dimensión es menor que 1, ajustarla
        if (panelWidth < 1 || panelHeight < 1) {
            console.warn("Ajustando panel demasiado pequeño a tamaño mínimo de 1x1");
            // Este código solo registra la advertencia, la corrección debería
            // hacerse en el código que crea/modifica los paneles
        }
    }
}

// Crear un mesh para un carácter individual
export function createCharacterMesh(char, gridSize, forCache = false, customFontSize = null) {
    // Para contenedores pequeños, usar un tamaño de fuente adaptado al tamaño del panel
    let fontSize = customFontSize || TEXT_CONFIG.fontSize;
    
    // Revisar si ya tenemos este carácter en cache
    const cacheKey = char + '-' + (forCache ? '1' : gridSize) + '-' + fontSize;
    if (characterCache.has(cacheKey)) {
        const cachedMesh = characterCache.get(cacheKey);
        if (forCache) return cachedMesh;
        
        // Si no es para el cache, devolvemos una copia del mesh cacheado
        const clonedMesh = cachedMesh.clone();
        clonedMesh.userData.isCached = true;
        return clonedMesh;
    }
    
    // Crear canvas para renderizar el carácter
    const canvas = document.createElement('canvas');
    const size = 256; // Alta resolución para evitar pixelación
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    
    // Dibujar un carácter pixelado
    if (char === ' ') {
        // No dibujar nada para espacios
    } else {
        // Estilo de fuente pixelada
        ctx.font = 'bold 64px "Press Start 2P", "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, size/2, size/2);
    }
    
    // Crear textura a partir del canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Crear material y geometría
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        // Evitar el parpadeo con estas propiedades
        alphaTest: 0.01,
        depthTest: false,
        premultipliedAlpha: true
    });
    
    const geometry = new THREE.PlaneGeometry(
        gridSize * fontSize,
        gridSize * fontSize
    );
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Si es para cache, lo guardamos
    if (forCache) {
        characterCache.set(cacheKey, mesh);
        mesh.userData.isCached = true;
    }
    
    return mesh;
}

// Crear un indicador de desplazamiento (más pequeño para caber bien)
function createScrollIndicator(symbol, size) {
    // Revisar cache primero
    const cacheKey = 'scroll-' + symbol + '-' + size;
    if (characterCache.has(cacheKey)) {
        return characterCache.get(cacheKey).clone();
    }
    
    const canvas = document.createElement('canvas');
    const canvasSize = 64;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, canvasSize/2, canvasSize/2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.7,
        depthTest: false,
        side: THREE.DoubleSide
    });
    
    // Usar un tamaño más pequeño para asegurar que quepa en el panel
    const geometry = new THREE.PlaneGeometry(
        size * 0.8,
        size * 0.8
    );
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Guardar en cache
    characterCache.set(cacheKey, mesh);
    
    return mesh;
}

// Manejar entrada de texto
export function handleTextInput(panel, event, gridSize) {
    const state = panelTextState.get(panel);
    if (!state || !state.isEditing) return;

    let textChanged = false;
    let currentText = state.lines.join('\n');

    switch (event.key) {
        case 'Enter':
            if (!state.isPassword) { // No permitir múltiples líneas en modo contraseña
                // --- Inicio: Lógica de Auto-Indentación ---
                const { currentLineIndex: oldLineIndex } = calculateCursorPosition(state);
                const currentLine = state.lines[oldLineIndex] || '';
                const leadingWhitespaceMatch = currentLine.match(/^\s*/);
                const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '';

                const beforeCursor = currentText.substring(0, state.cursorPosition);
                const afterCursor = currentText.substring(state.cursorPosition);

                currentText = beforeCursor + '\n' + leadingWhitespace + afterCursor;
                state.lines = currentText.split('\n');
                state.cursorPosition = beforeCursor.length + 1 + leadingWhitespace.length;
                textChanged = true;
            }
            break;
            
        case 'Backspace':
            if (state.cursorPosition > 0) {
                currentText = currentText.slice(0, state.cursorPosition - 1) + 
                            currentText.slice(state.cursorPosition);
                state.lines = currentText.split('\n');
                state.cursorPosition--;
                textChanged = true;
            }
            break;
            
        case 'ArrowLeft':
            if (state.cursorPosition > 0) {
                state.cursorPosition--;
                textChanged = true;
            }
            break;
            
        case 'ArrowRight':
            if (state.cursorPosition < currentText.length) {
                state.cursorPosition++;
                textChanged = true;
            }
            break;
            
        case 'ArrowUp':
            if (!state.isPassword) { // No navegar entre líneas en modo contraseña
                // Navegar hacia arriba
                let currentLineIndex = 0;
                let positionInLine = 0;
                let charsBeforeLine = 0;
                
                // Encontrar la línea actual y posición en esa línea
                for (let i = 0; i < state.lines.length; i++) {
                    if (charsBeforeLine + state.lines[i].length >= state.cursorPosition) {
                        currentLineIndex = i;
                        positionInLine = state.cursorPosition - charsBeforeLine;
                        break;
                    }
                    charsBeforeLine += state.lines[i].length + 1; // +1 por el salto de línea
                }
                
                // Ir a la línea anterior si es posible
                if (currentLineIndex > 0) {
                    const prevLineLength = state.lines[currentLineIndex - 1].length;
                    const newPosInLine = Math.min(positionInLine, prevLineLength);
                    state.cursorPosition = charsBeforeLine - state.lines[currentLineIndex - 1].length - 1 + newPosInLine;
                    textChanged = true;
                    
                    // Ajustar desplazamiento si es necesario
                    if (currentLineIndex - 1 < state.scrollOffset) {
                        state.scrollOffset = Math.max(0, currentLineIndex - 1);
                    }
                }
            }
            break;
            
        case 'ArrowDown':
            if (!state.isPassword) { // No navegar entre líneas en modo contraseña
                // Navegar hacia abajo
                let downLineIndex = 0;
                let downPositionInLine = 0;
                let downCharsBeforeLine = 0;
                
                // Encontrar la línea actual y posición en esa línea
                for (let i = 0; i < state.lines.length; i++) {
                    if (downCharsBeforeLine + state.lines[i].length >= state.cursorPosition) {
                        downLineIndex = i;
                        downPositionInLine = state.cursorPosition - downCharsBeforeLine;
                        break;
                    }
                    downCharsBeforeLine += state.lines[i].length + 1; // +1 por el salto de línea
                }
                
                // Ir a la línea siguiente si es posible
                if (downLineIndex < state.lines.length - 1) {
                    const nextLineLength = state.lines[downLineIndex + 1].length;
                    const newPosInLine = Math.min(downPositionInLine, nextLineLength);
                    
                    // Calcular nueva posición del cursor
                    let newCursorPos = downCharsBeforeLine + state.lines[downLineIndex].length + 1 + newPosInLine;
                    state.cursorPosition = newCursorPos;
                    textChanged = true;
                    
                    // Calcular si necesitamos desplazar para ver la línea
                    const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1);
                    const textAreaHeight = panelHeight - (2 * TEXT_CONFIG.padding);
                    const maxVisibleLines = Math.floor(textAreaHeight / TEXT_CONFIG.lineHeight);
                    
                    if (downLineIndex + 1 >= state.scrollOffset + maxVisibleLines) {
                        state.scrollOffset = downLineIndex + 2 - maxVisibleLines;
                    }
                } else if (state.scrollOffset + maxVisibleLines < state.lines.length) {
                    // Si estamos en la última línea visible pero hay más líneas abajo, desplazar
                    state.scrollOffset += 1;
                    textChanged = true;
                }
            }
            break;
            
        default:
            if (event.key.length === 1) {
                // Si es modo contraseña, siempre insertar asterisco
                const charToInsert = state.isPassword ? '*' : event.key;
                currentText = currentText.slice(0, state.cursorPosition) +
                            charToInsert +
                            currentText.slice(state.cursorPosition);
                state.lines = currentText.split('\n');
                state.cursorPosition++;
                textChanged = true;
            }
    }

    if (textChanged) {
        createPanelText(panel, gridSize);
    }
}

// Activar modo de edición
export function startTextEditing(panel, gridSize) {
    const state = panelTextState.get(panel);
    if (!state) return;

    state.isEditing = true;
    currentEditingPanel = panel;
    
    // Agregar event listeners para interacción táctil SOLO cuando
    // estamos en modo edición
    document.addEventListener('touchstart', handleTextTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTextTouchMove, { passive: false });
    document.addEventListener('touchend', handleTextTouchEnd);
    
    // Prevenir entrada en terminal
    document.addEventListener('keydown', preventTerminalInput);

    if (cursorBlinkInterval) clearInterval(cursorBlinkInterval);
    cursorBlinkInterval = setInterval(() => {
        cursorVisible = !cursorVisible;
        createPanelText(panel, gridSize);
    }, TEXT_CONFIG.cursorBlinkRate);

    createPanelText(panel, gridSize);
}

// Desactivar modo de edición
export function stopTextEditing(panel) {
    const state = panelTextState.get(panel);
    if (!state) return;

    state.isEditing = false;
    if (currentEditingPanel === panel) {
        currentEditingPanel = null;
    }
    
    // Remover event listeners cuando salimos del modo edición
    document.removeEventListener('touchstart', handleTextTouchStart);
    document.removeEventListener('touchmove', handleTextTouchMove);
    document.removeEventListener('touchend', handleTextTouchEnd);
    
    // Restaurar entrada en terminal
    document.removeEventListener('keydown', preventTerminalInput);

    if (cursorBlinkInterval) {
        clearInterval(cursorBlinkInterval);
        cursorBlinkInterval = null;
    }

    // Es crucial renderizar una última vez el texto sin el cursor
    // para que permanezca visible después de salir del modo edición
    createPanelText(panel, panel.lastGridSize || panel.gridSize);
}

// Este método debe ser llamado cuando un panel es creado o actualizado
// para asegurar que su texto siempre se muestre
export function updatePanelText(panel, cellSize) {
    if (!panel.textMesh || !panel.textContent) return;

    // Eliminar el texto existente
    panel.group.remove(panel.textMesh);

    // Crear nuevo texto
    createPanelText(panel, cellSize);
    panel.textMesh.position.z = 0.1; // Asegurar que el texto esté visible
}

// Función para añadir texto a un panel en cualquier momento
export function setPanelText(panel, text, gridSize) {
    // Asegurar que el panel tenga estado
    if (!panelTextState.has(panel)) {
        panelTextState.set(panel, {
            text: '',
            cursorPosition: 0,
            lines: [''],
            isEditing: false,
            maxCharsPerLine: 0,
            scrollOffset: 0
        });
    }
    
    const state = panelTextState.get(panel);
    state.lines = text.split('\n');
    state.cursorPosition = text.length;
    
    // Forzar la actualización del texto
    createPanelText(panel, gridSize);
}

// Función para prevenir entrada en terminal
function preventTerminalInput(event) {
    if (currentEditingPanel) {
        // Prevenir comportamiento por defecto para evitar entrada en terminal
        event.preventDefault();
        event.stopPropagation();
        
        // Manejar la entrada de texto en el panel
        handleTextInput(currentEditingPanel, event, currentEditingPanel.gridSize);
        return false;
    }
}

// Obtener texto del panel
export function getPanelText(panel) {
    const state = panelTextState.get(panel);
    if (!state) return '';
    
    // Si es modo contraseña, devolver el texto real
    return state.lines.join('\n');
}

// Función para limpiar recursos cuando ya no necesitamos el sistema
export function cleanupPanelText() {
    // Limpiar el cache de caracteres
    characterCache.forEach((mesh) => {
        if (mesh.material) mesh.material.dispose();
        if (mesh.geometry) mesh.geometry.dispose();
    });
    characterCache.clear();
}

// Función para forzar recarga de fuente pixelada si es necesario
export function reloadPixelFont() {
    // Limpiar cache existente para forzar regeneración
    characterCache.clear();
    // Precargar caracteres de nuevo
    precacheCommonCharacters();
}

// Función para crear el mesh del cursor
function createCursorMesh(gridSize, textAreaWidth, textAreaHeight) {
    const cursorWidth = Math.min(gridSize * CURSOR_CONFIG.width, textAreaWidth / 4);
    const cursorHeight = Math.min(gridSize * CURSOR_CONFIG.height, textAreaHeight / 4);
    
    const geometry = new THREE.PlaneGeometry(cursorWidth, cursorHeight);
    const material = new THREE.MeshBasicMaterial({
        color: CURSOR_CONFIG.color,
        transparent: true,
        opacity: cursorVisible ? 1 : 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
    });
    
    const cursor = new THREE.Mesh(geometry, material);
    cursor.userData.isCursor = true;
    cursor.frustumCulled = false;
    
    return cursor;
}

// Función para calcular la posición del cursor en el texto
function calculateCursorPosition(state) {
    let currentLineIndex = 0;
    let currentLinePosition = 0;
    let charsCount = 0;
    
    for (let i = 0; i < state.lines.length; i++) {
        const lineLength = state.lines[i].length;
        
        // Verificar si el cursor está en esta línea
        if (charsCount + lineLength >= state.cursorPosition) {
            currentLineIndex = i;
            currentLinePosition = state.cursorPosition - charsCount;
            break;
        }
        
        // Actualizar el contador incluyendo el salto de línea
        charsCount += lineLength + 1;
        
        // Si llegamos al final, colocar el cursor al final de la última línea
        if (i === state.lines.length - 1) {
            currentLineIndex = i;
            currentLinePosition = lineLength;
        }
    }
    
    return { currentLineIndex, currentLinePosition };
}

// Función para posicionar el cursor en el panel
function positionCursor(cursor, position, textContainer, params) {
    const {
        horizontalOffset,
        charWidth,
        cursorWidth,
        targetCharCenterY,
        cursorHeight,
        textAreaWidth
    } = params;

    // Calcular X relativo al origen del textContainer
    // Usar el mismo espaciado que los caracteres y limitar al área de texto
    const rawCursorX = horizontalOffset + (position * charWidth); // Eliminar offset negativo
    // Asegurar que el cursor no se salga del área de texto
    const cursorX = Math.min(rawCursorX, textAreaWidth - cursorWidth);

    // Calcular Y: Alinear el borde SUPERIOR del cursor con el CENTRO del slot, y luego subirlo un poco.
    const cursorY = targetCharCenterY - (cursorHeight / 2) + (cursorHeight * 0.4);

    // Establecer la posición LOCAL del cursor DENTRO del textContainer
    cursor.position.set(cursorX, cursorY, CURSOR_CONFIG.zOffset);
}

// Función para manejar el scroll del cursor
function handleCursorScroll(state, lineIndex, maxVisibleLines, startLineIndex, endLineIndex) {
    if (lineIndex < startLineIndex) {
        return Math.max(0, lineIndex - 1);
    } else if (lineIndex >= endLineIndex) {
        return Math.max(0, lineIndex - maxVisibleLines + 1);
    }
    return state.scrollOffset;
}

// Función principal para gestionar el cursor
function manageCursor(panel, state, params) {
    if (!state.isEditing) return null;

    // Obtener tamaño de fuente y altura de línea efectivos (importante para paneles pequeños)
    const panelHeight = (panel.maxCellIndex.y - panel.minCellIndex.y + 1);
    const panelWidth = (panel.maxCellIndex.x - panel.minCellIndex.x + 1);
    const isUniline = panelHeight <= 3;
    const isTooSmall = params.textAreaHeight < (params.gridSize * TEXT_CONFIG.fontSize * 0.8);

    const customFontSize = (isTooSmall || isUniline) ?
                           (panelHeight <= 3 ? Math.max(0.2, panelHeight * 0.4) : TEXT_CONFIG.fontSize)
                           : TEXT_CONFIG.fontSize;

    const effectiveLineHeight = (isTooSmall || isUniline) ?
                                (panelHeight <= 1 ? TEXT_CONFIG.lineHeight * 0.2 :
                                 panelHeight <= 2 ? TEXT_CONFIG.lineHeight * 0.3 :
                                 panelHeight <= 3 ? TEXT_CONFIG.lineHeight * 0.4 :
                                 TEXT_CONFIG.lineHeight)
                                : TEXT_CONFIG.lineHeight;

    const effectiveCharSpacing = (isTooSmall || isUniline) ?
                                 (panelWidth <= 3 ? TEXT_CONFIG.charSpacing * 0.3 : TEXT_CONFIG.charSpacing)
                                 : TEXT_CONFIG.charSpacing;

    const adjustedCharWidth = params.gridSize * customFontSize * effectiveCharSpacing;


    const cursor = createCursorMesh(params.gridSize, params.textAreaWidth, params.textAreaHeight);
    const { currentLineIndex, currentLinePosition } = calculateCursorPosition(state);

    // Verificar visibilidad del cursor y calcular posición dentro del textContainer
    if (currentLineIndex >= params.startLineIndex && currentLineIndex < params.endLineIndex) {
        const visibleLineIndex = currentLineIndex - params.startLineIndex;
        const currentLine = state.lines[currentLineIndex];

        // Calcular el ancho real de la línea actual con el ancho de carácter ajustado
        const lineWidth = Math.min(currentLine.length * adjustedCharWidth, params.textAreaWidth);

        // Calcular el desplazamiento horizontal para centrar esta línea
        // Usar textAreaWidth para centrar dentro del área de texto disponible
        const horizontalOffset = isUniline ?
            (params.textAreaWidth - lineWidth) / 2
            : 0; // Multilinea empieza a la izquierda

        // --- Inicio: Calcular Target Y para Cursor ---
        let targetCharCenterY;
        if (isUniline) {
            // Centro vertical del área de texto (igual que el charMesh)
            targetCharCenterY = -(params.textAreaHeight / 2);
            
            // Para unilínea, usar el ancho estándar de carácter
            const standardCharWidth = params.gridSize * TEXT_CONFIG.fontSize * TEXT_CONFIG.charSpacing;
            
            // Pasar todos los parámetros necesarios a positionCursor
            positionCursor(cursor, currentLinePosition, params.textContainer, {
                horizontalOffset,
                charWidth: standardCharWidth, // Usar ancho estándar para unilínea
                cursorWidth: cursor.geometry.parameters.width,
                targetCharCenterY,
                cursorHeight: cursor.geometry.parameters.height,
                textAreaWidth: params.textAreaWidth
            });
        } else {
            // Centro vertical de la línea actual dentro del bloque centrado (igual que el charMesh)
            const visibleLineCount = Math.min(params.endLineIndex - params.startLineIndex, params.maxVisibleLines);
            const textBlockHeight = visibleLineCount * (params.gridSize * effectiveLineHeight);
            const centeredBlockTopY = -(params.textAreaHeight / 2) + (textBlockHeight / 2);
            const offsetToCurrentLineCenter = (visibleLineIndex + 0.5) * (params.gridSize * effectiveLineHeight);
            targetCharCenterY = centeredBlockTopY - offsetToCurrentLineCenter;

            // Para multilínea, usar el ancho ajustado
            positionCursor(cursor, currentLinePosition, params.textContainer, {
                horizontalOffset,
                charWidth: adjustedCharWidth, // Usar ancho ajustado para multilínea
                cursorWidth: cursor.geometry.parameters.width,
                targetCharCenterY,
                cursorHeight: cursor.geometry.parameters.height,
                textAreaWidth: params.textAreaWidth
            });
        }
        // --- Fin: Calcular Target Y para Cursor ---

        // Añadir cursor como hijo del textContainer
        params.textContainer.add(cursor);

    } else {
        // Manejar scroll si el cursor está fuera de vista
        // (La lógica de scroll parece correcta, pero necesita llamar a createPanelText si cambia)
        const newScrollOffset = handleCursorScroll(
            state,
            currentLineIndex,
            params.maxVisibleLines,
            params.startLineIndex,
            params.endLineIndex
        );

        if (newScrollOffset !== state.scrollOffset) {
            state.scrollOffset = newScrollOffset;
            // Forzar re-renderizado del texto Y el cursor con el nuevo offset
            // Usar un pequeño timeout para asegurar que el estado se actualiza antes de renderizar
            setTimeout(() => createPanelText(panel, params.gridSize), 0);
        }
    }

    // La función ahora no necesita devolver el cursor, ya que se añade al textContainer
    return null; // Devolver null siempre
} 
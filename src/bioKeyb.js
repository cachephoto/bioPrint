// bioKeyb.js - Módulo para recrear el teclado virtual bioKeyb
// Copyright (C) 2023 Ihtoa Ware Inc.

import * as THREE from 'three';
import { TEXT_CONFIG } from './panelText.js'; // <-- Importar TEXT_CONFIG
import { createCharacterMesh } from './panelText.js'; // Importar la función para crear meshes de caracteres individuales

/**
 * Módulo para crear un teclado virtual basado en la configuración de bioKeyb
 */

// Configuración por defecto del teclado
const DEFAULT_KEYBOARD_CONFIG = {
  // Definir la estructura del teclado según la configuración
  grid: {
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
  },
  panels: []
};

// Mapeo de teclas especiales a símbolos ASCII/píxel art
const KEY_SYMBOLS = {
  'TAB': '⇥',
  'CAPS': '⇪',
  'SHIFT': '⇧',
  'CNTRL': '⌃',
  'CTRL': '⌃',
  'ALT': '⎇',
  'BACKSPACE': '⌫',
  'ENTER': 'ENTER',
  'ESCAPE': 'ESC',
  'ESC': 'ESC',
  'SPACEBAR': ' '
};

// Estado del teclado
const keyboardState = {
  capsLock: false,
  shift: false,
  showOrderNumbers: false,
  activeElement: null,
  isWriting: false, // Nueva propiedad para detectar si el usuario está escribiendo
  disabledKeys: ['A', 'V', 'T', 'C', 'X', 'G'] // Teclas a desactivar durante la escritura
};

// NUEVO: Materiales compartidos para todas las teclas
const keyMaterials = {
    normal: {
        line: new THREE.LineBasicMaterial({ 
            color: 0xaaaaaa,
            linewidth: 1,
            transparent: false
        }),
        fill: new THREE.MeshBasicMaterial({ 
            color: 0xaaaaaa,
            transparent: true, 
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        })
    },
    hover: {
        line: new THREE.LineBasicMaterial({ 
            color: 0xcccccc,
            linewidth: 1,
            transparent: false
        }),
        fill: new THREE.MeshBasicMaterial({ 
            color: 0xcccccc,
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        })
    },
    selected: {
        line: new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2,
            transparent: false
        }),
        fill: new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true, 
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        })
    }
};

// Función para alternar entre mayúsculas y minúsculas
function toggleCase(text) {
  if (!text || typeof text !== 'string' || text.length !== 1) {
    return text;
  }
  
  if (text >= 'A' && text <= 'Z') {
    return text.toLowerCase();
  } else if (text >= 'a' && text <= 'z') {
    return text.toUpperCase();
  }
  return text;
}

// Crear teclado a partir de la configuración
function createKeyboard() {
  console.log("Creando teclado bioKeyb...");
  
  // Ajustar coordenadas para posicionar el teclado
  const offsetX = 18; // Mantener posición horizontal
  const offsetY = 1;  // De 2 a 1 para bajar una hilera
  
  // Definición de las teclas según la configuración del archivo
  const keyboardLayout = [
    // Primera fila (1-12)
    { minX: 4 + offsetX, minY: offsetY + 8, maxX: 6.5 + offsetX, maxY: offsetY + 9, id: 1, text: "ESC", character: "ESC", isKeyboardKey: true },
    { minX: 7.5 + offsetX, minY: offsetY + 8, maxX: 8.5 + offsetX, maxY: offsetY + 9, id: 2, text: "1", character: "1", isKeyboardKey: true },
    { minX: 9.5 + offsetX, minY: offsetY + 8, maxX: 10.5 + offsetX, maxY: offsetY + 9, id: 3, text: "2", character: "2", isKeyboardKey: true },
    { minX: 11.5 + offsetX, minY: offsetY + 8, maxX: 12.5 + offsetX, maxY: offsetY + 9, id: 4, text: "3", character: "3", isKeyboardKey: true },
    { minX: 13.5 + offsetX, minY: offsetY + 8, maxX: 14.5 + offsetX, maxY: offsetY + 9, id: 5, text: "4", character: "4", isKeyboardKey: true },
    { minX: 15.5 + offsetX, minY: offsetY + 8, maxX: 16.5 + offsetX, maxY: offsetY + 9, id: 6, text: "5", character: "5", isKeyboardKey: true },
    { minX: 17.5 + offsetX, minY: offsetY + 8, maxX: 18.5 + offsetX, maxY: offsetY + 9, id: 7, text: "6", character: "6", isKeyboardKey: true },
    { minX: 19.5 + offsetX, minY: offsetY + 8, maxX: 20.5 + offsetX, maxY: offsetY + 9, id: 8, text: "7", character: "7", isKeyboardKey: true },
    { minX: 21.5 + offsetX, minY: offsetY + 8, maxX: 22.5 + offsetX, maxY: offsetY + 9, id: 9, text: "8", character: "8", isKeyboardKey: true },
    { minX: 23.5 + offsetX, minY: offsetY + 8, maxX: 24.5 + offsetX, maxY: offsetY + 9, id: 10, text: "9", character: "9", isKeyboardKey: true },
    { minX: 25.5 + offsetX, minY: offsetY + 8, maxX: 26.5 + offsetX, maxY: offsetY + 9, id: 11, text: "0", character: "0", isKeyboardKey: true },
    { minX: 27.5 + offsetX, minY: offsetY + 8, maxX: 30 + offsetX, maxY: offsetY + 9, id: 12, text: "BKSP", character: "BACKSPACE", isKeyboardKey: true },
    
    // Segunda fila (13-25)
    { minX: 4 + offsetX, minY: offsetY + 6, maxX: 5 + offsetX, maxY: offsetY + 7, id: 13, text: "TAB", character: "TAB", isKeyboardKey: true },
    { minX: 6 + offsetX, minY: offsetY + 6, maxX: 7 + offsetX, maxY: offsetY + 7, id: 14, text: "Q", character: "Q", isKeyboardKey: true },
    { minX: 8 + offsetX, minY: offsetY + 6, maxX: 9 + offsetX, maxY: offsetY + 7, id: 15, text: "W", character: "W", isKeyboardKey: true },
    { minX: 10 + offsetX, minY: offsetY + 6, maxX: 11 + offsetX, maxY: offsetY + 7, id: 16, text: "E", character: "E", isKeyboardKey: true },
    { minX: 12 + offsetX, minY: offsetY + 6, maxX: 13 + offsetX, maxY: offsetY + 7, id: 17, text: "R", character: "R", isKeyboardKey: true },
    { minX: 14 + offsetX, minY: offsetY + 6, maxX: 15 + offsetX, maxY: offsetY + 7, id: 18, text: "T", character: "T", isKeyboardKey: true },
    { minX: 16 + offsetX, minY: offsetY + 6, maxX: 17 + offsetX, maxY: offsetY + 7, id: 19, text: "Y", character: "Y", isKeyboardKey: true },
    { minX: 18 + offsetX, minY: offsetY + 6, maxX: 19 + offsetX, maxY: offsetY + 7, id: 20, text: "U", character: "U", isKeyboardKey: true },
    { minX: 20 + offsetX, minY: offsetY + 6, maxX: 21 + offsetX, maxY: offsetY + 7, id: 21, text: "I", character: "I", isKeyboardKey: true },
    { minX: 22 + offsetX, minY: offsetY + 6, maxX: 23 + offsetX, maxY: offsetY + 7, id: 22, text: "O", character: "O", isKeyboardKey: true },
    { minX: 24 + offsetX, minY: offsetY + 6, maxX: 25 + offsetX, maxY: offsetY + 7, id: 23, text: "P", character: "P", isKeyboardKey: true },
    { minX: 26 + offsetX, minY: offsetY + 6, maxX: 27 + offsetX, maxY: offsetY + 7, id: 24, text: "+", character: "+", isKeyboardKey: true },
    { minX: 28 + offsetX, minY: offsetY + 6, maxX: 30 + offsetX, maxY: offsetY + 7, id: 25, text: "/", character: "/", isKeyboardKey: true },
    
    // Tercera fila (26-37)
    { minX: 4 + offsetX, minY: offsetY + 4, maxX: 6 + offsetX, maxY: offsetY + 5, id: 26, text: "CAPS", character: "CAPS", isKeyboardKey: true },
    { minX: 7 + offsetX, minY: offsetY + 4, maxX: 8 + offsetX, maxY: offsetY + 5, id: 27, text: "A", character: "A", isKeyboardKey: true },
    { minX: 9 + offsetX, minY: offsetY + 4, maxX: 10 + offsetX, maxY: offsetY + 5, id: 28, text: "S", character: "S", isKeyboardKey: true },
    { minX: 11 + offsetX, minY: offsetY + 4, maxX: 12 + offsetX, maxY: offsetY + 5, id: 29, text: "D", character: "D", isKeyboardKey: true },
    { minX: 13 + offsetX, minY: offsetY + 4, maxX: 14 + offsetX, maxY: offsetY + 5, id: 30, text: "F", character: "F", isKeyboardKey: true },
    { minX: 15 + offsetX, minY: offsetY + 4, maxX: 16 + offsetX, maxY: offsetY + 5, id: 31, text: "G", character: "G", isKeyboardKey: true },
    { minX: 17 + offsetX, minY: offsetY + 4, maxX: 18 + offsetX, maxY: offsetY + 5, id: 32, text: "H", character: "H", isKeyboardKey: true },
    { minX: 19 + offsetX, minY: offsetY + 4, maxX: 20 + offsetX, maxY: offsetY + 5, id: 33, text: "J", character: "J", isKeyboardKey: true },
    { minX: 21 + offsetX, minY: offsetY + 4, maxX: 22 + offsetX, maxY: offsetY + 5, id: 34, text: "K", character: "K", isKeyboardKey: true },
    { minX: 23 + offsetX, minY: offsetY + 4, maxX: 24 + offsetX, maxY: offsetY + 5, id: 35, text: "L", character: "L", isKeyboardKey: true },
    { minX: 25 + offsetX, minY: offsetY + 4, maxX: 26 + offsetX, maxY: offsetY + 5, id: 36, text: "-", character: "-", isKeyboardKey: true },
    { minX: 27 + offsetX, minY: offsetY + 4, maxX: 30 + offsetX, maxY: offsetY + 5, id: 37, text: "F11", character: "F11", isKeyboardKey: true },
    
    // Cuarta fila (38-48)
    { minX: 4 + offsetX, minY: offsetY + 2, maxX: 6 + offsetX, maxY: offsetY + 3, id: 38, text: "SHIFT", character: "SHIFT", isKeyboardKey: true },
    { minX: 7 + offsetX, minY: offsetY + 2, maxX: 8 + offsetX, maxY: offsetY + 3, id: 39, text: "Z", character: "Z", isKeyboardKey: true },
    { minX: 9 + offsetX, minY: offsetY + 2, maxX: 10 + offsetX, maxY: offsetY + 3, id: 40, text: "X", character: "X", isKeyboardKey: true },
    { minX: 11 + offsetX, minY: offsetY + 2, maxX: 12 + offsetX, maxY: offsetY + 3, id: 41, text: "C", character: "C", isKeyboardKey: true },
    { minX: 13 + offsetX, minY: offsetY + 2, maxX: 14 + offsetX, maxY: offsetY + 3, id: 42, text: "V", character: "V", isKeyboardKey: true },
    { minX: 15 + offsetX, minY: offsetY + 2, maxX: 16 + offsetX, maxY: offsetY + 3, id: 43, text: "B", character: "B", isKeyboardKey: true },
    { minX: 17 + offsetX, minY: offsetY + 2, maxX: 18 + offsetX, maxY: offsetY + 3, id: 44, text: "N", character: "N", isKeyboardKey: true },
    { minX: 19 + offsetX, minY: offsetY + 2, maxX: 20 + offsetX, maxY: offsetY + 3, id: 45, text: "M", character: "M", isKeyboardKey: true },
    { minX: 21 + offsetX, minY: offsetY + 2, maxX: 22 + offsetX, maxY: offsetY + 3, id: 46, text: ".", character: ".", isKeyboardKey: true },
    { minX: 23 + offsetX, minY: offsetY + 2, maxX: 24 + offsetX, maxY: offsetY + 3, id: 47, text: ",", character: ",", isKeyboardKey: true },
    { minX: 25 + offsetX, minY: offsetY + 2, maxX: 30 + offsetX, maxY: offsetY + 3, id: 48, text: "ENTER", character: "ENTER", isKeyboardKey: true },
    
    // Quinta fila (49-56)
    { minX: 4 + offsetX, minY: offsetY + 0, maxX: 5 + offsetX, maxY: offsetY + 1, id: 49, text: "CTRL", character: "CTRL", isKeyboardKey: true },
    { minX: 6 + offsetX, minY: offsetY + 0, maxX: 7 + offsetX, maxY: offsetY + 1, id: 50, text: "ALT", character: "ALT", isKeyboardKey: true },
    { minX: 8 + offsetX, minY: offsetY + 0, maxX: 9 + offsetX, maxY: offsetY + 1, id: 51, text: "*", character: "*", isKeyboardKey: true },
    { minX: 10 + offsetX, minY: offsetY + 0, maxX: 20 + offsetX, maxY: offsetY + 1, id: 52, text: "SPACE", character: "SPACEBAR", isKeyboardKey: true },
    { minX: 21 + offsetX, minY: offsetY + 0, maxX: 22 + offsetX, maxY: offsetY + 1, id: 53, text: "?", character: "?", isKeyboardKey: true },
    { minX: 23 + offsetX, minY: offsetY + 0, maxX: 24 + offsetX, maxY: offsetY + 1, id: 54, text: "!", character: "!", isKeyboardKey: true },
    { minX: 25 + offsetX, minY: offsetY + 0, maxX: 27 + offsetX, maxY: offsetY + 1, id: 55, text: "CTRL", character: "CTRL", isKeyboardKey: true },
    { minX: 28 + offsetX, minY: offsetY + 0, maxX: 30 + offsetX, maxY: offsetY + 1, id: 56, text: "F5", character: "F5", isKeyboardKey: true }
  ];
  
  // Crear cada panel según el layout
  return keyboardLayout.map(key => {
    const displayText = key.text;
    
    return {
      minCellIndex: { x: key.minX, y: key.minY },
      maxCellIndex: { x: key.maxX, y: key.maxY },
      orderNumber: key.id,
      showOrderNumber: keyboardState.showOrderNumbers,
      selected: false,
      hovered: false,
      isKeyboardKey: true,
      behavior: {
        hasText: true,
        textContent: displayText,
        messageBuffer: [],
        maxLines: 1,
        isPassword: false,
        isGATCActive: false,
        modelData: null,
        genomData: null,
        keyboardKey: key.id,
        character: key.character
      },
      // Agregar una función de evento para cuando se presione la tecla
      onPress: () => handleKeyPress(key.id),
      // Agregar referencia a los materiales compartidos
      materials: keyMaterials
    };
  });
}

// Variable para almacenar el texto ingresado
let inputText = "";
let consoleElement = null;

// Función para actualizar la visualización de texto
function updateDisplay(text) {
  if (consoleElement) {
    consoleElement.textContent = text;
  } else {
    console.log("Texto actual:", text);
  }
}

// Función para manejar eventos de teclas
function handleKeyPress(keyId, customCallback) {
    // Buscar el carácter correspondiente a la tecla
    const keyboardLayout = createKeyboard();
    const keyInfo = keyboardLayout.find(panel => panel.orderNumber === keyId);
    
    if (!keyInfo) return;
    
    const character = keyInfo.behavior.character;
    
    // Imprimir información detallada de la tecla presionada
    console.log('-------------------');
    console.log(`Tecla bioKeyb presionada:`);
    console.log(`- Carácter: ${character}`);
    console.log(`- ID: ${keyId}`);
    console.log(`- Texto mostrado: ${keyInfo.behavior.textContent}`);
    console.log('-------------------');
    
    // Comprobar si estamos en modo de escritura y si la tecla está en la lista de teclas desactivadas
    const activeElement = document.activeElement;
    keyboardState.isWriting = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement ||
                             (activeElement && activeElement.isContentEditable);
    
    // Si estamos escribiendo y la tecla está en la lista de desactivadas, ignorarla
    if (keyboardState.isWriting && 
        keyboardState.disabledKeys.includes(character.toUpperCase()) &&
        character.length === 1) {
        console.log(`Tecla ${character} desactivada mientras se escribe`);
        return;
    }
    
    // Manejar teclas especiales primero
    switch(character) {
        case 'CAPS':
            keyboardState.capsLock = !keyboardState.capsLock;
            console.log(`CAPS ${keyboardState.capsLock ? 'activado' : 'desactivado'}`);
            return;
        case 'SHIFT':
            keyboardState.shift = !keyboardState.shift;
            console.log(`SHIFT ${keyboardState.shift ? 'activado' : 'desactivado'}`);
            return;
        case 'ESC':
            // Solo deseleccionar paneles y cancelar selección
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            const target = document.activeElement || document;
            target.dispatchEvent(escEvent);
            console.log('Tecla ESC presionada: Solo deseleccionar paneles');
            return;
        case 'F5':
            // Recargar la página
            window.location.reload();
            return;
        case 'F11':
            // Entrar/salir de pantalla completa
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
            return;
    }

    // Determinar el carácter a enviar
    let charToSend = character;
    if (character.length === 1) {
        if (keyboardState.capsLock || keyboardState.shift) {
            charToSend = character.toUpperCase();
        } else {
            charToSend = character.toLowerCase();
        }
    }

    try {
        // Obtener el elemento objetivo
        const target = document.activeElement || document;
        
        // Para teclas especiales como ENTER, BACKSPACE, etc.
        if (character === 'ENTER') {
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            target.dispatchEvent(event);
            return;
        }
        
        if (character === 'BACKSPACE') {
            const event = new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true
            });
            target.dispatchEvent(event);
            return;
        }
        
        if (character === 'SPACEBAR') {
            // Insertar espacio directamente si es un elemento de entrada
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                const start = target.selectionStart;
                const end = target.selectionEnd;
                target.value = target.value.substring(0, start) + ' ' + target.value.substring(end);
                target.selectionStart = target.selectionEnd = start + 1;
                return;
            }
            // Si no es un elemento de entrada, enviar evento de espacio
            const event = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
            });
            target.dispatchEvent(event);
            return;
        }

        // Para caracteres normales, insertar directamente en elementos de entrada
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = target.selectionStart;
            const end = target.selectionEnd;
            target.value = target.value.substring(0, start) + charToSend + target.value.substring(end);
            target.selectionStart = target.selectionEnd = start + 1;
        } else {
            // Para otros elementos, enviar un único evento keydown
            const event = new KeyboardEvent('keydown', {
                key: charToSend,
                code: `Key${character.toUpperCase()}`,
                keyCode: charToSend.charCodeAt(0),
                which: charToSend.charCodeAt(0),
                bubbles: true,
                cancelable: true,
                shiftKey: keyboardState.shift,
                ctrlKey: character === 'CTRL',
                altKey: character === 'ALT'
            });
            target.dispatchEvent(event);
        }

    } catch (error) {
        console.error('Error al procesar tecla:', error);
    }

    // Desactivar shift después de usar
    if (keyboardState.shift) {
        keyboardState.shift = false;
    }

    // Si hay un callback personalizado, llamarlo
    if (customCallback && typeof customCallback === 'function') {
        customCallback(charToSend, keyId);
    }
}

// Función auxiliar mejorada para obtener códigos de teclas
function getKeyCode(character) {
  const specialKeyCodes = {
    'ENTER': 13,
    'SHIFT': 16,
    'CTRL': 17,
    'ALT': 18,
    'CAPS': 20,
    'ESCAPE': 27,
    'ESC': 27,
    'SPACEBAR': 32,
    ' ': 32,
    'BACKSPACE': 8,
    'TAB': 9,
    'F5': 116,
    'F11': 122,
    '.': 190,
    ',': 188,
    '/': 191,
    '-': 189,
    '+': 187,
    '*': 56,
    '?': 191,
    '!': 49
  };

  if (specialKeyCodes.hasOwnProperty(character)) {
    return specialKeyCodes[character];
  }
  
  // Para caracteres normales, usar el código ASCII
  return character.toUpperCase().charCodeAt(0);
}

// Función para establecer el elemento de consola
function setConsoleElement(element) {
  consoleElement = element;
  // Mostrar el texto inicial si existe
  if (inputText) {
    updateDisplay(inputText);
  }
}

// Función para mostrar u ocultar los números de orden
function toggleOrderNumbers(show) {
  keyboardState.showOrderNumbers = show !== undefined ? show : !keyboardState.showOrderNumbers;
  console.log(`Números de orden ${keyboardState.showOrderNumbers ? 'MOSTRADOS' : 'OCULTADOS'}`);
  return keyboardState.showOrderNumbers;
}

// Función para inicializar el teclado en la aplicación
async function initBioKeyb(consoleEl) {
  console.log("Asegurando que la fuente 'Press Start 2P' esté cargada y lista para usarse...");
  try {
    // Usar document.fonts.ready que devuelve una Promesa 
    // que se resuelve cuando el documento está listo para renderizar con las fuentes.
    await document.fonts.ready; 
    console.log("Todas las fuentes del documento están listas. 'Press Start 2P' debería estar disponible.");

  } catch (error) {
    console.error("Error crítico al esperar que las fuentes estén listas. El teclado podría no renderizarse correctamente:", error);
  }

  console.log("Inicializando estado de bioKeyb (listeners, etc.)...");
  
  // Ocultar los números de etiqueta por defecto
  keyboardState.showOrderNumbers = false;
  keyboardState.capsLock = false;
  keyboardState.shift = false;
  keyboardState.isWriting = false;
  
  // Configurar elemento de consola si se proporciona
  if (consoleEl) {
    setConsoleElement(consoleEl);
  }
  
  // Agregar listener global para focus
  document.addEventListener('focus', (e) => {
    keyboardState.activeElement = document.activeElement;
    
    // Detectar si estamos en un campo de entrada
    const target = e.target;
    if (target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement || 
        (target && target.isContentEditable)) {
      keyboardState.isWriting = true;
      // console.log('Modo escritura activado automáticamente por focus'); // Opcional: log
    }
  }, true);
  
  // Agregar listener para blur (cuando se pierde el foco)
  document.addEventListener('blur', (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement || 
        (target && target.isContentEditable)) {
      keyboardState.isWriting = false;
      // console.log('Modo escritura desactivado automáticamente por blur'); // Opcional: log
    }
  }, true);
  
  console.log("Estado de bioKeyb inicializado.");
  // Ya no llama a createKeyboard() ni devuelve paneles.
}

// Limpiar el texto de entrada
function clearInput() {
  inputText = "";
  updateDisplay("");
  console.log("Texto limpiado");
}

// Comandos disponibles
const commands = {
  hide: () => toggleOrderNumbers(false),
  show: () => toggleOrderNumbers(true),
  toggle: () => toggleOrderNumbers(),
  clear: clearInput
};

// Función para procesar comandos de consola
function processCommand(cmd) {
  if (!cmd) return false;
  
  const cmdLower = cmd.toLowerCase().trim();
  
  if (commands[cmdLower]) {
    commands[cmdLower]();
    return true;
  }
  
  return false;
}

// Función para crear la etiqueta con el texto de la tecla
function createKeyLabel(panelData, gridSize) { 
    if (!panelData.group) return;
    
    // Limpiar meshes de etiquetas anteriores
    if (panelData.keyLabelMeshes && panelData.keyLabelMeshes.length > 0) {
        panelData.keyLabelMeshes.forEach(mesh => {
            panelData.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        });
    }
    panelData.keyLabelMeshes = [];

    let displayText = panelData.behavior?.textContent || '';
    if (!displayText) return;

    // Usar gridSize por defecto si no se proporciona
    if (gridSize === undefined || gridSize <= 0) {
        gridSize = 0.5;
    }

    // Calcular el espacio disponible en el panel
    const panelWidth = Math.abs(panelData.maxCellIndex.x - panelData.minCellIndex.x + 1);
    const panelHeight = Math.abs(panelData.maxCellIndex.y - panelData.minCellIndex.y + 1);
    
    // Calcular tamaño base para cada carácter
    const baseCharSize = gridSize * 0.8;
    let charSize, charSpacing;
    
    // Ajustar tamaño según si es un carácter individual o parte de una palabra
    if (displayText.length === 1) {
        // Para caracteres individuales, aumentar el tamaño
        charSize = baseCharSize * 1.2; // 20% más grande para símbolos individuales
        charSpacing = charSize * 0.7;
    } else {
        // Para palabras, mantener el tamaño original
        charSize = baseCharSize;
        charSpacing = charSize * 0.7;
    }
    
    // Calcular el espacio total necesario
    const totalWidth = displayText.length * charSpacing;
    
    // Calcular posición inicial para centrar el texto
    const startX = -totalWidth / 2 + charSpacing / 2;
    
    // Crear cada carácter individualmente
    for (let i = 0; i < displayText.length; i++) {
        const char = displayText[i];
        if (char === ' ') continue; // Saltar espacios
        
        // Crear canvas para este carácter
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const canvasSize = 256;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        
        // Limpiar y preparar el canvas
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Ajustar el tamaño de la fuente según si es carácter individual o parte de palabra
        const fontSize = displayText.length === 1 ? 
            canvasSize * 0.8 :  // Más grande para caracteres individuales
            canvasSize * 0.7;   // Tamaño normal para palabras
            
        context.font = `${fontSize}px "Press Start 2P", monospace`;
        
        // Dibujar el carácter
        context.fillText(char, canvasSize/2, canvasSize/2);
        
        // Crear textura
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4;
        
        // Crear material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        // Crear geometría cuadrada usando el tamaño ajustado
        const geometry = new THREE.PlaneGeometry(charSize, charSize);
        
        // Crear mesh
        const charMesh = new THREE.Mesh(geometry, material);
        
        // Posicionar el carácter
        charMesh.position.set(
            startX + i * charSpacing,
            0,
            0.02
        );
        
        // Añadir al grupo y guardar referencia
        panelData.group.add(charMesh);
        panelData.keyLabelMeshes.push(charMesh);
    }
}

// Modificar la función updatePanelColor para usar los materiales compartidos
function updatePanelColor(panelData) {
    if (!panelData || !panelData.group) return;
    
    let targetLineMaterial;
    let targetFillMaterial;

    // Si es una tecla del teclado, nunca usar el material "selected"
    if (panelData.isKeyboardKey) {
        if (panelData.hovered) {
            targetLineMaterial = keyMaterials.hover.line;
            targetFillMaterial = keyMaterials.hover.fill;
        } else {
            targetLineMaterial = keyMaterials.normal.line;
            targetFillMaterial = keyMaterials.normal.fill;
        }
    } else {
        // Comportamiento normal para paneles regulares
        if (panelData.selected) {
            targetLineMaterial = keyMaterials.selected.line;
            targetFillMaterial = keyMaterials.selected.fill;
        } else if (panelData.hovered) {
            targetLineMaterial = keyMaterials.hover.line;
            targetFillMaterial = keyMaterials.hover.fill;
        } else {
            targetLineMaterial = keyMaterials.normal.line;
            targetFillMaterial = keyMaterials.normal.fill;
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

// Función para configurar las teclas desactivadas durante la escritura
function setDisabledKeys(keys) {
  if (Array.isArray(keys)) {
    keyboardState.disabledKeys = keys.map(key => key.toUpperCase());
    console.log(`Teclas desactivadas durante escritura: ${keyboardState.disabledKeys.join(', ')}`);
  }
}

// Función para activar/desactivar el modo de escritura manualmente
function setWritingMode(isWriting) {
  keyboardState.isWriting = !!isWriting;
  console.log(`Modo escritura: ${keyboardState.isWriting ? 'ACTIVADO' : 'DESACTIVADO'}`);
}

// Exportar funciones del módulo
export { 
  initBioKeyb, 
  createKeyboard,
  KEY_SYMBOLS,
  handleKeyPress,
  keyboardState,
  toggleCase,
  clearInput,
  setConsoleElement,
  toggleOrderNumbers,
  processCommand,
  createKeyLabel,
  updatePanelColor,
  setDisabledKeys,
  setWritingMode
}; 
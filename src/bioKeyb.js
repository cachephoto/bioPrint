// bioKeyb.js - Módulo para recrear el teclado virtual bioKeyb
// Copyright (C) 2023 Ihtoa Ware Inc.

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

// Crear teclado a partir de la configuración
function createKeyboard() {
  console.log("Creando teclado bioKeyb...");
  
  // Ajustar coordenadas para centrar horizontalmente
  const centroX = 25; // Centro horizontal aproximado
  const offsetX = centroX - 20; // Ajustado para centrar un teclado más compacto
  
  // Definición de las teclas según la configuración del archivo
  const keyboardLayout = [
    // Primera fila (1-12)
    { minX: 4 + offsetX, minY: 28, maxX: 6.5 + offsetX, maxY: 29, id: 1 },
    { minX: 7.5 + offsetX, minY: 28, maxX: 8.5 + offsetX, maxY: 29, id: 2 },
    { minX: 9.5 + offsetX, minY: 28, maxX: 10.5 + offsetX, maxY: 29, id: 3 },
    { minX: 11.5 + offsetX, minY: 28, maxX: 12.5 + offsetX, maxY: 29, id: 4 },
    { minX: 13.5 + offsetX, minY: 28, maxX: 14.5 + offsetX, maxY: 29, id: 5 },
    { minX: 15.5 + offsetX, minY: 28, maxX: 16.5 + offsetX, maxY: 29, id: 6 },
    { minX: 17.5 + offsetX, minY: 28, maxX: 18.5 + offsetX, maxY: 29, id: 7 },
    { minX: 19.5 + offsetX, minY: 28, maxX: 20.5 + offsetX, maxY: 29, id: 8 },
    { minX: 21.5 + offsetX, minY: 28, maxX: 22.5 + offsetX, maxY: 29, id: 9 },
    { minX: 23.5 + offsetX, minY: 28, maxX: 24.5 + offsetX, maxY: 29, id: 10 },
    { minX: 25.5 + offsetX, minY: 28, maxX: 26.5 + offsetX, maxY: 29, id: 11 },
    { minX: 27.5 + offsetX, minY: 28, maxX: 30 + offsetX, maxY: 29, id: 12 },
    
    // Segunda fila (13-25)
    { minX: 4 + offsetX, minY: 26, maxX: 5 + offsetX, maxY: 27, id: 13 },
    { minX: 6 + offsetX, minY: 26, maxX: 7 + offsetX, maxY: 27, id: 14 },
    { minX: 8 + offsetX, minY: 26, maxX: 9 + offsetX, maxY: 27, id: 15 },
    { minX: 10 + offsetX, minY: 26, maxX: 11 + offsetX, maxY: 27, id: 16 },
    { minX: 12 + offsetX, minY: 26, maxX: 13 + offsetX, maxY: 27, id: 17 },
    { minX: 14 + offsetX, minY: 26, maxX: 15 + offsetX, maxY: 27, id: 18 },
    { minX: 16 + offsetX, minY: 26, maxX: 17 + offsetX, maxY: 27, id: 19 },
    { minX: 18 + offsetX, minY: 26, maxX: 19 + offsetX, maxY: 27, id: 20 },
    { minX: 20 + offsetX, minY: 26, maxX: 21 + offsetX, maxY: 27, id: 21 },
    { minX: 22 + offsetX, minY: 26, maxX: 23 + offsetX, maxY: 27, id: 22 },
    { minX: 24 + offsetX, minY: 26, maxX: 25 + offsetX, maxY: 27, id: 23 },
    { minX: 26 + offsetX, minY: 26, maxX: 27 + offsetX, maxY: 27, id: 24 },
    { minX: 28 + offsetX, minY: 26, maxX: 30 + offsetX, maxY: 27, id: 25 },
    
    // Tercera fila (26-37)
    { minX: 4 + offsetX, minY: 24, maxX: 6 + offsetX, maxY: 25, id: 26 },
    { minX: 7 + offsetX, minY: 24, maxX: 8 + offsetX, maxY: 25, id: 27 },
    { minX: 9 + offsetX, minY: 24, maxX: 10 + offsetX, maxY: 25, id: 28 },
    { minX: 11 + offsetX, minY: 24, maxX: 12 + offsetX, maxY: 25, id: 29 },
    { minX: 13 + offsetX, minY: 24, maxX: 14 + offsetX, maxY: 25, id: 30 },
    { minX: 15 + offsetX, minY: 24, maxX: 16 + offsetX, maxY: 25, id: 31 },
    { minX: 17 + offsetX, minY: 24, maxX: 18 + offsetX, maxY: 25, id: 32 },
    { minX: 19 + offsetX, minY: 24, maxX: 20 + offsetX, maxY: 25, id: 33 },
    { minX: 21 + offsetX, minY: 24, maxX: 22 + offsetX, maxY: 25, id: 34 },
    { minX: 23 + offsetX, minY: 24, maxX: 24 + offsetX, maxY: 25, id: 35 },
    { minX: 25 + offsetX, minY: 24, maxX: 26 + offsetX, maxY: 25, id: 36 },
    { minX: 27 + offsetX, minY: 24, maxX: 30 + offsetX, maxY: 25, id: 37 }, // Fusión de 37 y 38
    
    // Cuarta fila (38-48) - Renumerada
    { minX: 4 + offsetX, minY: 22, maxX: 6 + offsetX, maxY: 23, id: 38 },
    { minX: 7 + offsetX, minY: 22, maxX: 8 + offsetX, maxY: 23, id: 39 },
    { minX: 9 + offsetX, minY: 22, maxX: 10 + offsetX, maxY: 23, id: 40 },
    { minX: 11 + offsetX, minY: 22, maxX: 12 + offsetX, maxY: 23, id: 41 },
    { minX: 13 + offsetX, minY: 22, maxX: 14 + offsetX, maxY: 23, id: 42 },
    { minX: 15 + offsetX, minY: 22, maxX: 16 + offsetX, maxY: 23, id: 43 },
    { minX: 17 + offsetX, minY: 22, maxX: 18 + offsetX, maxY: 23, id: 44 },
    { minX: 19 + offsetX, minY: 22, maxX: 20 + offsetX, maxY: 23, id: 45 },
    { minX: 21 + offsetX, minY: 22, maxX: 22 + offsetX, maxY: 23, id: 46 },
    { minX: 23 + offsetX, minY: 22, maxX: 24 + offsetX, maxY: 23, id: 47 },
    { minX: 25 + offsetX, minY: 22, maxX: 30 + offsetX, maxY: 23, id: 48 }, // Fusión de 50 y 51
    
    // Quinta fila (49-56) - Renumerada, barra espaciadora y otras teclas
    { minX: 4 + offsetX, minY: 20, maxX: 5 + offsetX, maxY: 21, id: 49 },
    { minX: 6 + offsetX, minY: 20, maxX: 7 + offsetX, maxY: 21, id: 50 },
    { minX: 8 + offsetX, minY: 20, maxX: 9 + offsetX, maxY: 21, id: 51 },
    { minX: 10 + offsetX, minY: 20, maxX: 20 + offsetX, maxY: 21, id: 52 }, // Barra espaciadora
    { minX: 21 + offsetX, minY: 20, maxX: 22 + offsetX, maxY: 21, id: 53 },
    { minX: 23 + offsetX, minY: 20, maxX: 24 + offsetX, maxY: 21, id: 54 },
    { minX: 25 + offsetX, minY: 20, maxX: 27 + offsetX, maxY: 21, id: 55 },
    { minX: 28 + offsetX, minY: 20, maxX: 30 + offsetX, maxY: 21, id: 56 }
  ];
  
  // Crear cada panel según el layout
  return keyboardLayout.map(key => {
    // Convertir la definición de la tecla a la estructura de panel esperada
    return {
      minCellIndex: { x: key.minX, y: key.minY },
      maxCellIndex: { x: key.maxX, y: key.maxY },
      orderNumber: key.id,
      showOrderNumber: true,
      selected: false,
      behavior: {
        hasText: false,
        textContent: "",
        messageBuffer: [],
        maxLines: 0,
        isPassword: false,
        isGATCActive: false,
        modelData: null,
        genomData: null
      }
    };
  });
}

// Función para inicializar el teclado en la aplicación
function initBioKeyb(scene, createPanelFunction) {
  console.log("Inicializando bioKeyb");
  // Obtener el layout del teclado
  const keyboardPanels = createKeyboard();
  
  // Crear cada panel usando la función de creación proporcionada
  return keyboardPanels;
}

// Exportar funciones del módulo
export { 
  initBioKeyb, 
  createKeyboard 
}; 
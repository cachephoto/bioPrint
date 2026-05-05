# BioPrint UI - Critical Path y Documentación Global

## 📋 Descripción Global del Funcionamiento

**BioPrint UI** es una aplicación web de bioimpresión 3D con interfaz gráfica tridimensional construida con Three.js. El sistema permite crear, manipular y visualizar paneles interactivos en un espacio 3D, cargar modelos biológicos (órganos, estructuras), gestionar texto editable, aplicar efectos visuales post-procesamiento, y controlar todo mediante una terminal de comandos integrada.

### Arquitectura Principal

El sistema sigue una **filosofía procedural** orientada a:
- **Carga rápida**: Instanciación optimizada en GPU
- **Rendimiento**: Uso eficiente de recursos WebGL
- **Modularidad**: Separación clara de responsabilidades por módulos

### Componentes Core

1. **Sistema de Grid 3D**: Base sobre la que se construyen todos los paneles
2. **Sistema de Paneles**: Elementos interactivos que pueden contener texto, modelos, animaciones
3. **Sistema de Texto**: Editor de texto pixelado con fuente "Press Start 2P"
4. **Sistema de Modelos**: Carga y visualización de modelos OBJ (órganos, estructuras biológicas)
5. **Sistema de Efectos (bioFX)**: Post-procesamiento con shaders (bloom, color blend, glitch)
6. **Sistema de Terminal**: Consola de comandos para controlar la aplicación
7. **Sistema de Teclado Virtual (bioKeyb)**: Teclado 3D interactivo
8. **Sistema de Animaciones**: Modelos genómicos (ADN/ARN), codones, rotaciones

---

## 🔴 CRITICAL PATH - Flujo de Ejecución Principal

### FASE 1: INICIALIZACIÓN (0-3 segundos)

```
1. DOMContentLoaded
   ├─> Mostrar splash screen con logo BioPrint
   ├─> Animar puntos suspensivos "Iniciando..."
   └─> Crear overlay negro para transición

2. setTimeout(3000ms)
   ├─> Fade out splash screen
   ├─> Fade in app container
   └─> Remover overlay negro

3. startGridAnimation24Frames()
   ├─> Crear grid inicial con 2 subdivisiones
   ├─> Animar zoom de cámara (100 → 10)
   ├─> Incrementar subdivisiones cada frame (2, 4, 6... 48)
   └─> 24 frames totales de animación

4. Inicialización de módulos
   ├─> initPanelText() - Precarga caracteres comunes
   ├─> initBioFX() - Configura EffectComposer
   ├─> initBioKeyb() - Espera carga de fuentes
   └─> initTerminalConsole() - Configura terminal
```

### FASE 2: SETUP DE ESCENA 3D

```
5. Creación de escena Three.js
   ├─> Scene, Camera (PerspectiveCamera), Renderer (WebGLRenderer)
   ├─> OrbitControls para navegación
   ├─> Configuración de iluminación (AmbientLight, DirectionalLight)
   └─> Configuración de post-procesamiento (EffectComposer)

6. Creación del grid base
   ├─> GridHelper con subdivisiones dinámicas
   ├─> Materiales para líneas del grid
   └─> Posicionamiento en Z=0
```

### FASE 3: LOOP DE RENDERIZACIÓN (60 FPS)

```
7. requestAnimationFrame loop
   ├─> OrbitControls.update() - Actualizar controles de cámara
   ├─> animateModels() - Rotar modelos 3D
   ├─> animateGenoms() - Animar hélices de ADN
   ├─> animateCodons() - Animar modelos de codones
   ├─> updateGlitchTime() - Actualizar tiempo para shader glitch
   ├─> renderBioFX() - Renderizar con post-procesamiento
   └─> requestAnimationFrame(animate) - Siguiente frame
```

### FASE 4: INTERACCIÓN DEL USUARIO

```
8. Eventos de mouse/touch
   ├─> Raycasting para detectar intersecciones
   ├─> Selección de paneles (click simple)
   ├─> Creación de paneles (drag/box selection)
   ├─> Edición de texto (triple click)
   └─> Navegación 3D (drag con mouse/touch)

9. Eventos de teclado
   ├─> T - Toggle terminal
   ├─> V - Menú rápido
   ├─> K - Toggle teclado virtual
   ├─> ESC - Cancelar operaciones
   └─> Comandos de terminal
```

### FASE 5: OPERACIONES DE PANELES

```
10. Creación de panel
    ├─> createPanelFromBoundingBox()
    ├─> Calcular minCellIndex/maxCellIndex
    ├─> Crear geometría (PlaneGeometry para fill, LineSegments para bordes)
    ├─> Aplicar materiales (normal/hover/selected)
    ├─> Agregar a scene
    └─> Registrar en array panels[]

11. Edición de texto en panel
    ├─> startTextEditing(panel)
    ├─> createPanelText(panel, gridSize)
    ├─> Generar meshes de caracteres (createCharacterMesh)
    ├─> Posicionar texto con alineación
    ├─> Crear cursor parpadeante
    └─> handleTextInput() - Procesar entrada

12. Carga de modelo 3D
    ├─> loadModelToPanel(panel, modelUrl, gridSize)
    ├─> fetch(modelUrl) - Cargar archivo OBJ
    ├─> OBJLoader.parse() - Parsear geometría
    ├─> Calcular escala para ajustar al panel
    ├─> Aplicar rotación isométrica (90° en X para acostar modelo)
    ├─> Crear materiales (solid, wireframe, edges)
    └─> Agregar a panel.group
```

### FASE 6: COMANDOS DE TERMINAL

```
13. processTerminalCommand(command)
    ├─> Parsear comando y argumentos
    ├─> Ejecutar función correspondiente
    ├─> Mostrar resultado en terminal-output
    └─> Auto-ocultar terminal después de 1.5s (excepto comandos interactivos)
```

---

## 📝 LISTA COMPLETA DE COMANDOS

### Comandos de Navegación y Visualización

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `help` | Muestra todos los comandos disponibles | `help` |
| `show` | Muestra números de orden en paneles | `show` |
| `hide` | Oculta números de orden en paneles | `hide` |
| `list` | Lista todos los paneles con sus índices | `list` |
| `clear` | Limpia la consola terminal | `clear` |

### Comandos de Selección y Gestión de Paneles

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `select <n>` | Selecciona panel por número de orden | `select 5` |
| `select <x1> <y1> <x2> <y2>` | Selecciona paneles en rango de celdas | `select 10 10 20 20` |
| `delete <n>` | Elimina panel por número de orden | `delete 3` |
| `delete <x1> <y1> <x2> <y2>` | Elimina paneles en rango | `delete 5 5 15 15` |
| `index` o `reindex` | Reindexa todos los paneles | `reindex` |

### Comandos de Contenido en Paneles

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `txt <texto>` | Añade texto a panel seleccionado | `txt Hola mundo` |
| `txt pass` | Activa modo contraseña (oculta texto) | `txt pass` |
| `model <nombre>` | Carga modelo 3D en panel seleccionado | `model corazon` |
| `models` | Crea rejilla 3x3 de modelos biológicos en panel seleccionado | `models` |
| `logo` | Muestra logo BioPrint en panel seleccionado | `logo` |
| `apps` | Crea grid de 20 iconos de apps en panel | `apps` |

### Comandos de Modelos Biológicos

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `genom` | Carga modelo de ADN (hélice doble) | `genom` |
| `gtac` | Carga secuencia GTAC animada | `gtac` |
| `codon` | Carga modelo de codón (ADN/ARN) | `codon` |
| `splice` | Aplica efecto de splicing genético | `splice` |

### Comandos de Efectos Visuales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `zeng` | Activa efecto de color azul (R0 G125 B255) | `zeng` |
| `boris` | Activa efecto Matrix verde (R0 G255 B0) | `boris` |
| `ann` | Activa efecto cyan (R0 G225 B255) | `ann` |
| `glitch` | Activa efecto glitch tradicional | `glitch` |
| `flash` | Aplica efecto de flash a paneles | `flash` |

### Comandos de Configuración

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `statg` | Muestra estadísticas del grid | `statg` |
| `stack` | Muestra información de stack | `stack` |
| `print` | Inicia proceso de impresión | `print` |
| `terms` | Muestra términos científicos | `terms` |

### Comandos de Prueba y Demo

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `demo` | Ejecuta demostración automática | `demo` |
| `multitest` | Ejecuta pruebas múltiples | `multitest` |
| `horizontal` | Prueba layout horizontal | `horizontal` |

---

## 🔧 MÓDULOS Y SUS CONEXIONES

### main.js (Core)
- **Importa**: Todos los módulos especializados
- **Exporta**: Funciones globales de inicialización
- **Conexiones**:
  - `panelText.js` → Gestión de texto en paneles
  - `panelModel.js` → Carga de modelos 3D
  - `bioFX.js` → Efectos post-procesamiento
  - `bioKeyb.js` → Teclado virtual
  - `bioLoad.js` → Barras de progreso
  - `bioApps.js` → Grid de iconos de apps
  - `genomModel.js` → Modelos de ADN
  - `codonModel.js` → Modelos de codones
  - `bioLOGO.js` → Logo flotante

### panelText.js
- **Responsabilidad**: Renderizado de texto pixelado editable
- **Conexiones**:
  - `bioKeyb.js` → Detección de modo escritura
  - `main.js` → Integración con paneles
- **Funciones clave**:
  - `createPanelText()` - Renderiza texto en panel
  - `handleTextInput()` - Procesa entrada de teclado
  - `startTextEditing()` / `stopTextEditing()` - Control de edición

### panelModel.js
- **Responsabilidad**: Carga y animación de modelos OBJ
- **Conexiones**:
  - `main.js` → Integración con paneles
- **Funciones clave**:
  - `loadModelToPanel()` - Carga modelo desde URL
  - `animateModels()` - Loop de animación de rotación
  - `toggleModelRotation()` - Control de rotación

### bioFX.js
- **Responsabilidad**: Efectos visuales post-procesamiento
- **Conexiones**:
  - `main.js` → Integración en loop de renderizado
- **Funciones clave**:
  - `initBioFX()` - Configura EffectComposer
  - `setColorEffect()` - Efecto de color blend
  - `setBloomEffect()` - Efecto bloom/glow
  - `setGlitchEffect()` - Efecto glitch

### bioKeyb.js
- **Responsabilidad**: Teclado virtual 3D
- **Conexiones**:
  - `panelText.js` → Sincronización modo escritura
  - `main.js` → Integración con escena
- **Funciones clave**:
  - `createKeyboard()` - Genera layout de teclado
  - `handleKeyPress()` - Procesa pulsaciones
  - `setWritingMode()` - Control de estado escritura

### genomModel.js
- **Responsabilidad**: Modelos de ADN (hélices dobles)
- **Conexiones**:
  - `main.js` → Comando `genom`
- **Funciones clave**:
  - `loadGenomToPanel()` - Carga hélice de ADN
  - `animateGenoms()` - Anima rotación y pulso

### codonModel.js
- **Responsabilidad**: Modelos de codones (ADN/ARN)
- **Conexiones**:
  - `main.js` → Comando `codon`
- **Funciones clave**:
  - `loadCodonToPanel()` - Carga modelo de codón
  - `animateCodons()` - Anima ciclo de bases

### bioLoad.js
- **Responsabilidad**: Barras de progreso
- **Conexiones**:
  - `main.js` → Visualización de carga
- **Funciones clave**:
  - `createProgressPanel()` - Crea barra de progreso
  - `updateProgressBar()` - Actualiza porcentaje

### bioApps.js
- **Responsabilidad**: Grid de iconos de aplicaciones
- **Conexiones**:
  - `main.js` → Comando `apps`
- **Funciones clave**:
  - `createAppGrid()` - Crea grid 5x4 de iconos

### mapApps.js
- **Responsabilidad**: Mapeo de coordenadas UV para iconos
- **Conexiones**:
  - `main.js` → Comando `apps`
- **Funciones clave**:
  - `mapApps()` - Procesa comando y crea grid

### bioLOGO.js
- **Responsabilidad**: Logo flotante BioPrint
- **Conexiones**:
  - `main.js` → Comando `logo`
- **Funciones clave**:
  - `toggleLogo()` - Muestra/oculta logo
  - `updateOnPanelMove()` - Sigue panel seleccionado

---

## 🧬 MODELOS BIOLÓGICOS DISPONIBLES

El sistema incluye 9 modelos biológicos 3D que se pueden cargar individualmente con `model <nombre>` o en una rejilla 3x3 con `models`:

| Modelo | Nombre Científico | Archivo |
|--------|-------------------|---------|
| `corazon` | HOMO SAPIENS SAPIENS | `corazon.obj` |
| `hueso` | BOS TAURUS | `hueso.obj` |
| `axolotl` | AMBYSTOMA MEXICANUM | `axolotl.obj` |
| `discus` | SYMPHYSODON DYSCUS | `discus.obj` |
| `dog` | CANIS LUPUS FAMILIARIS | `dog.obj` |
| `acot` | CAMBARELLUS MONTEZUMAE | `acot.obj` |
| `tort` | TRACHEMYS SCRIPTA ELEGANS | `tort.obj` |
| `ham` | SUS SCROFA | `ham.obj` |
| `pollo` | GALLUS GALLUS DOMESTICUS | `pollo.obj` |

**Nota**: Los modelos se cargan desde `public/models/` y se rotan automáticamente. Usa `model rotate` para alternar la rotación y `model speed [valor]` para ajustar la velocidad.

---

## 🎯 FLUJOS DE OPERACIÓN CRÍTICOS

### Flujo 1: Crear Panel con Texto
```
Usuario: Triple click en grid
  → detectTripleClick()
  → startTextEditing(panel)
  → createPanelText(panel, gridSize)
  → Generar meshes de caracteres
  → Mostrar cursor parpadeante
  → handleTextInput() en cada tecla
  → Actualizar texto en tiempo real
```

### Flujo 2: Cargar Modelo 3D
```
Usuario: Comando "model corazon"
  → processTerminalCommand("model corazon")
  → handleModelCommand(["corazon"], output)
  → loadModelToPanel(panel, "models/corazon.obj", gridSize)
  → fetch("models/corazon.obj")
  → OBJLoader.parse()
  → Calcular bounding box y escala
  → Aplicar rotación 90° en X (para acostar modelo)
  → Crear materiales (solid + wireframe + edges)
  → Agregar a panel.group
  → Guardar metadata en panel.modelData
  → animateModels() rota modelo continuamente
```

### Flujo 3: Crear Rejilla 3x3 de Modelos
```
Usuario: Comando "models"
  → processTerminalCommand("models")
  → handleModelsCommand(output)
  → Verificar panel seleccionado como contenedor
  → Dividir panel en rejilla 3x3 (9 paneles)
  → Cargar modelos: corazon, hueso, axolotl, discus, dog, acot, tort, ham, pollo
  → loadModelToPanel() para cada modelo
  → Eliminar panel contenedor original
  → Cada modelo rota automáticamente con velocidad aleatoria
```

### Flujo 4: Aplicar Efecto Visual
```
Usuario: Comando "zeng"
  → processTerminalCommand("zeng")
  → setColorEffect(0x007dff, intensity, blendType)
  → Actualizar uniforms del shader
  → renderBioFX() aplica efecto en cada frame
```

### Flujo 5: Terminal Interactiva
```
Usuario: Presiona T
  → toggleTerminal(true)
  → Mostrar terminal-console
  → Usuario escribe comando y presiona Enter
  → processTerminalCommand(command)
  → Ejecutar función correspondiente
  → Mostrar resultado en terminal-output
  → Auto-ocultar después de 1.5s
```

---

## 🚀 COMANDOS DE DESARROLLO

### Desarrollo
```bash
npm run dev          # Inicia servidor de desarrollo Vite
```

### Build
```bash
npm run build        # Compila TypeScript y construye para producción
```

### Preview
```bash
npm run preview      # Previsualiza build de producción
```

### Linting
```bash
npm run lint         # Ejecuta ESLint
```

---

## 📊 ESTRUCTURA DE ARCHIVOS

```
bioPrint_UI/
├── src/
│   ├── main.js          # Core - Inicialización y loop principal
│   ├── panelText.js     # Sistema de texto editable
│   ├── panelModel.js    # Carga de modelos 3D
│   ├── bioFX.js         # Efectos post-procesamiento
│   ├── bioKeyb.js       # Teclado virtual
│   ├── bioLoad.js       # Barras de progreso
│   ├── bioApps.js       # Grid de iconos
│   ├── genomModel.js    # Modelos de ADN
│   ├── codonModel.js    # Modelos de codones
│   ├── bioLOGO.js       # Logo flotante
│   └── mapApps.js       # Mapeo de iconos
├── public/
│   ├── models/          # Modelos OBJ
│   ├── img/             # Texturas e iconos
│   └── configs/         # Configuraciones guardadas
├── index.html           # HTML principal
├── vite.config.js       # Configuración Vite
└── package.json         # Dependencias
```

---

## 🔄 CICLO DE VIDA DE UN PANEL

1. **Creación**: Usuario dibuja selección → `createPanelFromBoundingBox()`
2. **Inicialización**: Panel agregado a `panels[]` con estado inicial
3. **Selección**: Click en panel → `selectPanel()` → Cambio de materiales
4. **Edición**: Triple click → `startTextEditing()` → Modo edición activo
5. **Contenido**: Comandos añaden texto/modelos/efectos
6. **Animación**: Loop de renderizado actualiza continuamente
7. **Destrucción**: Comando `delete` → Remover de escena y array

---

## ⚡ OPTIMIZACIONES Y MEJORES PRÁCTICAS

### Rendimiento GPU
- **Caché de modelos**: Modelos OBJ se cachean después de primera carga
- **Caché de caracteres**: Texturas de caracteres se reutilizan
- **Instancias compartidas**: Materiales compartidos entre paneles similares
- **Frustum culling**: Solo renderiza objetos visibles

### Gestión de Memoria
- **Dispose explícito**: Geometrías y materiales se liberan al eliminar paneles
- **Limpieza de eventos**: Event listeners se remueven apropiadamente
- **Pool de objetos**: Reutilización de objetos Three.js cuando es posible

### Experiencia de Usuario
- **Feedback visual**: Hover states, selección, animaciones suaves
- **Modo táctil**: Soporte completo para gestos touch
- **Teclado virtual**: Alternativa para dispositivos sin teclado físico
- **Terminal intuitiva**: Comandos simples y feedback inmediato

---

## 🎨 APLICACIONES POTENCIALES

1. **Educación Biomédica**: Visualización interactiva de estructuras biológicas
2. **Simulación de Bioimpresión**: Prototipado de diseños antes de imprimir
3. **Presentaciones Científicas**: Herramienta de visualización 3D para conferencias
4. **Entrenamiento Médico**: Simulación de procedimientos de bioimpresión
5. **Investigación**: Análisis y manipulación de modelos genómicos
6. **Arte Generativo**: Creación de visualizaciones artísticas con modelos biológicos

---

**Versión del Documento**: 1.0  
**Última Actualización**: 2025-01-27  
**Desarrollado por**: Dr. Axolojuandalf & Dr. Boris Schmidt  
**Copyright (C) 2023 Ihtoa Ware Inc.**




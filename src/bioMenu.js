// ============================================================
// bioMenu.js - Quick Command Menu + Terminal Autocomplete
// Toggle with 'G' key
// ============================================================

let bioMenuVisible = false;
let bioMenuElement = null;
let autocompleteElement = null;
let autocompleteSelectedIndex = -1;

// All available commands with descriptions and categories
const COMMAND_LIST = [
    // Color Effects
    { cmd: 'zeng', desc: 'Efecto Zeng (azul)', category: 'Efectos' },
    { cmd: 'matrix', desc: 'Efecto Matrix (verde)', category: 'Efectos' },
    { cmd: 'ann', desc: 'Efecto Ann (rojo)', category: 'Efectos' },
    { cmd: 'flash', desc: 'Flash panel seleccionado', category: 'Efectos' },
    { cmd: 'glitch', desc: 'Glitch refracción roja', category: 'Efectos' },
    // Panel Management
    { cmd: 'select all', desc: 'Seleccionar todos los paneles', category: 'Paneles' },
    { cmd: 'show', desc: 'Mostrar números de paneles', category: 'Paneles' },
    { cmd: 'hide', desc: 'Ocultar números de paneles', category: 'Paneles' },
    { cmd: 'list', desc: 'Listar todos los paneles', category: 'Paneles' },
    { cmd: 'delete selected', desc: 'Eliminar paneles seleccionados', category: 'Paneles' },
    { cmd: 'delete all', desc: 'Eliminar todos los paneles', category: 'Paneles' },
    { cmd: 'horizontal', desc: 'Dividir panel horizontalmente', category: 'Paneles' },
    { cmd: 'index', desc: 'Reindexar todos los paneles', category: 'Paneles' },
    // Content
    { cmd: 'logo', desc: 'Crear logo en panel', category: 'Contenido' },
    { cmd: 'apps', desc: 'Grid de iconos de apps', category: 'Contenido' },
    { cmd: 'social', desc: 'Login con redes sociales', category: 'Contenido' },
    { cmd: 'bypass', desc: 'Saltar pantalla de login (tecla rápida: B)', category: 'Contenido' },
    { cmd: 'loginbtn', desc: 'Panel seleccionado → botón LOG IN', category: 'Contenido' },
    { cmd: 'loginbtn denied', desc: 'Botón → ACCESS DENIED (rojo)', category: 'Contenido' },
    { cmd: 'loginbtn granted', desc: 'Botón → ACCESS GRANTED (verde)', category: 'Contenido' },
    { cmd: 'txt', desc: 'Añadir texto al panel', category: 'Contenido' },
    { cmd: 'terms', desc: 'Términos y condiciones', category: 'Contenido' },
    { cmd: 'modal', desc: 'Crear paneles modal', category: 'Contenido' },
    // 3D Models
    { cmd: 'model', desc: 'Modelo 3D en panel', category: 'Modelos 3D' },
    { cmd: 'model rotate', desc: 'Rotar modelo', category: 'Modelos 3D' },
    { cmd: 'models', desc: 'Rejilla 3x3 modelos biológicos', category: 'Modelos 3D' },
    { cmd: 'viewer', desc: 'Panel como viewer de modelo', category: 'Modelos 3D' },
    { cmd: 'codon', desc: 'Modelo transcripción genética', category: 'Modelos 3D' },
    { cmd: 'statg', desc: 'Estadísticas genómicas', category: 'Modelos 3D' },
    // Genetic
    { cmd: 'genom', desc: 'Visualización de ADN', category: 'Genética' },
    { cmd: 'gatc', desc: 'Secuencia GATC animada', category: 'Genética' },
    { cmd: 'splice', desc: 'Splicing genético', category: 'Genética' },
    { cmd: 'stack', desc: 'Stack genético', category: 'Genética' },
    // Bioprinting
    { cmd: 'print', desc: 'Simulación bioimpresión 3D', category: 'Bioimpresión' },
    { cmd: 'print percent', desc: 'Barra de progreso con %', category: 'Bioimpresión' },
    { cmd: 'print simple', desc: 'Impresión simplificada', category: 'Bioimpresión' },
    { cmd: 'modeling', desc: 'Modelación de datos', category: 'Bioimpresión' },
    // Slots
    { cmd: 'saveconjunto', desc: 'Guardar paneles en slot', category: 'Slots' },
    { cmd: 'loadconjunto', desc: 'Cargar paneles de slot', category: 'Slots' },
    { cmd: 'hud', desc: 'Asignar trigger para HUD slot', category: 'Slots' },
    // Demo
    { cmd: 'demo', desc: 'Lab biomédico completo', category: 'Demo' },
    { cmd: 'multitest', desc: 'Paneles test multiselección', category: 'Demo' },
    // Utility
    { cmd: 'help', desc: 'Mostrar todos los comandos', category: 'Utilidad' },
    { cmd: 'clear', desc: 'Limpiar terminal', category: 'Utilidad' },
    { cmd: 'reset', desc: 'Resetear layout completamente', category: 'Utilidad' },
    { cmd: 'save', desc: 'Guardar layout en localStorage (rápido)', category: 'Utilidad' },
    { cmd: 'save 1', desc: 'Guardar layout completo en slot 1 (persistente)', category: 'Utilidad' },
    { cmd: 'load', desc: 'Cargar layout desde localStorage', category: 'Utilidad' },
    { cmd: 'load 1', desc: 'Cargar layout completo desde slot 1', category: 'Utilidad' },
    { cmd: 'pages', desc: 'Abrir menú visual de páginas/slots guardados', category: 'Utilidad' },
    { cmd: 'pages list', desc: 'Listar todos los slots y su contenido', category: 'Utilidad' },
    { cmd: 'new', desc: 'Empezar diseño nuevo (limpia la escena, slots guardados se conservan)', category: 'Utilidad' },
    { cmd: 'next', desc: 'Cargar siguiente slot con datos', category: 'Utilidad' },
    { cmd: 'prev', desc: 'Cargar slot anterior con datos', category: 'Utilidad' },
    // Auto-acomodo
    { cmd: 'tidy', desc: 'Auto-acomoda: snap a columnas/filas + centra (alias: symmetry, armonizar)', category: 'Bloques' },
    { cmd: 'mirror h', desc: 'Espejo horizontal del layout actual', category: 'Bloques' },
    { cmd: 'mirror v', desc: 'Espejo vertical del layout actual', category: 'Bloques' },
    { cmd: 'mirror h duplicate', desc: 'Duplica los paneles espejados al lado opuesto (h)', category: 'Bloques' },
    { cmd: 'font', desc: 'Cambiar fuente bitmap', category: 'Utilidad' },
    // Cámara
    { cmd: 'zoomout', desc: 'Centrar y alejar cámara (zoom out)', category: 'Cámara' },
    { cmd: 'home', desc: 'Volver a vista centrada', category: 'Cámara' },
    { cmd: 'centrar', desc: 'Centrar la pantalla', category: 'Cámara' },
    // Alineación de contenido
    { cmd: 'align center', desc: 'Centrar contenido (h+v)', category: 'Alineación' },
    { cmd: 'align left', desc: 'Justificar a la izquierda', category: 'Alineación' },
    { cmd: 'align right', desc: 'Justificar a la derecha', category: 'Alineación' },
    { cmd: 'align top', desc: 'Justificar arriba', category: 'Alineación' },
    { cmd: 'align bottom', desc: 'Justificar abajo', category: 'Alineación' },
    { cmd: 'limpiar', desc: 'Borrar contenido del panel seleccionado', category: 'Alineación' },
    // Modelo - escala
    { cmd: 'scale +', desc: 'Crecer modelo del panel seleccionado (+25%)', category: 'Modelos 3D' },
    { cmd: 'scale -', desc: 'Encoger modelo del panel seleccionado (-20%)', category: 'Modelos 3D' },
    { cmd: 'scale reset', desc: 'Reset escala del modelo a 1.0', category: 'Modelos 3D' },
    // Mover y redimensionar paneles
    { cmd: 'move left', desc: 'Mover panel(es) seleccionado(s) a la izquierda', category: 'Bloques' },
    { cmd: 'move right', desc: 'Mover panel(es) seleccionado(s) a la derecha', category: 'Bloques' },
    { cmd: 'move up', desc: 'Mover panel(es) seleccionado(s) arriba', category: 'Bloques' },
    { cmd: 'move down', desc: 'Mover panel(es) seleccionado(s) abajo', category: 'Bloques' },
    { cmd: 'resize 1', desc: 'Ensanchar panel(es) +1 celda', category: 'Bloques' },
    { cmd: 'resize -1', desc: 'Estrechar panel(es) -1 celda', category: 'Bloques' },
    { cmd: 'resize h 1', desc: 'Aumentar alto +1 celda', category: 'Bloques' },
    { cmd: 'resize h -1', desc: 'Reducir alto -1 celda', category: 'Bloques' },
    { cmd: 'copy', desc: 'Copiar panel(es) seleccionado(s) al portapapeles (Ctrl+C)', category: 'Bloques' },
    { cmd: 'paste', desc: 'Pegar paneles del portapapeles (Ctrl+V)', category: 'Bloques' },
    { cmd: 'movekeyb left', desc: 'Mover teclado bioKeyb a la izquierda', category: 'Bloques' },
    { cmd: 'movekeyb right', desc: 'Mover teclado bioKeyb a la derecha', category: 'Bloques' },
    { cmd: 'movekeyb up', desc: 'Mover teclado bioKeyb arriba', category: 'Bloques' },
    { cmd: 'movekeyb down', desc: 'Mover teclado bioKeyb abajo', category: 'Bloques' },
    // Sistema
    { cmd: 'skiplogin', desc: 'Saltar splash al recargar (toggle con `skiplogin off`)', category: 'Sistema' },
];

// Available 3D models
const MODEL_LIST = [
    { name: 'acot', file: 'acot.obj' },
    { name: 'axolotl', file: 'axolotl.obj' },
    { name: 'bioP', file: 'bioP.obj' },
    { name: 'boot', file: 'boot.obj' },
    { name: 'burg', file: 'burg.obj' },
    { name: 'corazon', file: 'corazon.obj' },
    { name: 'discus', file: 'discus.obj' },
    { name: 'dog', file: 'dog.obj' },
    { name: 'ham', file: 'ham.obj' },
    { name: 'her', file: 'her.obj' },
    { name: 'hueso', file: 'hueso.obj' },
    { name: 'megazord', file: 'megazord.fbx' },
    { name: 'petri', file: 'petri.obj' },
    { name: 'pollo', file: 'pollo.obj' },
    { name: 'tlaloc', file: 'tlaloc.obj' },
    { name: 'tort', file: 'tort.obj' },
    { name: 'biocorp', file: 'bioprint_logo.png' }, // Logo de BioCorp como textura plana
];

// ============================================================
// QUICK MENU (Toggle with G)
// ============================================================

function createBioMenu() {
    if (bioMenuElement) return;

    bioMenuElement = document.createElement('div');
    bioMenuElement.id = 'bio-menu';
    bioMenuElement.innerHTML = `
        <div class="bio-menu-header">
            <span class="bio-menu-title">bioPrint Menu</span>
            <span class="bio-menu-close" onclick="toggleBioMenu(false)">&times;</span>
        </div>
        <div class="bio-menu-search">
            <input type="text" id="bio-menu-search" placeholder="Buscar comando o modelo..." />
        </div>
        <div class="bio-menu-tabs">
            <button class="bio-menu-tab active" data-tab="commands">Comandos</button>
            <button class="bio-menu-tab" data-tab="models">Modelos 3D</button>
        </div>
        <div class="bio-menu-content" id="bio-menu-content"></div>
    `;

    const style = document.createElement('style');
    style.id = 'bio-menu-styles';
    style.textContent = `
        #bio-menu {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            max-height: 70vh;
            background: rgba(10, 10, 15, 0.95);
            border: 1px solid #0f0;
            border-radius: 8px;
            color: #fff;
            font-family: monospace;
            z-index: 10000;
            display: none;
            flex-direction: column;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.15);
            backdrop-filter: blur(10px);
        }
        #bio-menu.visible {
            display: flex;
        }
        .bio-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #333;
        }
        .bio-menu-title {
            font-size: 14px;
            font-weight: bold;
            color: #0f0;
        }
        .bio-menu-close {
            cursor: pointer;
            font-size: 20px;
            color: #666;
            transition: color 0.2s;
        }
        .bio-menu-close:hover { color: #f00; }
        .bio-menu-search {
            padding: 8px 16px;
        }
        .bio-menu-search input {
            width: 100%;
            background: rgba(255,255,255,0.05);
            border: 1px solid #333;
            border-radius: 4px;
            color: #fff;
            font-family: monospace;
            font-size: 13px;
            padding: 8px 12px;
            outline: none;
            box-sizing: border-box;
        }
        .bio-menu-search input:focus {
            border-color: #0f0;
        }
        .bio-menu-tabs {
            display: flex;
            padding: 0 16px;
            gap: 4px;
        }
        .bio-menu-tab {
            flex: 1;
            background: transparent;
            border: 1px solid #333;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            color: #888;
            font-family: monospace;
            font-size: 12px;
            padding: 6px 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .bio-menu-tab.active {
            background: rgba(0, 255, 0, 0.1);
            color: #0f0;
            border-color: #0f0;
        }
        .bio-menu-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
            max-height: 45vh;
        }
        .bio-menu-category {
            margin-bottom: 12px;
        }
        .bio-menu-category-title {
            font-size: 11px;
            color: #0f0;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
            opacity: 0.7;
        }
        .bio-menu-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.15s;
        }
        .bio-menu-item:hover {
            background: rgba(0, 255, 0, 0.1);
        }
        .bio-menu-item-cmd {
            font-weight: bold;
            color: #fff;
            font-size: 13px;
        }
        .bio-menu-item-desc {
            color: #888;
            font-size: 11px;
        }
        .bio-menu-model-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
        }
        .bio-menu-model-item {
            padding: 10px;
            border: 1px solid #333;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            transition: all 0.15s;
        }
        .bio-menu-model-item:hover {
            border-color: #0f0;
            background: rgba(0, 255, 0, 0.08);
        }
        .bio-menu-model-name {
            font-size: 13px;
            font-weight: bold;
            color: #fff;
        }
        .bio-menu-model-file {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
        }
        /* Autocomplete styles */
        #terminal-autocomplete {
            position: absolute;
            bottom: 100%;
            left: 0;
            width: 100%;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid #333;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            display: none;
            z-index: 1001;
        }
        #terminal-autocomplete.visible {
            display: block;
        }
        .autocomplete-item {
            padding: 5px 10px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            font-family: monospace;
            font-size: 12px;
        }
        .autocomplete-item:hover,
        .autocomplete-item.selected {
            background: rgba(0, 255, 0, 0.15);
        }
        .autocomplete-item-cmd {
            color: #0f0;
            font-weight: bold;
        }
        .autocomplete-item-desc {
            color: #666;
            font-size: 11px;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(bioMenuElement);

    // Tab switching
    bioMenuElement.querySelectorAll('.bio-menu-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            bioMenuElement.querySelectorAll('.bio-menu-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderMenuContent(tab.dataset.tab, document.getElementById('bio-menu-search').value);
        });
    });

    // Search filtering
    const searchInput = document.getElementById('bio-menu-search');
    searchInput.addEventListener('input', () => {
        const activeTab = bioMenuElement.querySelector('.bio-menu-tab.active').dataset.tab;
        renderMenuContent(activeTab, searchInput.value);
    });

    // Prevent key propagation from menu search
    searchInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            toggleBioMenu(false);
        }
    });

    renderMenuContent('commands', '');
}

function renderMenuContent(tab, filter) {
    const content = document.getElementById('bio-menu-content');
    if (!content) return;

    const searchTerm = filter.toLowerCase().trim();

    if (tab === 'commands') {
        const filtered = COMMAND_LIST.filter(c =>
            !searchTerm || c.cmd.includes(searchTerm) || c.desc.toLowerCase().includes(searchTerm) || c.category.toLowerCase().includes(searchTerm)
        );

        // Group by category
        const categories = {};
        filtered.forEach(c => {
            if (!categories[c.category]) categories[c.category] = [];
            categories[c.category].push(c);
        });

        let html = '';
        Object.entries(categories).forEach(([cat, cmds]) => {
            html += `<div class="bio-menu-category">
                <div class="bio-menu-category-title">${cat}</div>`;
            cmds.forEach(c => {
                html += `<div class="bio-menu-item" onclick="executeBioMenuCommand('${c.cmd}')">
                    <span class="bio-menu-item-cmd">${c.cmd}</span>
                    <span class="bio-menu-item-desc">${c.desc}</span>
                </div>`;
            });
            html += '</div>';
        });

        content.innerHTML = html || '<div style="color:#666;text-align:center;padding:20px;">No se encontraron comandos</div>';
    } else if (tab === 'models') {
        const filtered = MODEL_LIST.filter(m =>
            !searchTerm || m.name.includes(searchTerm) || m.file.includes(searchTerm)
        );

        let html = '<div class="bio-menu-model-grid">';
        filtered.forEach(m => {
            html += `<div class="bio-menu-model-item" onclick="executeBioMenuModel('${m.name}')">
                <div class="bio-menu-model-name">${m.name}</div>
                <div class="bio-menu-model-file">${m.file}</div>
            </div>`;
        });
        html += '</div>';

        content.innerHTML = filtered.length ? html : '<div style="color:#666;text-align:center;padding:20px;">No se encontraron modelos</div>';
    }
}

function toggleBioMenu(show) {
    if (!bioMenuElement) createBioMenu();

    bioMenuVisible = show !== undefined ? show : !bioMenuVisible;

    if (bioMenuVisible) {
        bioMenuElement.classList.add('visible');
        setTimeout(() => {
            const searchInput = document.getElementById('bio-menu-search');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
        }, 50);
        renderMenuContent('commands', '');
    } else {
        bioMenuElement.classList.remove('visible');
    }
}

function executeBioMenuCommand(cmd) {
    toggleBioMenu(false);
    processTerminalCommand(cmd);
}

function executeBioMenuModel(modelName) {
    toggleBioMenu(false);
    processTerminalCommand(`model ${modelName}`);
}

// ============================================================
// TERMINAL AUTOCOMPLETE
// ============================================================

function initTerminalAutocomplete() {
    const terminalConsole = document.getElementById('terminal-console');
    const terminalInput = document.getElementById('terminal-input');
    if (!terminalConsole || !terminalInput) return;

    // Create autocomplete container
    autocompleteElement = document.createElement('div');
    autocompleteElement.id = 'terminal-autocomplete';
    terminalConsole.style.position = 'relative';
    terminalConsole.insertBefore(autocompleteElement, terminalConsole.firstChild);

    // Listen for input changes
    terminalInput.addEventListener('input', () => {
        updateAutocomplete(terminalInput.value);
    });

    // Handle arrow keys and tab for autocomplete
    terminalInput.addEventListener('keydown', (e) => {
        if (!autocompleteElement || !autocompleteElement.classList.contains('visible')) return;

        const items = autocompleteElement.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, items.length - 1);
            highlightAutocompleteItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, 0);
            highlightAutocompleteItem(items);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (autocompleteSelectedIndex >= 0 && autocompleteSelectedIndex < items.length) {
                selectAutocompleteItem(items[autocompleteSelectedIndex]);
            } else if (items.length > 0) {
                selectAutocompleteItem(items[0]);
            }
        }
    });
}

function updateAutocomplete(value) {
    if (!autocompleteElement) return;

    const input = value.trim().toLowerCase();
    if (!input) {
        autocompleteElement.classList.remove('visible');
        autocompleteSelectedIndex = -1;
        return;
    }

    // Filter matching commands
    const matches = COMMAND_LIST.filter(c =>
        c.cmd.startsWith(input) || c.cmd.includes(input) || c.desc.toLowerCase().includes(input)
    ).slice(0, 8); // Max 8 suggestions

    if (matches.length === 0) {
        autocompleteElement.classList.remove('visible');
        autocompleteSelectedIndex = -1;
        return;
    }

    let html = '';
    matches.forEach((m, i) => {
        html += `<div class="autocomplete-item" data-cmd="${m.cmd}" onclick="selectAutocompleteByCmd('${m.cmd}')">
            <span class="autocomplete-item-cmd">${m.cmd}</span>
            <span class="autocomplete-item-desc">${m.desc}</span>
        </div>`;
    });

    autocompleteElement.innerHTML = html;
    autocompleteElement.classList.add('visible');
    autocompleteSelectedIndex = -1;
}

function highlightAutocompleteItem(items) {
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === autocompleteSelectedIndex);
    });
}

function selectAutocompleteItem(item) {
    const terminalInput = document.getElementById('terminal-input');
    if (terminalInput && item) {
        terminalInput.value = item.dataset.cmd + ' ';
        terminalInput.focus();
    }
    autocompleteElement.classList.remove('visible');
    autocompleteSelectedIndex = -1;
}

function selectAutocompleteByCmd(cmd) {
    const terminalInput = document.getElementById('terminal-input');
    if (terminalInput) {
        terminalInput.value = cmd + ' ';
        terminalInput.focus();
    }
    autocompleteElement.classList.remove('visible');
    autocompleteSelectedIndex = -1;
}

// ============================================================
// INITIALIZATION
// ============================================================

function initBioMenu() {
    createBioMenu();
    // Delay autocomplete init to ensure terminal exists
    setTimeout(() => {
        initTerminalAutocomplete();
    }, 500);
}

// Make functions globally available
window.toggleBioMenu = toggleBioMenu;
window.executeBioMenuCommand = executeBioMenuCommand;
window.executeBioMenuModel = executeBioMenuModel;
window.selectAutocompleteByCmd = selectAutocompleteByCmd;
window.initBioMenu = initBioMenu;

export { toggleBioMenu, initBioMenu, bioMenuVisible, COMMAND_LIST, MODEL_LIST };

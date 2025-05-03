import * as THREE from 'three';

let logoMesh = null;
let isLogoVisible = false;
let sourcePanel = null;

export function createLogo(scene) {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('./public/img/bioprint_logo.png', (loadedTexture) => {
        const ratio = loadedTexture.image.width / loadedTexture.image.height;
        const width = 12;
        const height = width / ratio;
        logoMesh.geometry = new THREE.PlaneGeometry(width, height);
        updateLogoPosition();
    });
    
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    
    logoMesh = new THREE.Mesh(geometry, material);
    logoMesh.position.z = 2;
    logoMesh.renderOrder = 999;
    logoMesh.visible = false;
    
    // Marcar el logo para que sea ignorado por el raycaster
    logoMesh.userData.ignoreRaycast = true;
    // Desactivar interacción con el mouse
    logoMesh.raycast = () => null;
    
    scene.add(logoMesh);
}

function updateLogoPosition() {
    if (!logoMesh || !sourcePanel || !sourcePanel.group) return;
    
    logoMesh.position.x = sourcePanel.group.position.x;
    logoMesh.position.y = sourcePanel.group.position.y + 0.5;
    logoMesh.position.z = sourcePanel.group.position.z + 2;
}

export function toggleLogo(show, panel) {
    if (!logoMesh) return;

    if (show === undefined) {
        show = !isLogoVisible;
    }

    isLogoVisible = show;
    logoMesh.visible = show;

    if (show) {
        sourcePanel = panel;
        if (panel && panel.group) {
            // Hacer invisible el contenido del panel pero mantener la funcionalidad
            panel.group.children.forEach(child => {
                if (child.material) {
                    child.material = child.material.clone();
                    child.material.opacity = 0;
                    child.material.transparent = true;
                }
            });
            // Mantener el panel seleccionable
            panel.group.visible = true;
            updateLogoPosition();
        }
    } else {
        if (sourcePanel && sourcePanel.group) {
            // Restaurar visibilidad del panel
            sourcePanel.group.children.forEach(child => {
                if (child.material) {
                    child.material = child.material.clone();
                    child.material.opacity = 1;
                    child.material.transparent = false;
                }
            });
        }
        sourcePanel = null;
    }
}

// Función para actualizar la posición del logo cuando el panel se mueve
export function updateOnPanelMove(panel) {
    if (isLogoVisible && sourcePanel === panel) {
        updateLogoPosition();
    }
}

export function handleLogoCommand(args, output, scene, panels) {
    const selectedPanels = panels.filter(p => p.selected);
    
    if (selectedPanels.length === 0) {
        output.innerHTML += '<div class="error">Seleccione un panel para mostrar el logo</div>';
        return;
    }
    
    if (selectedPanels.length > 1) {
        output.innerHTML += '<div class="error">Seleccione solo un panel para mostrar el logo</div>';
        return;
    }

    const panel = selectedPanels[0];

    if (!logoMesh) {
        createLogo(scene);
    }
    
    toggleLogo(true, panel);
    output.innerHTML += '<div class="success">Logo activado</div>';
} 
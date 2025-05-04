// Módulo para manejar barras de progreso
import * as THREE from 'three';

// Configuración de la barra de progreso
const LOAD_CONFIG = {
    width: 1024,
    height: 64,
    padding: 4,
    fontSize: 24,
    fontFamily: 'Arial',
    colors: {
        background: 'rgba(40, 40, 40, 0.3)',
        border: 'rgba(0, 150, 255, 0.8)',
        progressStart: 'rgba(0, 255, 135, 0.8)',
        progressEnd: 'rgba(0, 150, 255, 0.8)',
        glow: 'rgba(0, 255, 255, 0.4)',
        text: 'rgba(255, 255, 255, 0.9)'
    }
};

// Crear un nuevo panel de progreso
export function createProgressPanel(panel, currentGridParams) {
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
        orderNumber: panel.orderNumber + 1,
        hasText: true
    };
    
    // Crear canvas para la barra de progreso
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = LOAD_CONFIG.width;
    canvas.height = LOAD_CONFIG.height;
    
    // Crear textura y material
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
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
    
    // Función para dibujar la barra de progreso
    function drawProgress(progress, pulse = 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar fondo
        ctx.fillStyle = LOAD_CONFIG.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar borde
        ctx.strokeStyle = LOAD_CONFIG.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        // Calcular ancho de progreso
        const progressWidth = Math.floor((canvas.width - LOAD_CONFIG.padding * 2) * (progress / 100));
        
        // Crear gradiente para la barra
        const gradient = ctx.createLinearGradient(
            LOAD_CONFIG.padding, 0, 
            progressWidth + LOAD_CONFIG.padding, 0
        );
        const baseOpacity = 0.6 + pulse * 0.2;
        gradient.addColorStop(0, LOAD_CONFIG.colors.progressStart.replace('0.8', baseOpacity));
        gradient.addColorStop(1, LOAD_CONFIG.colors.progressEnd.replace('0.8', baseOpacity));
        
        // Dibujar barra de progreso
        ctx.fillStyle = gradient;
        ctx.fillRect(
            LOAD_CONFIG.padding, 
            LOAD_CONFIG.padding, 
            progressWidth, 
            canvas.height - LOAD_CONFIG.padding * 2
        );
        
        // Efecto de brillo en el borde
        if (progressWidth > LOAD_CONFIG.padding) {
            const glowWidth = Math.min(8, progressWidth / 4);
            const glowGradient = ctx.createLinearGradient(
                progressWidth - glowWidth, 0, 
                progressWidth + glowWidth, 0
            );
            glowGradient.addColorStop(0, LOAD_CONFIG.colors.glow);
            glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = glowGradient;
            ctx.fillRect(
                progressWidth - glowWidth, 
                LOAD_CONFIG.padding, 
                glowWidth * 2, 
                canvas.height - LOAD_CONFIG.padding * 2
            );
        }
        
        // Dibujar porcentaje
        ctx.fillStyle = LOAD_CONFIG.colors.text;
        ctx.font = `bold ${LOAD_CONFIG.fontSize}px ${LOAD_CONFIG.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            `${Math.floor(progress)}%`, 
            canvas.width / 2, 
            canvas.height / 2
        );
        
        texture.needsUpdate = true;
    }
    
    // Asignar función de dibujo
    progressPanel.drawProgress = drawProgress;
    
    return progressPanel;
}

// Limpiar recursos del panel de progreso
export function cleanupProgressPanel(progressPanel, scene, panels) {
    if (progressPanel.group) {
        scene.remove(progressPanel.group);
        const index = panels.indexOf(progressPanel);
        if (index > -1) {
            panels.splice(index, 1);
        }
        
        // Limpiar materiales y texturas
        if (progressPanel.fillMesh && progressPanel.fillMesh.material) {
            progressPanel.fillMesh.material.dispose();
            if (progressPanel.fillMesh.material.map) {
                progressPanel.fillMesh.material.map.dispose();
            }
        }
        
        // Limpiar geometría
        if (progressPanel.fillMesh && progressPanel.fillMesh.geometry) {
            progressPanel.fillMesh.geometry.dispose();
        }
    }
} 
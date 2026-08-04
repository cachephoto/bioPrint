from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 18)
        self.cell(0, 12, 'bioPrint UI - Shortcuts & Commands', align='C', new_x="LMARGIN", new_y="NEXT")
        self.set_font('Helvetica', '', 9)
        self.cell(0, 6, 'Reference Guide | 2026-05-04', align='C', new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def section_title(self, title):
        self.set_font('Helvetica', 'B', 12)
        self.set_fill_color(40, 40, 40)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, f'  {title}', fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def shortcut_row(self, key, description):
        self.set_font('Courier', 'B', 9)
        self.cell(45, 6, key)
        self.set_font('Helvetica', '', 9)
        self.cell(0, 6, description, new_x="LMARGIN", new_y="NEXT")

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()

# Grid & Resolution
pdf.section_title('GRID & RESOLUTION')
pdf.shortcut_row('+ / =', 'Increase grid resolution (max 50)')
pdf.shortcut_row('- / _', 'Decrease grid resolution (min 2)')
pdf.shortcut_row('M', 'Increase HUD grid resolution')
pdf.shortcut_row('N', 'Decrease HUD grid resolution')
pdf.ln(3)

# Panel Movement & Selection
pdf.section_title('PANEL MOVEMENT & SELECTION')
pdf.shortcut_row('Arrow Up', 'Move selected panel(s) up one cell')
pdf.shortcut_row('Arrow Down', 'Move selected panel(s) down one cell')
pdf.shortcut_row('Arrow Left', 'Move selected panel(s) left one cell')
pdf.shortcut_row('Arrow Right', 'Move selected panel(s) right one cell')
pdf.shortcut_row('X / Delete', 'Delete selected panel(s)')
pdf.shortcut_row('Escape', 'Deselect all / exit text editing')
pdf.shortcut_row('Shift + Drag', 'Disable snap-to-grid while dragging')
pdf.ln(3)

# Slot Management
pdf.section_title('SLOT MANAGEMENT')
pdf.shortcut_row('0-9', 'Load slot 0-9 in main grid')
pdf.shortcut_row('Ctrl + 0-9', 'Load slot 0-9 into HUD')
pdf.shortcut_row('Alt + 0-9', 'Load slot 10-19 (Alt+0=slot 10, etc.)')
pdf.shortcut_row('PageUp', 'Navigate to previous slot')
pdf.shortcut_row('PageDown', 'Navigate to next slot')
pdf.ln(3)

# UI Panel Control
pdf.section_title('UI PANEL CONTROL')
pdf.shortcut_row('V', 'Toggle control panels visibility')
pdf.shortcut_row('P', 'Toggle HUD on/off')
pdf.shortcut_row('K', 'Toggle virtual keyboard (bioKeyb)')
pdf.shortcut_row('T', 'Open/toggle Terminal')
pdf.shortcut_row('A', 'Center grid in camera (autofocus)')
pdf.shortcut_row('Ctrl + C', 'Clear all panels')
pdf.ln(3)

# Camera Control
pdf.section_title('CAMERA CONTROL')
pdf.shortcut_row('Ctrl + Drag', 'Rotate/orbit camera')
pdf.shortcut_row('Mouse Wheel', 'Zoom in/out')
pdf.ln(3)

# Mouse/Touch Interactions
pdf.section_title('MOUSE / TOUCH INTERACTIONS')
pdf.shortcut_row('Single Click', 'Select panel')
pdf.shortcut_row('Double Click', 'Toggle text editing mode')
pdf.shortcut_row('Drag', 'Move selected panel(s)')
pdf.shortcut_row('Ctrl + Click Drag', 'Rotate/orbit camera')
pdf.ln(3)

# Text Editing
pdf.section_title('TEXT EDITING MODE')
pdf.shortcut_row('Escape', 'Exit text editing')
pdf.shortcut_row('Tab', 'Insert tab character')
pdf.shortcut_row('Enter', 'New line (multi-line mode)')
pdf.shortcut_row('Backspace', 'Delete character before cursor')
pdf.ln(3)

# Virtual Keyboard Special Keys
pdf.section_title('VIRTUAL KEYBOARD (bioKeyb) SPECIAL KEYS')
pdf.shortcut_row('CAPS', 'Toggle caps lock')
pdf.shortcut_row('SHIFT', 'Toggle shift state')
pdf.shortcut_row('F5', 'Reload page')
pdf.shortcut_row('F11', 'Toggle fullscreen')
pdf.ln(3)

# UI Buttons
pdf.section_title('UI BUTTON COMMANDS')
pdf.shortcut_row('Save Config', 'Save current grid state to JSON')
pdf.shortcut_row('Load Config', 'Load grid state from JSON')
pdf.shortcut_row('Download Config', 'Export configuration to file')
pdf.shortcut_row('Toggle Numbers', 'Show/hide panel order numbers')
pdf.shortcut_row('Clear Layout', 'Clear all panels (same as Ctrl+C)')
pdf.shortcut_row('Upload Config', 'Load JSON configuration file')
pdf.shortcut_row('bioFX Save', 'Save visual effect settings')
pdf.ln(3)

# Notes
pdf.section_title('NOTES')
pdf.set_font('Helvetica', '', 9)
pdf.multi_cell(0, 5,
    '- During text editing, most shortcuts are disabled to allow typing.\n'
    '- Only Ctrl+*, Alt+*, Meta+*, F-keys, and Escape remain active while typing.\n'
    '- HUD renders at z=8 (closer to camera than main grid at z=0).\n'
    '- Slots can store complete grid configurations for quick switching.')

# New page for Terminal Commands
pdf.add_page()
pdf.section_title('TERMINAL COMMANDS (toggle with T)')

pdf.set_font('Helvetica', 'I', 9)
pdf.cell(0, 6, 'Type these commands in the built-in terminal.', new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)

pdf.section_title('Color Effects')
pdf.shortcut_row('zeng', 'Activate Zeng effect (blue)')
pdf.shortcut_row('boris', 'Activate Matrix effect (green)')
pdf.shortcut_row('ann', 'Activate Ann effect (cyan)')
pdf.ln(3)

pdf.section_title('Panel Management')
pdf.shortcut_row('select all', 'Select all panels')
pdf.shortcut_row('select 1-5', 'Select panels 1 through 5')
pdf.shortcut_row('select 1 3 7', 'Select specific panels')
pdf.shortcut_row('show', 'Show panel numbers')
pdf.shortcut_row('hide', 'Hide panel numbers')
pdf.shortcut_row('list', 'List all panels')
pdf.shortcut_row('delete <n>', 'Delete panel n')
pdf.shortcut_row('delete selected', 'Delete selected panels')
pdf.shortcut_row('delete all', 'Delete all panels')
pdf.ln(3)

pdf.section_title('Content Creation')
pdf.shortcut_row('logo', 'Create logo in selected panel')
pdf.shortcut_row('apps', 'Create grid of application icons')
pdf.shortcut_row('social / login', 'Create login with social network icons')
pdf.shortcut_row('txt', 'Add text to selected panel')
pdf.shortcut_row('terms', 'Show terms and conditions')
pdf.shortcut_row('horizontal', 'Divide selected panel horizontally')
pdf.shortcut_row('modal', 'Create modal panels')
pdf.ln(3)

pdf.section_title('3D Models')
pdf.shortcut_row('model', 'Create 3D model in selected panel')
pdf.shortcut_row('model rotate', 'Rotate model')
pdf.shortcut_row('model speed <n>', 'Set model rotation speed')
pdf.shortcut_row('model angle <n>', 'Set model angle')
pdf.shortcut_row('models', 'Create 3x3 grid of biological models')
pdf.shortcut_row('viewer', 'Convert panel into model viewer')
pdf.shortcut_row('codon', 'Create 3D genetic transcription model')
pdf.shortcut_row('statg', 'Show genomic stats of last clicked model')
pdf.ln(3)

pdf.section_title('Genetic / Biological')
pdf.shortcut_row('genom', 'Create DNA visualization')
pdf.shortcut_row('gatc / gtac', 'Show animated GATC sequence')
pdf.shortcut_row('splice', 'Start genetic splicing process')
pdf.shortcut_row('stack', 'Start genetic stack process')
pdf.shortcut_row('index / reindex', 'Reindex all panels')
pdf.shortcut_row('pass', 'Password command')
pdf.ln(3)

pdf.section_title('Visual Effects')
pdf.shortcut_row('flash', 'Flash selected panel')
pdf.shortcut_row('glitch', 'Red refraction glitch effect')
pdf.ln(3)

pdf.section_title('3D Bioprinting')
pdf.shortcut_row('print', 'Start 3D bioprinting simulation')
pdf.shortcut_row('print percent [ms]', 'Progress bar with percentage (ms=duration)')
pdf.shortcut_row('print simple', 'Simplified print interface')
pdf.shortcut_row('modeling', 'Start user data modeling')
pdf.ln(3)

pdf.section_title('Slot Management (Terminal)')
pdf.shortcut_row('saveconjunto <n>', 'Save selected panels to slot n (0-9)')
pdf.shortcut_row('saveconj <n>', 'Alias for saveconjunto')
pdf.shortcut_row('loadconjunto <n>', 'Load panels from slot n (no clear)')
pdf.shortcut_row('loadconj <n>', 'Alias for loadconjunto')
pdf.shortcut_row('hud <slot>', 'Assign panel as trigger for HUD slot')
pdf.ln(3)

pdf.section_title('Testing & Demo')
pdf.shortcut_row('multitest', 'Create test panels for multiselection')
pdf.shortcut_row('demo', 'Create complete biomedical lab demo')
pdf.ln(3)

pdf.section_title('Utility')
pdf.shortcut_row('help', 'Show all available commands')
pdf.shortcut_row('clear', 'Clear terminal output')
pdf.ln(3)

# New page for Assets
pdf.add_page()
pdf.section_title('3D MODELS (public/models/)')
models = [
    ('acot.obj', 'OBJ'),
    ('axolotl.obj', 'OBJ'),
    ('bioP.obj', 'OBJ'),
    ('bioPrint_model.lxf', 'LEGO Digital'),
    ('bio_export.lxf', 'LEGO Digital'),
    ('boot.obj', 'OBJ'),
    ('burg.obj', 'OBJ'),
    ('corazon.obj', 'OBJ'),
    ('discus.obj', 'OBJ'),
    ('dog.obj', 'OBJ'),
    ('ham.obj', 'OBJ'),
    ('her.obj + her.mtl', 'OBJ + Material'),
    ('hueso.obj', 'OBJ'),
    ('megazord.fbx', 'FBX'),
    ('megazord_bioPrint_model.lxf', 'LEGO Digital'),
    ('petri.obj', 'OBJ'),
    ('pollo.obj', 'OBJ'),
    ('tlaloc.obj', 'OBJ'),
    ('tort.obj', 'OBJ'),
]
for name, fmt in models:
    pdf.shortcut_row(name, fmt)
pdf.ln(3)

pdf.section_title('LOGOS & IMAGES (public/img/)')
images = [
    ('bioprint_logo.png', 'Logo principal bioPrint'),
    ('ihtoaGames_logo_animG.gif', 'Logo animado IhtoaGames'),
    ('INDIe-Ihtoa_logos (1).svg', 'Logo SVG INDIe-Ihtoa'),
    ('gmail.png', 'Icono Gmail'),
    ('linkedin.png', 'Icono LinkedIn'),
    ('meta.png', 'Icono Meta'),
    ('x.png', 'Icono X (Twitter)'),
    ('apps.png', 'Imagen general de apps'),
    ('app_1.png - app_20.png', '20 iconos de aplicaciones'),
    ('bio_bluePrint_dobleces.ps', 'Blueprint PostScript'),
    ('Untitled-1.psd', 'Archivo Photoshop'),
    ('Untitled-2.ai', 'Archivo Illustrator'),
]
for name, desc in images:
    pdf.shortcut_row(name, desc)

pdf.output('/Users/danielblanco/Developer/BIOPRINT/bioPrint/bioPrint_shortcuts.pdf')
print("PDF generated successfully!")

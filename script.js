// script.js

let signaturePad;
let currentPenColor = '#000000';

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeColorPickers();
    initializeSignaturePad();
    initializePhotoUploads();
    initializeButtons();
    initializeFormReset();
});

// Inicialización del tema
function initializeTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark-theme');
        updateThemeIcon(true);
    }

    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDarkNow = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
        updateThemeIcon(isDarkNow);
        signaturePad.penColor = isDarkNow ? '#FFFFFF' : currentPenColor;
    });
}

function updateThemeIcon(isDark) {
    const icon = document.querySelector('#themeToggle i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

// Inicialización de selectores de color
function initializeColorPickers() {
    const colorMap = {
        'bgColor': '--bg-color',
        'primaryColor': '--primary-color',
        'textColor': '--text-color'
    };

    Object.entries(colorMap).forEach(([inputId, cssVar]) => {
        const input = document.getElementById(inputId);
        const savedColor = localStorage.getItem(inputId);
        
        if (savedColor) {
            input.value = savedColor;
            document.documentElement.style.setProperty(cssVar, savedColor);
        }
        
        input.addEventListener('input', (e) => {
            const color = e.target.value;
            document.documentElement.style.setProperty(cssVar, color);
            localStorage.setItem(inputId, color);
            if (inputId === 'primaryColor') updateUIWithPrimaryColor(color);
        });
    });
}

function updateUIWithPrimaryColor(color) {
    document.querySelectorAll('.primary-color').forEach(el => {
        el.style.backgroundColor = color;
    });
}

// Inicialización del pad de firma
function initializeSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth;
    canvas.height = 200;

    signaturePad = new SignaturePad(canvas, {
        penColor: currentPenColor,
        backgroundColor: 'rgb(255, 255, 255)',
        minWidth: 1,
        maxWidth: 2.5
    });

    document.getElementById('clearSignature').addEventListener('click', () => {
        signaturePad.clear();
        showNotification('Firma borrada', 'success');
    });

    document.getElementById('changeColor').addEventListener('click', () => {
        currentPenColor = currentPenColor === '#000000' ? '#0000FF' : '#000000';
        signaturePad.penColor = currentPenColor;
        showNotification('Color de firma cambiado', 'success');
    });

    window.addEventListener('resize', resizeSignaturePad);
}

function resizeSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    const parent = canvas.parentElement;
    const oldData = signaturePad.toData();
    canvas.width = parent.offsetWidth;
    canvas.height = 200;
    signaturePad.clear();
    if (oldData) signaturePad.fromData(oldData);
}

// Inicialización de carga de fotos
function initializePhotoUploads() {
    ['Before', 'After'].forEach(type => {
        const preview = document.getElementById(`preview${type}`);
        const input = document.getElementById(`foto${type}`);

        preview.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => handleImageUpload(e, `preview${type}`));
    });
}

function handleImageUpload(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecciona un archivo de imagen válido', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const container = document.createElement('div');
        container.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = e.target.result;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-image-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            resetPreviewArea(preview);
            event.target.value = '';
        };

        container.appendChild(img);
        container.appendChild(deleteBtn);
        
        preview.innerHTML = '';
        preview.classList.add('has-image');
        preview.appendChild(container);
        
        showNotification('Imagen cargada correctamente', 'success');
    };

    reader.readAsDataURL(file);
}

function resetPreviewArea(preview) {
    preview.innerHTML = `
        <i class="fas fa-camera text-3xl mb-2"></i>
        <p>Click para subir foto</p>
    `;
    preview.classList.remove('has-image');
}

// Inicialización de botones
function initializeButtons() {
    document.getElementById('pdfButton').addEventListener('click', generatePDF);
    document.getElementById('whatsappButton').addEventListener('click', shareWhatsApp);
}

// Función para agregar personal
function addPersonal() {
    const container = document.getElementById('personalList');
    const div = document.createElement('div');
    div.className = 'flex gap-2 new-element';
    div.innerHTML = `
        <input type="text" name="personal[]" class="flex-grow p-2 border rounded focus:ring-2 focus:ring-blue-500" 
               placeholder="Nombre del personal">
        <button type="button" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-all"
                onclick="this.parentElement.remove()">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(div);
}

// Generación de PDF
async function generatePDF() {
    showLoading();
    try {
        const content = await preparePDFContent();
        const pdf = await html2pdf()
            .set({
                margin: 1,
                filename: `reporte-limpieza-${new Date().toISOString().slice(0,10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
            })
            .from(content)
            .save();
            
        showNotification('PDF generado exitosamente', 'success');
    } catch (error) {
        console.error('Error al generar PDF:', error);
        showNotification('Error al generar el PDF', 'error');
    } finally {
        hideLoading();
    }
}

async function preparePDFContent() {
    const form = document.getElementById('cleaningForm');
    const formData = new FormData(form);
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.color = '#000000';

    // Contenido básico
    container.innerHTML = `
        <h1 style="text-align: center; color: #2563eb; font-size: 24px; margin-bottom: 20px;">
            Reporte de Limpieza
        </h1>
        <div style="margin-bottom: 20px;">
            <p><strong>Fecha:</strong> ${formData.get('fecha')}</p>
            <p><strong>Departamento:</strong> ${formData.get('departamento')}</p>
        </div>
    `;

    // Personal
    const personal = Array.from(formData.getAll('personal[]')).filter(p => p);
    if (personal.length) {
        container.innerHTML += `
            <div style="margin-bottom: 20px;">
                <h2 style="color: #2563eb; font-size: 18px; margin-bottom: 10px;">Personal</h2>
                <ul>${personal.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
        `;
    }

    // Fotos
    const beforePreview = document.getElementById('previewBefore');
    const afterPreview = document.getElementById('previewAfter');
    
    if (beforePreview.classList.contains('has-image') || afterPreview.classList.contains('has-image')) {
        container.innerHTML += '<h2 style="color: #2563eb; font-size: 18px; margin-bottom: 10px;">Fotos</h2>';
        container.innerHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 20px;">';
        
        if (beforePreview.classList.contains('has-image')) {
            const beforeImg = beforePreview.querySelector('img');
            container.innerHTML += `
                <div style="flex: 1; margin-right: 10px;">
                    <p><strong>Antes:</strong></p>
                    <img src="${beforeImg.src}" style="max-width: 100%; height: auto;">
                </div>
            `;
        }
        
        if (afterPreview.classList.contains('has-image')) {
            const afterImg = afterPreview.querySelector('img');
            container.innerHTML += `
                <div style="flex: 1;">
                    <p><strong>Después:</strong></p>
                    <img src="${afterImg.src}" style="max-width: 100%; height: auto;">
                </div>
            `;
        }
        
        container.innerHTML += '</div>';
    }

    // Firma
    if (!signaturePad.isEmpty()) {
        container.innerHTML += `
            <div style="margin-top: 20px;">
                <h2 style="color: #2563eb; font-size: 18px; margin-bottom: 10px;">Firma</h2>
                <img src="${signaturePad.toDataURL()}" style="max-width: 200px;">
            </div>
        `;
    }

    return container;
}

// Compartir por WhatsApp
function shareWhatsApp() {
    const form = document.getElementById('cleaningForm');
    const formData = new FormData(form);
    
    const message = `🧹 *Reporte de Limpieza*\n\n` +
                   `📅 Fecha: ${formData.get('fecha')}\n` +
                   `🏢 Departamento: ${formData.get('departamento')}\n` +
                   `👥 Personal: ${Array.from(formData.getAll('personal[]')).filter(p => p).join(', ')}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    showNotification('Abriendo WhatsApp...', 'success');
}

// Reiniciar formulario
function initializeFormReset() {
    document.getElementById('resetForm').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
            document.getElementById('cleaningForm').reset();
            signaturePad.clear();
            
            ['Before', 'After'].forEach(type => {
                resetPreviewArea(document.getElementById(`preview${type}`));
            });
            
            // Mantener solo un campo de personal
            const personalList = document.getElementById('personalList');
            personalList.innerHTML = `
                <div class="flex gap-2">
                    <input type="text" name="personal[]" 
                           class="flex-grow p-2 border rounded focus:ring-2 focus:ring-blue-500"
                           placeholder="Nombre del personal">
                    <button type="button" onclick="addPersonal()" 
                            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-all">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            
            showNotification('Formulario reiniciado', 'success');
        }
    });
}

// Utilidades
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLoading() {
    document.getElementById('loadingModal').classList.remove('hidden');
    document.getElementById('loadingModal').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.add('hidden');
    document.getElementById('loadingModal').classList.remove('flex');
}
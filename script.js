// Variables globales
let signaturePad;
let currentPenColor = '#000000';
let currentStream = null;
let activePreview = null;

// Almacenamiento de imágenes
const imageStore = {
    before: null,
    after: null,
    signature: null
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeSignaturePad();
    initializeCamera();
    initializeFormReset();
    initializePhotoSystem();
    setupPhotoInputs();
});

// Inicialización del tema
function initializeTheme() {
    const defaultColors = {
        bgColor: '#f5f5f5',
        primaryColor: '#3b82f6',
        textColor: '#1a1a1a'
    };

    Object.entries(defaultColors).forEach(([key, defaultValue]) => {
        const input = document.getElementById(key);
        if (!input) return;

        // Cargar color guardado o usar default
        const savedColor = localStorage.getItem(key) || defaultValue;
        input.value = savedColor;
        document.documentElement.style.setProperty(`--${key.replace('Color', '')}-color`, savedColor);

        // Manejar cambios
        input.addEventListener('input', (e) => {
            const color = e.target.value;
            document.documentElement.style.setProperty(`--${key.replace('Color', '')}-color`, color);
            localStorage.setItem(key, color);
        });
    });
}

// Sistema de fotos
function initializePhotoSystem() {
    ['Before', 'After'].forEach(type => {
        const preview = document.getElementById(`preview${type}`);
        const fileInput = document.getElementById(`fileInput${type}`);
        const chooseBtn = document.getElementById(`choose${type}`);

        if (preview) {
            preview.addEventListener('click', () => handlePreviewClick(type));
        }

        if (chooseBtn) {
            chooseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (fileInput) fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFileSelect(e, type.toLowerCase()));
        }
    });
}

function setupPhotoInputs() {
    const modal = document.getElementById('cameraModal');
    const closeBtn = document.getElementById('closeModal');
    const captureBtn = document.getElementById('captureBtn');

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) stopCamera();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', stopCamera);
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }

    // Manejar tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            stopCamera();
        }
    });
}

function handlePreviewClick(type) {
    const preview = document.getElementById(`preview${type}`);
    if (!preview || preview.querySelector('img')) return;
    
    const fileInput = document.getElementById(`fileInput${type}`);
    if (fileInput) fileInput.click();
}

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen válida', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        updatePreview(type, e.target.result);
        imageStore[type] = e.target.result;
    };
    reader.onerror = () => showToast('Error al cargar la imagen', 'error');
    reader.readAsDataURL(file);
}

// Manejo de la cámara
function initializeCamera() {
    const cameraButtons = document.querySelectorAll('[onclick^="startCamera"]');
    cameraButtons.forEach(button => {
        const type = button.getAttribute('onclick').match(/'(.+)'/)[1];
        button.onclick = () => startCamera(type);
    });
}

async function startCamera(type) {
    activePreview = type;
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    if (!modal || !video) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        currentStream = stream;
        video.srcObject = stream;
        await video.play();
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error accessing camera:', error);
        showToast('Error al acceder a la cámara', 'error');
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    if (video) video.srcObject = null;
    if (modal) modal.classList.add('hidden');
    
    activePreview = null;
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    if (!video || !video.videoWidth || !activePreview) {
        showToast('Error al capturar la foto', 'error');
        return;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        updatePreview(activePreview, imageData);
        imageStore[activePreview] = imageData;
        
        stopCamera();
        showToast('Foto capturada exitosamente');
    } catch (error) {
        console.error('Error capturing photo:', error);
        showToast('Error al procesar la foto', 'error');
    }
}

function updatePreview(type, imageData) {
    const preview = document.getElementById(`preview${capitalize(type)}`);
    if (!preview) return;

    const placeholder = preview.querySelector('.placeholder-logo');
    const loading = preview.querySelector('.loading');

    if (loading) loading.classList.remove('hidden');
    if (placeholder) placeholder.style.display = 'none';

    const img = new Image();
    img.onload = () => {
        const oldImg = preview.querySelector('img');
        if (oldImg) oldImg.remove();
        
        if (loading) loading.classList.add('hidden');
        preview.appendChild(img);
        showToast('Imagen actualizada exitosamente');
    };
    img.onerror = () => {
        if (loading) loading.classList.add('hidden');
        if (placeholder) placeholder.style.display = 'flex';
        showToast('Error al cargar la imagen', 'error');
    };
    img.src = imageData;
}

// Firma digital
function initializeSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    // Configuración inicial del canvas
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);

    signaturePad = new SignaturePad(canvas, {
        minWidth: 0.5,
        maxWidth: 2.5,
        penColor: currentPenColor,
        backgroundColor: 'rgb(255, 255, 255)',
        throttle: 16,
        velocityFilterWeight: 0.7
    });

    // Botones de firma
    document.getElementById('clearSignature')?.addEventListener('click', () => {
        signaturePad.clear();
        imageStore.signature = null;
        showToast('Firma borrada');
    });

    document.getElementById('changeColor')?.addEventListener('click', () => {
        currentPenColor = currentPenColor === '#000000' ? '#0000FF' : '#000000';
        signaturePad.penColor = currentPenColor;
        showToast('Color de firma cambiado');
    });

    // Manejar redimensionamiento
    window.addEventListener('resize', debounce(resizeSignaturePad, 250));
}

function resizeSignaturePad() {
    if (!signaturePad || !signaturePad.canvas) return;

    const canvas = signaturePad.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = signaturePad.toData();

    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    
    signaturePad.clear();
    if (data && data.length > 0) {
        signaturePad.fromData(data);
    }
}

// Manejo del personal
function addPersonal() {
    const container = document.getElementById('personalList');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'personal-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'personal[]';
    input.placeholder = 'Nombre del personal';
    
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-danger';
    button.innerHTML = '<i class="fas fa-minus"></i>';
    button.onclick = function() {
        div.remove();
    };
    
    div.appendChild(input);
    div.appendChild(button);
    container.appendChild(div);
    
    input.focus();
}

// Compartir por WhatsApp
async function shareWhatsApp() {
    const form = document.getElementById('cleaningForm');
    if (!form) return;

    const fecha = form.querySelector('#fecha')?.value;
    const departamento = form.querySelector('#departamento')?.value;

    if (!fecha || !departamento) {
        showToast('Por favor complete los campos requeridos', 'error');
        return;
    }

    const personal = Array.from(form.querySelectorAll('input[name="personal[]"]'))
        .map(input => input.value.trim())
        .filter(Boolean)
        .join(', ');

    try {
        // Preparar imágenes para compartir
        const imagesToShare = [];
        let message = `🧹 *Control de Limpieza*\n\n` +
                     `📅 Fecha: ${fecha}\n` +
                     `🏢 Departamento: ${departamento}\n`;

        if (personal) {
            message += `👥 Personal: ${personal}\n\n`;
        }

        // Procesar imágenes si existen
        if (imageStore.before || imageStore.after || (signaturePad && !signaturePad.isEmpty())) {
            if (imageStore.before) {
                message += '📸 Foto Antes adjunta\n';
                imagesToShare.push(processImage(imageStore.before, 'antes'));
            }
            if (imageStore.after) {
                message += '📸 Foto Después adjunta\n';
                imagesToShare.push(processImage(imageStore.after, 'despues'));
            }
            if (signaturePad && !signaturePad.isEmpty()) {
                imageStore.signature = signaturePad.toDataURL();
                message += '✍️ Firma adjunta\n';
                imagesToShare.push(processImage(imageStore.signature, 'firma'));
            }

            // Intentar compartir con imágenes
            if (navigator.share && navigator.canShare) {
                try {
                    const files = await Promise.all(imagesToShare);
                    const shareData = {
                        text: message,
                        files: files
                    };

                    if (navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                        return;
                    }
                } catch (error) {
                    console.error('Error sharing files:', error);
                }
            }
        }

        // Fallback: compartir solo texto por WhatsApp Web
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        showToast('Abriendo WhatsApp...');

    } catch (error) {
        console.error('Error sharing:', error);
        showToast('Error al compartir', 'error');
    }
}

// Función auxiliar para procesar imágenes
async function processImage(dataUrl, name) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

// Reset formulario
function initializeFormReset() {
    document.getElementById('resetForm')?.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
            resetForm();
        }
    });
}

function resetForm() {
    const form = document.getElementById('cleaningForm');
    if (!form) return;

    form.reset();
    
    if (signaturePad) {
        signaturePad.clear();
    }
    
    ['Before', 'After'].forEach(type => {
        const preview = document.getElementById(`preview${type}`);
        if (preview) {
            const img = preview.querySelector('img');
            if (img) img.remove();
            
            const placeholder = preview.querySelector('.placeholder-logo');
            if (placeholder) placeholder.style.display = 'flex';
        }
    });
    
    // Limpiar almacenamiento
    imageStore.before = null;
    imageStore.after = null;
    imageStore.signature = null;
    
    // Resetear lista de personal
    const personalList = document.getElementById('personalList');
    if (personalList) {
        personalList.innerHTML = `
            <div class="personal-item">
                <input type="text" name="personal[]" placeholder="Nombre del personal">
                <button type="button" class="btn-primary" onclick="addPersonal()">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    }
    
    showToast('Formulario reiniciado');
}

// Utilidades
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}// Variables globales
let signaturePad;
let currentPenColor = '#000000';
let currentStream = null;
let activePreview = null;

// Almacenamiento de imágenes
const imageStore = {
    before: null,
    after: null,
    signature: null
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeSignaturePad();
    initializeCamera();
    initializeFormReset();
    initializePhotoSystem();
    setupPhotoInputs();
});

// Inicialización del tema
function initializeTheme() {
    const defaultColors = {
        bgColor: '#f5f5f5',
        primaryColor: '#3b82f6',
        textColor: '#1a1a1a'
    };

    Object.entries(defaultColors).forEach(([key, defaultValue]) => {
        const input = document.getElementById(key);
        if (!input) return;

        // Cargar color guardado o usar default
        const savedColor = localStorage.getItem(key) || defaultValue;
        input.value = savedColor;
        document.documentElement.style.setProperty(`--${key.replace('Color', '')}-color`, savedColor);

        // Manejar cambios
        input.addEventListener('input', (e) => {
            const color = e.target.value;
            document.documentElement.style.setProperty(`--${key.replace('Color', '')}-color`, color);
            localStorage.setItem(key, color);
        });
    });
}

// Sistema de fotos
function initializePhotoSystem() {
    ['Before', 'After'].forEach(type => {
        const preview = document.getElementById(`preview${type}`);
        const fileInput = document.getElementById(`fileInput${type}`);
        const chooseBtn = document.getElementById(`choose${type}`);

        if (preview) {
            preview.addEventListener('click', () => handlePreviewClick(type));
        }

        if (chooseBtn) {
            chooseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (fileInput) fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFileSelect(e, type.toLowerCase()));
        }
    });
}

function setupPhotoInputs() {
    const modal = document.getElementById('cameraModal');
    const closeBtn = document.getElementById('closeModal');
    const captureBtn = document.getElementById('captureBtn');

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) stopCamera();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', stopCamera);
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }

    // Manejar tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            stopCamera();
        }
    });
}

function handlePreviewClick(type) {
    const preview = document.getElementById(`preview${type}`);
    if (!preview || preview.querySelector('img')) return;
    
    const fileInput = document.getElementById(`fileInput${type}`);
    if (fileInput) fileInput.click();
}

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen válida', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        updatePreview(type, e.target.result);
        imageStore[type] = e.target.result;
    };
    reader.onerror = () => showToast('Error al cargar la imagen', 'error');
    reader.readAsDataURL(file);
}

// Manejo de la cámara
function initializeCamera() {
    const cameraButtons = document.querySelectorAll('[onclick^="startCamera"]');
    cameraButtons.forEach(button => {
        const type = button.getAttribute('onclick').match(/'(.+)'/)[1];
        button.onclick = () => startCamera(type);
    });
}

async function startCamera(type) {
    activePreview = type;
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    if (!modal || !video) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        currentStream = stream;
        video.srcObject = stream;
        await video.play();
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error accessing camera:', error);
        showToast('Error al acceder a la cámara', 'error');
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');

    if (video) video.srcObject = null;
    if (modal) modal.classList.add('hidden');
    
    activePreview = null;
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    if (!video || !video.videoWidth || !activePreview) {
        showToast('Error al capturar la foto', 'error');
        return;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        updatePreview(activePreview, imageData);
        imageStore[activePreview] = imageData;
        
        stopCamera();
        showToast('Foto capturada exitosamente');
    } catch (error) {
        console.error('Error capturing photo:', error);
        showToast('Error al procesar la foto', 'error');
    }
}

function updatePreview(type, imageData) {
    const preview = document.getElementById(`preview${capitalize(type)}`);
    if (!preview) return;

    const placeholder = preview.querySelector('.placeholder-logo');
    const loading = preview.querySelector('.loading');

    if (loading) loading.classList.remove('hidden');
    if (placeholder) placeholder.style.display = 'none';

    const img = new Image();
    img.onload = () => {
        const oldImg = preview.querySelector('img');
        if (oldImg) oldImg.remove();
        
        if (loading) loading.classList.add('hidden');
        preview.appendChild(img);
        showToast('Imagen actualizada exitosamente');
    };
    img.onerror = () => {
        if (loading) loading.classList.add('hidden');
        if (placeholder) placeholder.style.display = 'flex';
        showToast('Error al cargar la imagen', 'error');
    };
    img.src = imageData;
}

// Firma digital
function initializeSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    // Configuración inicial del canvas
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);

    signaturePad = new SignaturePad(canvas, {
        minWidth: 0.5,
        maxWidth: 2.5,
        penColor: currentPenColor,
        backgroundColor: 'rgb(255, 255, 255)',
        throttle: 16,
        velocityFilterWeight: 0.7
    });

    // Botones de firma
    document.getElementById('clearSignature')?.addEventListener('click', () => {
        signaturePad.clear();
        imageStore.signature = null;
        showToast('Firma borrada');
    });

    document.getElementById('changeColor')?.addEventListener('click', () => {
        currentPenColor = currentPenColor === '#000000' ? '#0000FF' : '#000000';
        signaturePad.penColor = currentPenColor;
        showToast('Color de firma cambiado');
    });

    // Manejar redimensionamiento
    window.addEventListener('resize', debounce(resizeSignaturePad, 250));
}

function resizeSignaturePad() {
    if (!signaturePad || !signaturePad.canvas) return;

    const canvas = signaturePad.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = signaturePad.toData();

    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    
    signaturePad.clear();
    if (data && data.length > 0) {
        signaturePad.fromData(data);
    }
}

// Manejo del personal
function addPersonal() {
    const container = document.getElementById('personalList');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'personal-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'personal[]';
    input.placeholder = 'Nombre del personal';
    
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-danger';
    button.innerHTML = '<i class="fas fa-minus"></i>';
    button.onclick = function() {
        div.remove();
    };
    
    div.appendChild(input);
    div.appendChild(button);
    container.appendChild(div);
    
    input.focus();
}

// Compartir por WhatsApp
async function shareWhatsApp() {
    const form = document.getElementById('cleaningForm');
    if (!form) return;

    const fecha = form.querySelector('#fecha')?.value;
    const departamento = form.querySelector('#departamento')?.value;

    if (!fecha || !departamento) {
        showToast('Por favor complete los campos requeridos', 'error');
        return;
    }

    const personal = Array.from(form.querySelectorAll('input[name="personal[]"]'))
        .map(input => input.value.trim())
        .filter(Boolean)
        .join(', ');

    try {
        // Preparar imágenes para compartir
        const imagesToShare = [];
        let message = `🧹 *Control de Limpieza*\n\n` +
                     `📅 Fecha: ${fecha}\n` +
                     `🏢 Departamento: ${departamento}\n`;

        if (personal) {
            message += `👥 Personal: ${personal}\n\n`;
        }

        // Procesar imágenes si existen
        if (imageStore.before || imageStore.after || (signaturePad && !signaturePad.isEmpty())) {
            if (imageStore.before) {
                message += '📸 Foto Antes adjunta\n';
                imagesToShare.push(processImage(imageStore.before, 'antes'));
            }
            if (imageStore.after) {
                message += '📸 Foto Después adjunta\n';
                imagesToShare.push(processImage(imageStore.after, 'despues'));
            }
            if (signaturePad && !signaturePad.isEmpty()) {
                imageStore.signature = signaturePad.toDataURL();
                message += '✍️ Firma adjunta\n';
                imagesToShare.push(processImage(imageStore.signature, 'firma'));
            }

            // Intentar compartir con imágenes
            if (navigator.share && navigator.canShare) {
                try {
                    const files = await Promise.all(imagesToShare);
                    const shareData = {
                        text: message,
                        files: files
                    };

                    if (navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                        return;
                    }
                } catch (error) {
                    console.error('Error sharing files:', error);
                }
            }
        }

        // Fallback: compartir solo texto por WhatsApp Web
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        showToast('Abriendo WhatsApp...');

    } catch (error) {
        console.error('Error sharing:', error);
        showToast('Error al compartir', 'error');
    }
}

// Función auxiliar para procesar imágenes
async function processImage(dataUrl, name) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

// Reset formulario
function initializeFormReset() {
    document.getElementById('resetForm')?.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
            resetForm();
        }
    });
}

function resetForm() {
    const form = document.getElementById('cleaningForm');
    if (!form) return;

    form.reset();
    
    if (signaturePad) {
        signaturePad.clear();
    }
    
    ['Before', 'After'].forEach(type => {
        const preview = document.getElementById(`preview${type}`);
        if (preview) {
            const img = preview.querySelector('img');
            if (img) img.remove();
            
            const placeholder = preview.querySelector('.placeholder-logo');
            if (placeholder) placeholder.style.display = 'flex';
        }
    });
    
    // Limpiar almacenamiento
    imageStore.before = null;
    imageStore.after = null;
    imageStore.signature = null;
    
    // Resetear lista de personal
    const personalList = document.getElementById('personalList');
    if (personalList) {
        personalList.innerHTML = `
            <div class="personal-item">
                <input type="text" name="personal[]" placeholder="Nombre del personal">
                <button type="button" class="btn-primary" onclick="addPersonal()">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    }
    
    showToast('Formulario reiniciado');
}

// Utilidades
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

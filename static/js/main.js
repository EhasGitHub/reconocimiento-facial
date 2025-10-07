// Variables globales
const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('statusDiv');
const videoContainer = document.querySelector('.video-container');

let stream = null;
let detectionInterval = null;
let modelsLoaded = false;
let fpsArray = [];
let lastTime = Date.now();

// Estadísticas
let stats = {
    totalFaces: 0,
    totalDetections: 0,
    avgConfidence: 0
};

// Cargar modelos al iniciar
async function loadModels() {
    try {
        updateStatus('Cargando modelos de IA...', 'loading');
        console.log('Iniciando carga de modelos...');
        
        const MODEL_URL = '/models';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log('✓ TinyFaceDetector cargado');
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log('✓ FaceLandmark68Net cargado');
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log('✓ FaceRecognitionNet cargado');
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log('✓ FaceExpressionNet cargado');
        
        await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
        console.log('✓ AgeGenderNet cargado');
        
        modelsLoaded = true;
        updateStatus('✓ Modelos cargados correctamente. Haz clic en "Iniciar Cámara"', 'ready');
        startBtn.disabled = false;
        
        console.log('✓ Todos los modelos cargados correctamente');
    } catch (error) {
        console.error('Error al cargar modelos:', error);
        updateStatus('✗ Error al cargar modelos: ' + error.message, 'error');
    }
}

// Actualizar estado
function updateStatus(message, type) {
    statusDiv.innerHTML = type === 'loading' 
        ? `<div class="loader"></div><p>${message}</p>` 
        : `<p>${message}</p>`;
    statusDiv.className = `status ${type}`;
}

// Iniciar video
async function startVideo() {
    if (!modelsLoaded) {
        updateStatus('Los modelos aún no están cargados', 'error');
        return;
    }
    
    try {
        updateStatus('Solicitando acceso a la cámara...', 'loading');
        console.log('Solicitando acceso a la cámara...');
        
        // Detener stream anterior si existe
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // Solicitar acceso a la cámara
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 720 },
                height: { ideal: 560 },
                facingMode: 'user'
            },
            audio: false
        });
        
        console.log('✓ Acceso a cámara concedido');
        video.srcObject = stream;
        
        // Esperar a que el video esté listo
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('✓ Metadata del video cargada');
                resolve();
            };
        });
        
        // Iniciar reproducción
        await video.play();
        console.log('✓ Video iniciado');
        
        // Mostrar contenedor
        videoContainer.style.display = 'inline-block';
        updateStatus('✓ Cámara activa - Detectando rostros...', 'ready');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // Esperar un momento para que el video se estabilice
        setTimeout(() => {
            startFaceDetection();
        }, 500);
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        let errorMsg = 'No se pudo acceder a la cámara. ';
        
        if (error.name === 'NotAllowedError') {
            errorMsg += 'Permiso denegado. Permite el acceso a la cámara en tu navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'No se encontró ninguna cámara en tu dispositivo.';
        } else if (error.name === 'NotReadableError') {
            errorMsg += 'La cámara está siendo usada por otra aplicación.';
        } else {
            errorMsg += error.message;
        }
        
        updateStatus('✗ ' + errorMsg, 'error');
    }
}

// Iniciar detección facial
function startFaceDetection() {
    console.log('Iniciando detección facial...');
    
    // Crear canvas
    const canvas = faceapi.createCanvasFromMedia(video);
    videoContainer.appendChild(canvas);
    
    // Ajustar tamaño del canvas
    const displaySize = { 
        width: video.videoWidth, 
        height: video.videoHeight 
    };
    
    console.log('Tamaño del video:', displaySize);
    faceapi.matchDimensions(canvas, displaySize);
    
    const ctx = canvas.getContext('2d');
    
    // Función de detección
    const detect = async () => {
        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();
            
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            // Limpiar canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detections.length > 0) {
                // Dibujar detecciones
                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
                faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
                
                // Dibujar edad y género
                resizedDetections.forEach(detection => {
                    const { age, gender, genderProbability } = detection;
                    const box = detection.detection.box;
                    
                    // Expresión dominante
                    const expressions = detection.expressions;
                    const maxExpression = Object.keys(expressions).reduce((a, b) => 
                        expressions[a] > expressions[b] ? a : b
                    );
                    
                    const expressionText = translateExpression(maxExpression);
                    const expressionValue = (expressions[maxExpression] * 100).toFixed(0);
                    
                    // Dibujar información
                    const textY = box.y - 10;
                    ctx.fillStyle = '#00ff00';
                    ctx.font = 'bold 18px Arial';
                    ctx.fillText(
                        `${Math.round(age)} años | ${translateGender(gender)} (${(genderProbability * 100).toFixed(0)}%)`,
                        box.x,
                        textY > 20 ? textY : 20
                    );
                    
                    ctx.fillStyle = '#ffff00';
                    ctx.fillText(
                        `${expressionText} (${expressionValue}%)`,
                        box.x,
                        textY > 20 ? textY + 20 : 40
                    );
                });
            }
            
            // Actualizar estadísticas
            calculateStats(detections);
            
        } catch (error) {
            console.error('Error en detección:', error);
        }
    };
    
    // Ejecutar detección cada 100ms
    detectionInterval = setInterval(detect, 100);
    console.log('✓ Detección iniciada');
}

// Detener video
function stopVideo() {
    console.log('Deteniendo video...');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
    }
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    // Limpiar canvas
    const canvas = videoContainer.querySelector('canvas');
    if (canvas) {
        canvas.remove();
    }
    
    videoContainer.style.display = 'none';
    updateStatus('Cámara detenida. Haz clic en "Iniciar Cámara" para continuar.', 'ready');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // Resetear estadísticas
    updateStats(0, 0, 0);
    
    console.log('✓ Video detenido');
}

// Calcular estadísticas
function calculateStats(detections) {
    const currentTime = Date.now();
    const delta = (currentTime - lastTime) / 1000;
    const currentFPS = 1 / delta;
    lastTime = currentTime;
    
    fpsArray.push(currentFPS);
    if (fpsArray.length > 30) fpsArray.shift();
    
    const avgFPS = fpsArray.reduce((a, b) => a + b, 0) / fpsArray.length;
    
    stats.totalDetections++;
    stats.totalFaces = detections.length;
    
    let totalConfidence = 0;
    detections.forEach(d => {
        totalConfidence += d.detection.score;
    });
    
    stats.avgConfidence = detections.length > 0 
        ? (totalConfidence / detections.length * 100) 
        : 0;
    
    updateStats(stats.totalFaces, avgFPS, stats.avgConfidence);
}

// Actualizar UI de estadísticas
function updateStats(faces, fps, confidence) {
    document.getElementById('faceCount').textContent = faces;
    document.getElementById('fps').textContent = Math.round(fps);
    document.getElementById('confidence').textContent = Math.round(confidence) + '%';
}

// Traducir expresiones
function translateExpression(expression) {
    const translations = {
        'neutral': 'Neutral',
        'happy': 'Feliz',
        'sad': 'Triste',
        'angry': 'Enojado',
        'fearful': 'Asustado',
        'disgusted': 'Disgustado',
        'surprised': 'Sorprendido'
    };
    return translations[expression] || expression;
}

// Traducir género
function translateGender(gender) {
    return gender === 'male' ? 'Hombre' : 'Mujer';
}

// Event listeners
startBtn.addEventListener('click', startVideo);
stopBtn.addEventListener('click', stopVideo);

// Cargar modelos al iniciar la página
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, iniciando carga de modelos...');
    loadModels();
});

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
    stopVideo();
});
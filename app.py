from flask import Flask, render_template, send_from_directory, jsonify
import os
import requests
from pathlib import Path

app = Flask(__name__)

# Rutas de modelos
MODELS_DIR = Path(__file__).parent / 'models'
MODEL_BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'

# Lista de modelos necesarios
MODELS = {
    'tiny_face_detector': [
        'tiny_face_detector_model-weights_manifest.json',
        'tiny_face_detector_model-shard1'
    ],
    'face_landmark_68': [
        'face_landmark_68_model-weights_manifest.json',
        'face_landmark_68_model-shard1'
    ],
    'face_recognition': [
        'face_recognition_model-weights_manifest.json',
        'face_recognition_model-shard1',
        'face_recognition_model-shard2'
    ],
    'face_expression': [
        'face_expression_model-weights_manifest.json',
        'face_expression_model-shard1'
    ],
    'age_gender': [
        'age_gender_model-weights_manifest.json',
        'age_gender_model-shard1'
    ]
}

def download_models():
    """Descarga los modelos de face-api.js si no existen"""
    MODELS_DIR.mkdir(exist_ok=True)
    
    print("Verificando modelos...")
    for model_name, files in MODELS.items():
        for file_name in files:
            file_path = MODELS_DIR / file_name
            if not file_path.exists():
                print(f"Descargando {file_name}...")
                url = f"{MODEL_BASE_URL}/{file_name}"
                try:
                    response = requests.get(url, timeout=30)
                    response.raise_for_status()
                    with open(file_path, 'wb') as f:
                        f.write(response.content)
                    print(f"✓ {file_name} descargado")
                except Exception as e:
                    print(f"✗ Error descargando {file_name}: {e}")
            else:
                print(f"✓ {file_name} ya existe")
    
    print("\n¡Modelos listos!\n")

@app.route('/')
def index():
    """Página principal"""
    return render_template('index.html')

@app.route('/models/<path:filename>')
def serve_models(filename):
    """Sirve los archivos de modelos"""
    return send_from_directory('models', filename)

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Sirve archivos estáticos"""
    return send_from_directory('static', filename)

@app.route('/api/status')
def status():
    """Verifica el estado del servidor"""
    return jsonify({
        'status': 'ok',
        'message': 'Servidor de reconocimiento facial activo'
    })

if __name__ == '__main__':
    print("=" * 50)
    print("SISTEMA DE RECONOCIMIENTO FACIAL")
    print("=" * 50)
    
    # Descargar modelos si es necesario
    download_models()
    
    print("Iniciando servidor Flask...")
    print("Abre tu navegador en: http://localhost:5000")
    print("Presiona Ctrl+C para detener el servidor")
    print("=" * 50 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
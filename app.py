

import os
import logging
import pickle
import tensorflow as tf # <-- Import TensorFlow is necessary for Keras models
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin, login_user, LoginManager, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv

# Load variables from your .env file into the environment
load_dotenv()

# --- 1. SETUP ---
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
# Allow local dev + the configured frontend origin
CORS(app, origins=["http://fireweatherindex.com:5173", "http://localhost:5173"], supports_credentials=True)

# --- Load NEW PINN Machine Learning Models ---
try:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # **** Correct filenames for PINN ****
    scaler_path = os.path.join(base_dir, 'scaler_pinn.pkl')
    model_path = os.path.join(base_dir, 'fwi_pinn_model.keras')

    scaler = pickle.load(open(scaler_path, 'rb'))
    pinn_model = tf.keras.models.load_model(model_path) # <-- Load the PINN model
    app.logger.info("Successfully loaded scaler_pinn.pkl and fwi_pinn_model.keras.")
except FileNotFoundError:
    scaler = None
    pinn_model = None # <-- Use correct variable name
    app.logger.error("CRITICAL: Could not find scaler_pinn.pkl or fwi_pinn_model.keras. Prediction will fail.")
except ImportError:
    scaler = None
    pinn_model = None
    app.logger.error("TensorFlow not found or import error. Cannot load Keras model. Prediction will fail.")
except Exception as e:
    scaler = None
    pinn_model = None # <-- Use correct variable name
    app.logger.error(f"An error occurred loading the ML models: {e}")

# --- 2. CONFIGURATIONS ---
# (This section is the same as before)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'default-dev-secret-key-for-testing')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///db.sqlite3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

# --- 3. INITIALIZE EXTENSIONS & DB MODEL ---
# (This section is the same as before)
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.session_protection = "strong"

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except Exception:
        return None

# --- 4. AUTHENTICATION API ROUTES ---
# (These routes remain the same)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json or {}
    email, password = data.get('email'), data.get('password')
    if not all([email, password]): return jsonify({"error": "Email and password are required"}), 400
    if User.query.filter_by(email=email).first(): return jsonify({"error": "Email already registered"}), 409
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(email=email, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": f"User {email} registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email, password = data.get('email'), data.get('password')
    if not all([email, password]): return jsonify({"error": "Email and password are required"}), 400
    user = User.query.filter_by(email=email).first()
    if user and bcrypt.check_password_hash(user.password, password):
        login_user(user)
        return jsonify({"message": "Login successful", "user": {"email": user.email}}), 200
    return jsonify({"error": "Invalid email or password"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if current_user.is_authenticated:
        return jsonify({"is_logged_in": True, "user": {"email": current_user.email}}), 200
    return jsonify({"is_logged_in": False}), 401

# --- 5. DATA API ROUTES (Protected) ---
# (All routes EXCEPT /api/predict remain the same)
COUNTRY_COORDS = {
    "India": {"lat": "28.6139", "lon": "77.2090"},
    "USA": {"lat": "38.9637", "lon": "-95.7129"},
    "Canada": {"lat": "56.1304", "lon": "-106.3468"}
}

@app.route('/api/weather', methods=['GET'])
@login_required
def get_weather():
    # (This function remains the same, using os.getenv for key)
    try:
        country = request.args.get('country', 'India')
        coords = COUNTRY_COORDS.get(country)
        if not coords: return jsonify({"error": "Country not found"}), 404

        API_KEY = os.getenv('OWM_API_KEY')
        if not API_KEY:
            app.logger.error("Missing OpenWeatherMap API key (OWM_API_KEY)")
            return jsonify({"error": "Server is missing the OpenWeatherMap API key."}), 500

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={coords['lat']}&lon={coords['lon']}&appid={API_KEY}&units=metric"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        wind_speed_ms = (data.get('wind') or {}).get('speed') or 0
        main_data = data.get('main') or {}
        rain_dict = data.get('rain') or {}
        rain_mm = 0
        for key in ('1h', '3h'):
            if key in rain_dict:
                rain_mm = rain_dict.get(key) or 0
                break

        weather_data = {
            "temperature": main_data.get('temp', 0),
            "humidity": main_data.get('humidity', 0),
            "wind_speed": wind_speed_ms * 2.23694,
            "rain": (rain_mm or 0) / 25.4
        }
        return jsonify(weather_data), 200
    except requests.exceptions.HTTPError as e:
        resp = getattr(e, "response", None)
        detail, status = None, 502
        try:
            if resp is not None: status, detail = resp.status_code, resp.json()
        except Exception:
            detail = resp.text if resp is not None else str(e)
        app.logger.error(f"HTTP Error from OpenWeatherMap: {detail}")
        return jsonify({"error": "Failed to fetch data from weather service.", "detail": detail}), status
    except requests.exceptions.RequestException as e:
        app.logger.exception("Request to OpenWeatherMap failed")
        return jsonify({"error": "Could not connect to weather service.", "detail": str(e)}), 502
    except Exception as e:
        app.logger.exception("Unexpected error in get_weather")
        return jsonify({"error": f"An unexpected server error occurred: {e}"}), 500

# **** THIS IS THE PREDICTION FUNCTION USING THE PINN MODEL ****
@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    # **** Check for pinn_model ****
    if not pinn_model or not scaler:
        app.logger.error("Prediction attempted, but PINN models are not loaded.")
        return jsonify({"error": "Prediction models are not available on the server."}), 503

    data = request.json or {}
    try:
        # The feature order must be EXACTLY what your model was trained on.
        features = [
            float(data.get('temperature', 0)), float(data.get('humidity', 0)),
            float(data.get('wind_speed', 0)), float(data.get('rain', 0)),
            float(data.get('ffmc', 0)), float(data.get('dmc', 0)),
            float(data.get('dc', 0)), float(data.get('isi', 0))
        ]

        # Scale the features using the PINN's scaler
        scaled_features = scaler.transform([features])

        # **** Make the prediction with your loaded PINN model ****
        prediction = pinn_model.predict(scaled_features)

        # The result is a 2D array, so we get the first item of the first item
        fwi_value = round(float(prediction[0][0]), 2)

        # Return the real, PINN-powered prediction
        return jsonify({'fwi_prediction': fwi_value}), 200

    except Exception as e:
        app.logger.exception("An error occurred during prediction")
        return jsonify({"error": f"Prediction error: {e}"}), 400


@app.route('/api/fires', methods=['GET'])
@login_required
def get_fires():
    # (This function remains the same, using os.getenv for key)
    try:
        NASA_API_KEY = os.getenv('NASA_API_KEY')
        if not NASA_API_KEY:
            app.logger.error("Missing NASA_API_KEY")
            return jsonify({"error": "Server missing NASA_API_KEY"}), 500
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{NASA_API_KEY}/VIIRS_SNPP_NRT/68,6,98,38/1"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        csv_lines, fires = response.text.splitlines(), []
        if len(csv_lines) > 1:
            header = csv_lines[0].split(',')
            lat_idx, lon_idx = header.index('latitude'), header.index('longitude')
            for line in csv_lines[1:]:
                parts = line.split(',')
                try: fires.append({"lat": float(parts[lat_idx]), "lon": float(parts[lon_idx])})
                except (ValueError, IndexError): continue
        return jsonify(fires), 200
    except Exception as e:
        app.logger.exception("Failed to fetch fire data")
        return jsonify({"error": f"Failed to fetch fire data: {e}"}), 500

@app.route('/api/station_data', methods=['GET'])
@login_required
def get_station_data():
    # (This function remains the same, using os.getenv for key)
    try:
        station_id, start_date, end_date = request.args.get('station_id'), request.args.get('start_date'), request.args.get('end_date')
        if not all([station_id, start_date, end_date]):
            return jsonify({"error": "Missing station_id, start_date, or end_date"}), 400

        SYNOPTIC_API_KEY = os.getenv('SYNOPTIC_API_KEY')
        if not SYNOPTIC_API_KEY:
            app.logger.error("Missing SYNOPTIC_API_KEY")
            return jsonify({"error": "Server missing SYNOPTIC_API_KEY"}), 500

        api_url = (f"https://api.synopticdata.com/v2/stations/timeseries?token={SYNOPTIC_API_KEY}&stid={station_id}"
                   f"&start={start_date}0000&end={end_date}2359&vars=air_temp,relative_humidity,wind_speed,precip_accum_one_hour"
                   f"&obtimezone=local&units=metric,mph,in")
        response = requests.get(api_url, timeout=15)
        response.raise_for_status()
        data = response.json()
        if data.get('STATION'):
            obs = data['STATION'][0].get('OBSERVATIONS', {})
            rows, dates = [], obs.get('date_time', [])
            for i in range(len(dates)):
                temp_c = obs.get('air_temp_set_1', [None] * len(dates))[i]
                rows.append({
                    "id": i + 1, "date": dates[i],
                    "airTemp": (temp_c * 9/5 + 32) if temp_c is not None else None,
                    "rh": obs.get('relative_humidity_set_1', [None] * len(dates))[i],
                    "wind": obs.get('wind_speed_set_1', [None] * len(dates))[i],
                    "precip": obs.get('precip_accum_one_hour_set_1', [None] * len(dates))[i],
                    "init": "daily", "month": "N/A", "solar": None, "ffmc": 85, "dmc": 6, "dc": 15, "isi": 2, "bui": None, "fwi": None
                })
            return jsonify(rows), 200
        return jsonify({"error": "Station data not found or invalid ID"}), 404
    except Exception as e:
        app.logger.exception("An error occurred fetching station data")
        return jsonify({"error": f"An error occurred: {e}"}), 500

# --- 6. RUN THE APP ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=int(os.getenv('PORT', 5000)))
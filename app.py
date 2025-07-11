from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from redis import Redis
from flask_cors import CORS
import os
import requests
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)  # Initialize CORS

# Configure Redis client
redis_client = Redis(host="localhost", port=6379)

# Initialize the limiter with Redis as the storage backend
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="redis://localhost:6379"
)

# Function to calculate distance using the Haversine formula
def haversine(lat1, lon1, lat2, lon2):
    R = 3440.065  # Radius of the Earth in nautical miles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

# Apply hourly and monthly rate limits to the /planes endpoint
@app.route('/planes', methods=['GET'])
@limiter.limit("500/hour")  # 500 requests per hour
@limiter.limit("10000/month")  # 10,000 requests per month
def get_planes():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    dist = request.args.get('dist', 5)

    if not lat or not lon:
        return jsonify({"error": "Please provide both 'lat' and 'lon' parameters"}), 400

    headers = {
        'x-rapidapi-key': '',  # Replace with your actual API key
        'x-rapidapi-host': 'adsbexchange-com1.p.rapidapi.com',
    }
    url = f"https://adsbexchange-com1.p.rapidapi.com/v2/lat/{lat}/lon/{lon}/dist/{dist}/"

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            planes = response.json().get('ac', [])
            user_lat = float(lat)
            user_lon = float(lon)
            for plane in planes:
                if 'lat' in plane and 'lon' in plane:
                    plane['dist'] = haversine(user_lat, user_lon, plane['lat'], plane['lon'])
            planes = sorted(planes, key=lambda x: x.get('dist', float('inf')))
            return jsonify({'ac': planes})
        else:
            return jsonify({"error": f"API returned status code {response.status_code}", "details": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/airlines.json', methods=['GET'])
def serve_airlines_json():
    return send_from_directory(os.getcwd(), 'airlines.json')

@app.route('/')
def serve_index():
    return send_from_directory('frontend', 'index.html')

# Custom error handler for rate limit exceeded
@app.errorhandler(429)
def ratelimit_error(e):
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "You have reached the maximum number of allowed requests. Please try again later."
    }), 429

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

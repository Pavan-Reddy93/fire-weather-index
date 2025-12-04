

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fire icon for the map
const fireIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/785/785116.png',
  iconSize: [25, 25]
});

function MapPage() {
  const [fireData, setFireData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // This runs once when the page loads
    const fetchFireData = async () => {
      try {
        // UPDATED: Using the new custom domain for the API call
        const response = await axios.get('http://api.fireweatherindex.com:5000/api/fires');
        if (response.data) {
          setFireData(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch fire data", err);
        setError("Failed to load fire map. Is the backend running?");
      }
    };
    
    fetchFireData();
  }, []); // The empty [] means it only runs on mount

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {error && <h3 style={{ color: 'red', textAlign: 'center' }}>{error}</h3>}
      <MapContainer 
        center={[20.5937, 78.9629]} // Center of India
        zoom={5} 
        style={{ height: '80vh', width: '100%' }} // 80vh = 80% of the viewport height
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {fireData.length > 0 && fireData.map((fire, index) => (
          <Marker 
            key={index} 
            position={[fire.lat, fire.lon]} 
            icon={fireIcon}
          >
            <Popup>Active Fire Detected</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapPage;
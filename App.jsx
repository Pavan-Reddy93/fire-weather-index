

import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'; 
import axios from 'axios';
import FwiTable from './FwiTable';
import MapPage from './MapPage';
import GraphsPage from './GraphsPage';
import LoginPage from './LoginPage';
import 'leaflet/dist/leaflet.css';

// Default row definition (moved here from FwiTable)
const defaultRow = {
  id: Math.random(), init: 'daily', month: 'October', airTemp: 25.0, rh: 50,
  wind: 10, precip: 0, solar: '???', ffmc: 85.0, dmc: 6.0,
  dc: 15.0, isi: 2.0, bui: '???', fwi: '???', // FWI is now calculated
  gfmc: '???', gisi: '???', fbp: '???'
};

function App() {
  const [timezone, setTimezone] = useState('UTC');
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());
  const [country, setCountry] = useState('India');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); 
  const navigate = useNavigate();

  // --- STATE LIFTED UP FROM FwiTable ---
  const [rows, setRows] = useState([{ ...defaultRow, id: 1 }]); 
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState(null);
  // ------------------------------------

  // Check user session on initial load
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await axios.get('http://api.fireweatherindex.com:5000/api/check_session');
        setCurrentUser(response.data.user);
      } catch (err) {
        setCurrentUser(null);
      }
      setIsLoadingAuth(false); 
    };
    checkUserSession();
  }, []);
  
  // --- HANDLERS LIFTED UP FROM FwiTable ---
  const addRow = () => {
    setRows(prevRows => [...prevRows, { ...defaultRow, id: Math.random() }]);
  };

  const removeRow = (idToRemove) => {
    if (rows.length <= 1) return; 
    setRows(prevRows => prevRows.filter(row => row.id !== idToRemove));
  };

  const handleInputChange = (id, field, value) => {
    setRows(currentRows =>
      currentRows.map(row => (row.id === id) ? { ...row, [field]: value } : row)
    );
  };
  
  const handleFetchRowData = async (rowId) => {
    setIsLoadingData(true);
    setErrorData(null);
    try {
      const response = await axios.get('http://api.fireweatherindex.com:5000/api/weather', { params: { country } });
      const data = response.data;
      const temp_F = data.temperature * 9/5 + 32;
      setRows(currentRows => 
        currentRows.map(row => (row.id === rowId) ? { ...row, airTemp: temp_F.toFixed(1), rh: data.humidity.toFixed(0), wind: data.wind_speed.toFixed(1), precip: data.rain.toFixed(2) } : row)
      );
    } catch (err) {
      setErrorData('Failed to fetch weather. Is the backend running?');
    }
    setIsLoadingData(false);
  };
  
  const handleCalculate = async (rowId) => {
    setIsLoadingData(true);
    setErrorData(null);
    const rowData = rows.find(row => row.id === rowId);
    if (!rowData) return;
    try {
      const payload = { temperature: (rowData.airTemp - 32) * 5/9, humidity: rowData.rh, wind_speed: rowData.wind / 2.23694, rain: rowData.precip * 25.4, ffmc: rowData.ffmc, dmc: rowData.dmc, dc: rowData.dc, isi: rowData.isi };
      const response = await axios.post('http://api.fireweatherindex.com:5000/api/predict', payload);
      setRows(currentRows =>
        currentRows.map(row => (row.id === rowId) ? { ...row, fwi: response.data.fwi_prediction } : row)
      );
    } catch (err) {
      setErrorData('Failed to get prediction.');
    }
    setIsLoadingData(false);
  };
  
   const handleFetchStationData = async (stationId, startDate, endDate) => {
    setIsLoadingData(true);
    setErrorData(null);
    const apiStartDate = startDate.replace(/-/g, '');
    const apiEndDate = endDate.replace(/-/g, '');
    try {
      const response = await axios.get('http://api.fireweatherindex.com:5000/api/station_data', { params: { station_id: stationId, start_date: apiStartDate, end_date: apiEndDate } });
      if (response.data.length > 0) {
        // Assign unique IDs to fetched rows
        const fetchedRowsWithIds = response.data.map((row, index) => ({ ...row, id: `station-${index}-${Date.now()}` }));
        setRows(fetchedRowsWithIds);
      } else {
        setErrorData("No data found for this station or date range.");
        setRows([{ ...defaultRow, id: 1 }]); 
      }
    } catch (err) {
      setErrorData(err.response?.data?.error || 'Failed to fetch station data.');
      setRows([{ ...defaultRow, id: 1 }]);
    }
    setIsLoadingData(false);
  };
  // ------------------------------------------

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await axios.post('http://api.fireweatherindex.com:5000/api/logout');
    setCurrentUser(null);
    setRows([{ ...defaultRow, id: 1 }]); // Reset table data on logout
    navigate('/login'); 
  };

  if (isLoadingAuth) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-container">
      
      {/* --- HEADER --- */}
      <header className="header">
        <div className="header-left">FWI Calculator</div>
        <div className="header-right">
          {currentUser && ( /* Only show selectors if logged in */
            <>
              <div className="time">{currentTime}</div>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="UTC">UTC</option><option value="IST">IST</option> 
              </select>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="India">India</option><option value="USA">USA</option><option value="Canada">Canada</option>
              </select>
            </>
          )}
          {currentUser ? ( /* Show user info or login link */
            <>
              <span style={{color: 'white'}}>Welcome, {currentUser.email}</span>
              <button onClick={handleLogout} style={{color: 'white', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'}}>
                Log Out
              </button>
            </>
          ) : (
            <Link to="/login" className="header-link" style={{color: 'white', textDecoration: 'none'}}>
              Log In / Sign Up
            </Link>
          )}
        </div>
      </header>

      {/* --- MAIN CONTENT (Router) --- */}
      <main className="main-content">
        {isLoadingData && <p>Loading Data...</p> /* Show loading indicator */}
        {errorData && <p style={{ color: 'red' }}>Error: {errorData}</p> /* Show error */}
        
        <Routes>
          {/* --- PROTECTED ROUTES --- */}
          <Route path="/" element={currentUser ? <FwiTable 
                rows={rows} 
                country={country} 
                onAddRow={addRow} 
                onRemoveRow={removeRow} 
                onInputChange={handleInputChange} 
                onFetchRowData={handleFetchRowData} 
                onCalculate={handleCalculate} 
                onFetchStationData={handleFetchStationData}
              /> : <Navigate to="/login" />} />
          <Route path="/map" element={currentUser ? <MapPage /> : <Navigate to="/login" />} />
          <Route path="/graphs" element={currentUser ? <GraphsPage tableData={rows} /> : <Navigate to="/login" />} /> 
          <Route path="/tables" element={currentUser ? <FwiTable 
                 rows={rows} 
                 country={country} 
                 onAddRow={addRow} 
                 onRemoveRow={removeRow} 
                 onInputChange={handleInputChange} 
                 onFetchRowData={handleFetchRowData} 
                 onCalculate={handleCalculate} 
                 onFetchStationData={handleFetchStationData}
               /> : <Navigate to="/login" />} />
          <Route path="/tools" element={currentUser ? <FwiTable 
                 rows={rows} 
                 country={country} 
                 onAddRow={addRow} 
                 onRemoveRow={removeRow} 
                 onInputChange={handleInputChange} 
                 onFetchRowData={handleFetchRowData} 
                 onCalculate={handleCalculate} 
                 onFetchStationData={handleFetchStationData}
               /> : <Navigate to="/login" />} />
          
          {/* --- PUBLIC ROUTE --- */}
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        </Routes>
      </main>

      {/* --- FOOTER --- */}
      {currentUser && (
        <footer className="footer">
          <Link to="/" className="footer-link">Home</Link>
          <Link to="/map" className="footer-link">Map</Link>
          <Link to="/tables" className="footer-link">Tables</Link>
          <Link to="/graphs" className="footer-link">Graphs</Link>
          <Link to="/tools" className="footer-link">Tools</Link>
          {/* Download link is now inside FwiTable */}
          <Link to="/" className="footer-link">Download</Link> 
        </footer>
      )}
    </div>
  );
}

export default App;
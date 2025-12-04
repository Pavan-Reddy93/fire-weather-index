

import React, { useState } from 'react';
import axios from 'axios';
import { CSVLink } from "react-csv";

// Accept props passed down from App.jsx
function FwiTable({ 
    rows, 
    country, 
    onAddRow, 
    onRemoveRow, 
    onInputChange, 
    onFetchRowData, 
    onCalculate, 
    onFetchStationData 
}) { 
  // State for station inputs is kept local to this component
  const [stationId, setStationId] = useState(''); 
  const [startDate, setStartDate] = useState(''); 
  const [endDate, setEndDate] = useState('');     

  // Define headers for CSV (remains the same)
  const csvHeaders = [
    { label: "Date", key: "date" }, { label: "Air Temp (°F)", key: "airTemp" }, 
    { label: "RH%", key: "rh" }, { label: "Wind (mph)", key: "wind" }, 
    { label: "Precip (in)", key: "precip" }, { label: "FFMC", key: "ffmc" }, 
    { label: "DMC", key: "dmc" }, { label: "DC", key: "dc" }, 
    { label: "ISI", key: "isi" }, { label: "FWI", key: "fwi" },
  ];

  // Wrapper for station fetch to pass local state
  const handleFetchStationClick = () => {
    if (stationId && startDate && endDate) {
      onFetchStationData(stationId, startDate, endDate);
    } else {
      alert("Please enter Station ID, Start Date, and End Date.");
    }
  };

  return (
    <>
      <div className="fetch-controls">
        {/* Call the onAddRow function passed from App.jsx */}
        <button onClick={onAddRow}>Add Duplicate Row</button> 
        <span>or Fetch from station:</span>
        <input 
          type="text" 
          placeholder="Station ID"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
        />
        <span>from</span>
        <input 
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span>to</span>
        <input 
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {/* Call the wrapper function */}
        <button onClick={handleFetchStationClick}>Fetch Station</button> 

        <CSVLink
          data={rows} // Use rows data passed from App.jsx
          headers={csvHeaders}
          filename={"fwi_report.csv"}
          style={{ textDecoration: 'none', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#e0e0e0', color: 'black' }}
        >
          Download Report
        </CSVLink>
      </div>

      {/* Loading/Error messages are now handled in App.jsx */}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th><th></th><th>Actions</th><th>Date / Init</th><th>Month</th><th>Air Temp (°F)</th><th>RH%</th><th>Wind (mph)</th><th>Precip (in)</th><th>Solar (W/m²)</th><th>FFMC</th><th>DMC</th><th>DC</th><th>ISI</th><th>BUI</th><th>FWI</th><th>GFMC</th><th>GISI</th><th>FBP</th>
            </tr>
          </thead>
          <tbody>
            {/* Use rows data passed from App.jsx */}
            {rows.map((row, index) => ( 
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>
                  {/* Call onRemoveRow passed from App.jsx */}
                  <button className="remove-btn" onClick={() => onRemoveRow(row.id)}> 
                    remove
                  </button>
                </td>
                <td>
                  {/* Call handlers passed from App.jsx */}
                  <button onClick={() => onFetchRowData(row.id)}>Fetch</button>
                  <button onClick={() => onCalculate(row.id)}>Calc</button>
                </td>
                <td>
                  {row.date ? <span>{new Date(row.date).toLocaleDateString()}</span> : 
                    <input type="text" value={row.init} 
                           onChange={(e) => onInputChange(row.id, 'init', e.target.value)} />
                  }
                </td>
                {/* Simplified input rendering using map */}
                {['month', 'airTemp', 'rh', 'wind', 'precip'].map(field => (
                  <td key={field}>
                    <input 
                      type={field === 'month' ? 'text' : 'number'} 
                      value={row[field] ?? ''} // Handle potential null/undefined
                      onChange={(e) => onInputChange(row.id, field, e.target.value)} 
                    />
                  </td>
                ))}
                <td><input type="text" value={row.solar ?? '???'} disabled /></td> 
                {['ffmc', 'dmc', 'dc', 'isi'].map(field => (
                  <td key={field}>
                    <input 
                      type="number" 
                      value={row[field] ?? ''} 
                      onChange={(e) => onInputChange(row.id, field, e.target.value)} 
                    />
                  </td>
                ))}
                {/* Use ?? '???' to show placeholder if value is null/undefined */}
                <td><input type="text" value={row.bui ?? '???'} disabled /></td>
                <td><input type="text" value={row.fwi ?? '???'} disabled /></td>
                <td><input type="text" value={row.gfmc ?? '???'} disabled /></td>
                <td><input type="text" value={row.gisi ?? '???'} disabled /></td>
                <td><input type="text" value={row.fbp ?? '???'} disabled /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default FwiTable;
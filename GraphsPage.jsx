

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function GraphsPage({ tableData }) { 

  // --- Format Data for Chart ---
  // We need to transform the 'rows' array into the format Recharts expects.
  // We'll use the date if available (from station data), otherwise just the index.
  // We also parse the FWI and airTemp values to ensure they are numbers.
  const chartData = tableData.map((row, index) => ({
    // Use 'date' if it exists, otherwise use 'Row X' as the name for the X-axis label
    name: row.date ? new Date(row.date).toLocaleDateString() : `Row ${index + 1}`,
    // Make sure FWI is a number, default to null if not predictable yet or not a number
    fwi: typeof row.fwi === 'number' ? row.fwi : (parseFloat(row.fwi) || null), 
    // Make sure airTemp is a number
    temp: parseFloat(row.airTemp) || null, 
    // Add other values if you want to plot them
    rh: parseFloat(row.rh) || null,
  }));
  // --- End Data Formatting ---

  return (
    <div>
      <h1>Prediction Graphs</h1>
      
      {chartData && chartData.length > 0 ? (
        <>
          <p>This chart shows the predicted FWI values and corresponding data from the table.</p>
          <ResponsiveContainer width="95%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              {/* Use 'name' (which is date or Row #) for X-axis */}
              <XAxis dataKey="name" /> 
              {/* Left Y-axis for FWI */}
              <YAxis yAxisId="left" label={{ value: 'FWI', angle: -90, position: 'insideLeft' }} />
              {/* Right Y-axis for Temperature */}
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Temp (°F)', angle: 90, position: 'insideRight' }}/>
              <Tooltip />
              <Legend />
              {/* Line for FWI prediction */}
              <Line yAxisId="left" type="monotone" dataKey="fwi" stroke="#e88415" name="Predicted FWI" connectNulls /> 
              {/* Line for Temperature */}
              <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#82ca9d" name="Temperature (°F)" connectNulls/>
              {/* You could add another line for RH on the right axis too */}
              {/* <Line yAxisId="right" type="monotone" dataKey="rh" stroke="#8884d8" name="RH (%)" connectNulls/> */}
            </LineChart>
          </ResponsiveContainer>
        </>
      ) : (
        <p>No data available in the table to display graphs.</p>
      )}
    </div>
  );
}

export default GraphsPage;
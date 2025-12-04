

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';



function LoginPage({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    
    const url = isLoginMode 
      ? 'http://api.fireweatherindex.com:5000/api/login' 
      : 'http://api.fireweatherindex.com:5000/api/register';
    
    try {
      const response = await axios.post(url, { email, password });

      if (isLoginMode) {
        // Logged in!
        onLoginSuccess(response.data.user); // Tell App.jsx we are logged in
        navigate('/'); // Go to the home page
      } else {
        // Registered!
        setError('Registration successful! Please log in.');
        setIsLoginMode(true); // Switch to login form
      }

    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error);
      } else {
        setError('An unknown error occurred. Is the backend running?');
      }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>{isLoginMode ? 'Log In' : 'Sign Up'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ margin: '10px 0' }}>
          <label>Email: </label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }} />
        </div>
        <div style={{ margin: '10px 0' }}>
          <label>Password: </label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%' }} />
        </div>
        
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        <button type="submit" style={{ padding: '10px 15px', marginTop: '10px' }}>
          {isLoginMode ? 'Log In' : 'Create Account'}
        </button>
      </form>
      
      <button 
        onClick={() => setIsLoginMode(!isLoginMode)} 
        style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', marginTop: '15px' }}
      >
        {isLoginMode ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
      </button>
    </div>
  );
}

export default LoginPage;
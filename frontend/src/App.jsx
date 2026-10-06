import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import SetupUsername from './pages/SetupUsername';
import Home from './pages/Home';
import Profile from './pages/Profile';

// A simple protective wrapper for the home page
const ProtectedRoute = ({ children }) => {
  // Check URL for OAuth token first
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlUser = params.get('user');

  if (urlToken && urlUser) {
    localStorage.setItem('token', urlToken);
    localStorage.setItem('user', urlUser);
    // Clean up the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/auth" />;
  }
  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/setup-username" element={<SetupUsername />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:username" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
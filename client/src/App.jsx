import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import SessionList from './components/SessionList';
import TerminalView from './components/TerminalView';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { SocketProvider } from './utils/SocketContext';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!user ? <Login /> : <Navigate to="/sessions" />} 
      />
      <Route 
        path="/sessions" 
        element={user ? <SessionList /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/terminal/:sessionId" 
        element={user ? <TerminalView /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/" 
        element={<Navigate to={user ? "/sessions" : "/login"} />} 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
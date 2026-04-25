import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import TerminalView from './components/TerminalView';
import TestNative from './components/TestNative';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { SocketProvider } from './utils/SocketContext';
import { startDiagLogger } from './utils/diagLogger';

function AppContent() {
  const { user, loading } = useAuth();
  useEffect(() => { if (user) startDiagLogger(); }, [user]);

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
        element={!user ? <Login /> : <Navigate to="/workspace" />}
      />
      <Route
        path="/workspace"
        element={user ? <TerminalView /> : <Navigate to="/login" />}
      />
      {/* Legacy routes redirect to workspace */}
      <Route path="/sessions" element={<Navigate to={user ? "/workspace" : "/login"} />} />
      <Route path="/terminal/:sessionId" element={<Navigate to={user ? "/workspace" : "/login"} />} />
      {/* EXPERIMENTAL: tmux control mode test page (experiment branch only) */}
      <Route
        path="/test/native"
        element={user ? <TestNative /> : <Navigate to="/login" />}
      />
      <Route
        path="/"
        element={<Navigate to={user ? "/workspace" : "/login"} />}
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
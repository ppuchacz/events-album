import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { GuestAlbumPage } from './pages/GuestAlbumPage';
import { getAuthToken } from './api';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={getAuthToken() ? '/admin' : '/login'} replace />}
        />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/register" element={<AuthPage initialMode="register" />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/e/:slug" element={<GuestAlbumPage />} />
        <Route path="/:slug" element={<GuestAlbumPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

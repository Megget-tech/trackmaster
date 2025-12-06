import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Router } from 'wouter';
import HomePage from './pages/HomePage';
import './index.css';

/**
 * TrackMaster - Main Entry Point
 *
 * Sets up React app with:
 * - React Query for data fetching
 * - Wouter for client-side routing
 * - Global CSS styles
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <HomePage />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>
);

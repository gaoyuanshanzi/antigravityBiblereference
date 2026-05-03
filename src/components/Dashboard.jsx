import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BibleViewer from './BibleViewer';
import { Download, LogOut, Loader2 } from 'lucide-react';
import { exportToCSV } from '../utils/export';

export default function Dashboard() {
  const { logout, geminiKey } = useAuth();
  const [bibleData, setBibleData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/data/bible_data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load Bible data');
        return res.json();
      })
      .then(data => {
        setBibleData(data);
        setFilteredData(data);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const handleDataFiltered = useCallback((data) => {
    setFilteredData(data);
  }, []);

  const handleExport = () => {
    exportToCSV(filteredData);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Multilingual Bible Comparison
            </h1>
            {geminiKey && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Gemini API Active
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={isLoading || error}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center text-slate-500">
            <Loader2 className="animate-spin mr-2" size={24} />
            Loading Bible Data...
          </div>
        ) : error ? (
          <div className="h-full w-full flex items-center justify-center text-red-500">
            Error: {error}. Please ensure data processing script was run.
          </div>
        ) : (
          <BibleViewer data={bibleData} onDataFiltered={handleDataFiltered} />
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Search, X } from 'lucide-react';

const ColumnHeader = ({ title, searchTerm, onSearchChange, isActive, onClear }) => (
  <div className="flex flex-col gap-2 p-3 bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
    <div className="font-semibold text-slate-800 flex justify-between items-center">
      <span>{title}</span>
    </div>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
        <Search size={14} className="text-slate-400" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={!isActive && isActive !== null}
        placeholder="Search..."
        className="block w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {searchTerm && (
        <button 
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  </div>
);

export default function BibleViewer({ data, onDataFiltered }) {
  const [searches, setSearches] = useState({
    kjv: '',
    krv: '',
    wlc: '',
    lxx: ''
  });

  const activeSearchCol = useMemo(() => {
    return Object.keys(searches).find(k => searches[k].trim() !== '') || null;
  }, [searches]);

  const handleSearchChange = (col, value) => {
    setSearches(prev => ({
      ...prev,
      [col]: value
    }));
  };

  const clearSearch = (col) => {
    setSearches(prev => ({
      ...prev,
      [col]: ''
    }));
  };

  const filteredData = useMemo(() => {
    if (!activeSearchCol) {
      return data;
    }
    const term = searches[activeSearchCol].toLowerCase();
    return data.filter(row => {
      const cellValue = row[activeSearchCol] || '';
      return cellValue.toLowerCase().includes(term);
    });
  }, [data, searches, activeSearchCol]);

  useEffect(() => {
    onDataFiltered(filteredData);
  }, [filteredData, onDataFiltered]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200 shadow-sm z-10">
        <div className="w-[15%] flex-shrink-0 bg-slate-100 border-r border-slate-200">
          <div className="p-3 font-semibold text-slate-800 h-full flex items-center justify-center">
            Reference
          </div>
        </div>
        <div className="w-[21.25%] border-r border-slate-200">
          <ColumnHeader 
            title="KJV (English)" 
            searchTerm={searches.kjv} 
            onSearchChange={(v) => handleSearchChange('kjv', v)}
            isActive={activeSearchCol === null ? null : activeSearchCol === 'kjv'}
            onClear={() => clearSearch('kjv')}
          />
        </div>
        <div className="w-[21.25%] border-r border-slate-200">
          <ColumnHeader 
            title="KRV (Korean)" 
            searchTerm={searches.krv} 
            onSearchChange={(v) => handleSearchChange('krv', v)}
            isActive={activeSearchCol === null ? null : activeSearchCol === 'krv'}
            onClear={() => clearSearch('krv')}
          />
        </div>
        <div className="w-[21.25%] border-r border-slate-200">
          <ColumnHeader 
            title="WLC (Hebrew)" 
            searchTerm={searches.wlc} 
            onSearchChange={(v) => handleSearchChange('wlc', v)}
            isActive={activeSearchCol === null ? null : activeSearchCol === 'wlc'}
            onClear={() => clearSearch('wlc')}
          />
        </div>
        <div className="w-[21.25%]">
          <ColumnHeader 
            title="LXX (Greek)" 
            searchTerm={searches.lxx} 
            onSearchChange={(v) => handleSearchChange('lxx', v)}
            isActive={activeSearchCol === null ? null : activeSearchCol === 'lxx'}
            onClear={() => clearSearch('lxx')}
          />
        </div>
      </div>
      
      <div className="flex-grow flex-1 relative">
        <div className="absolute inset-0">
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No verses found matching your search.
            </div>
          ) : (
            <Virtuoso
              style={{ height: '100%' }}
              totalCount={filteredData.length}
              itemContent={(index) => {
                const item = filteredData[index];
                return (
                  <div className="flex border-b border-slate-100 hover:bg-indigo-50/50 transition-colors duration-150 py-2">
                    <div className="w-[15%] p-3 text-sm font-medium text-slate-500 flex-shrink-0 flex items-start border-r border-slate-100">
                      {item.index}
                    </div>
                    <div className="w-[21.25%] p-3 text-sm text-slate-800 border-r border-slate-100 break-words">
                      {item.kjv}
                    </div>
                    <div className="w-[21.25%] p-3 text-sm text-slate-800 border-r border-slate-100 break-words">
                      {item.krv}
                    </div>
                    <div className="w-[21.25%] p-3 text-sm text-slate-800 border-r border-slate-100 break-words" dir="rtl">
                      {item.wlc}
                    </div>
                    <div className="w-[21.25%] p-3 text-sm text-slate-800 break-words">
                      {item.lxx}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

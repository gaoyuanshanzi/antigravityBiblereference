import React, { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Search, X, BookOpen } from 'lucide-react';

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
        placeholder="Search..."
        className="block w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
    net: '',
    web: '',
    kjv: '',
    krv: '',
    wlc: '',
    lxx: ''
  });

  const [refSearch, setRefSearch] = useState('');

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
    let result = data;

    // 1. Reference Search
    if (refSearch.trim() !== '') {
      // Split by comma, trim whitespace, and limit to 10 references
      const queries = refSearch.split(',')
                               .map(q => q.toLowerCase().trim())
                               .filter(q => q)
                               .slice(0, 10);
      
      result = result.filter(item => {
        const itemIndexLower = item.index.toLowerCase();
        
        // Match against ANY of the comma-separated queries (OR logic within reference search)
        return queries.some(q => {
          const rangeMatch = q.match(/(.+?)\s*:\s*(\d+)\s*-\s*(\d+)/);
          if (rangeMatch) {
            const baseRef = rangeMatch[1]; 
            const startVerse = parseInt(rangeMatch[2], 10);
            const endVerse = parseInt(rangeMatch[3], 10);
            
            if (!itemIndexLower.startsWith(baseRef + ':')) return false;
            
            const itemVerseStr = itemIndexLower.split(':')[1];
            const itemVerse = parseInt(itemVerseStr, 10);
            return itemVerse >= startVerse && itemVerse <= endVerse;
          }
          
          if (q.includes(':')) {
            // Exact verse match (e.g., "genesis 1:1" avoids matching "1:10")
            if (itemIndexLower === q) return true;
            
            // Allow partial book name (e.g., "gen 1:1" matching "genesis 1:1")
            // Prevent "genesis 1:1" from matching "genesis 10:1" by strictly matching chapter numbers
            const [qBookChap, qVerse] = q.split(':');
            const [iBookChap, iVerse] = itemIndexLower.split(':');
            
            if (iVerse.trim() !== qVerse.trim()) return false;
            
            const qMatch = qBookChap.match(/(.+?)\s+(\d+)$/);
            const iMatch = iBookChap.match(/(.+?)\s+(\d+)$/);
            
            if (qMatch && iMatch) {
              const qBook = qMatch[1].trim();
              const qChap = qMatch[2];
              const iBook = iMatch[1].trim();
              const iChap = iMatch[2];
              
              return iBook.startsWith(qBook) && iChap === qChap;
            }
            return false;
          }
          
          if (/\s\d+$/.test(q)) {
            // Exact chapter match (e.g., "genesis 1" matching "genesis 1:*")
            // Allow partial book like "gen 1" -> iBookChap ("genesis 1")
            const qMatch = q.match(/(.+?)\s+(\d+)$/);
            if (qMatch) {
              const qBook = qMatch[1];
              const qChap = qMatch[2];
              const iMatch = itemIndexLower.match(/(.+?)\s+(\d+):/);
              if (iMatch) {
                return iMatch[1].startsWith(qBook) && iMatch[2] === qChap;
              }
            }
            return itemIndexLower.startsWith(q + ':');
          }

          // Exact book match or partial book (e.g., "genesis" matching "genesis *")
          return itemIndexLower.startsWith(q + ' ') || itemIndexLower.startsWith(q + ':') || itemIndexLower.includes(q);
        });
      });
    }

    // 2. Column AND Search
    const activeTerms = Object.entries(searches).filter(([_, val]) => val.trim() !== '');
    if (activeTerms.length > 0) {
      result = result.filter(row => {
        return activeTerms.every(([col, term]) => {
          const cellValue = row[col] || '';
          return cellValue.toLowerCase().includes(term.toLowerCase());
        });
      });
    }

    return result;
  }, [data, searches, refSearch]);

  useEffect(() => {
    onDataFiltered(filteredData);
  }, [filteredData, onDataFiltered]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Results Count Box */}
      <div className="bg-indigo-50/60 p-2 border-b border-indigo-100 flex items-center justify-center text-indigo-900 font-semibold text-sm shadow-inner">
        <span className="bg-white px-4 py-1.5 rounded-full shadow-sm border border-indigo-200 flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          <span>검색된 성경 구절: <span className="text-indigo-600 text-base">{filteredData.length.toLocaleString()}</span> 개</span>
        </span>
      </div>

      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BookOpen size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            value={refSearch}
            onChange={(e) => setRefSearch(e.target.value)}
            placeholder="Search Reference (e.g., Genesis, John 1, or John 1:1-15)"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
          {refSearch && (
            <button 
              onClick={() => setRefSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 shadow-sm z-10 min-w-max md:min-w-0">
        <div className="w-[10%] flex-shrink-0 bg-slate-100 border-r border-slate-200">
          <div className="p-3 font-semibold text-slate-800 h-full flex items-center justify-center">
            Reference
          </div>
        </div>
        <div className="w-[15%] flex-shrink-0 border-r border-slate-200">
          <ColumnHeader 
            title="NET (English)" 
            searchTerm={searches.net} 
            onSearchChange={(v) => handleSearchChange('net', v)}
            onClear={() => clearSearch('net')}
          />
        </div>
        <div className="w-[15%] flex-shrink-0 border-r border-slate-200">
          <ColumnHeader 
            title="WEB (English)" 
            searchTerm={searches.web} 
            onSearchChange={(v) => handleSearchChange('web', v)}
            onClear={() => clearSearch('web')}
          />
        </div>
        <div className="w-[15%] flex-shrink-0 border-r border-slate-200">
          <ColumnHeader 
            title="KJV (English)" 
            searchTerm={searches.kjv} 
            onSearchChange={(v) => handleSearchChange('kjv', v)}
            onClear={() => clearSearch('kjv')}
          />
        </div>
        <div className="w-[15%] flex-shrink-0 border-r border-slate-200">
          <ColumnHeader 
            title="KRV (Korean)" 
            searchTerm={searches.krv} 
            onSearchChange={(v) => handleSearchChange('krv', v)}
            onClear={() => clearSearch('krv')}
          />
        </div>
        <div className="w-[15%] flex-shrink-0 border-r border-slate-200">
          <ColumnHeader 
            title="WLC/HNT (Hebrew)" 
            searchTerm={searches.wlc} 
            onSearchChange={(v) => handleSearchChange('wlc', v)}
            onClear={() => clearSearch('wlc')}
          />
        </div>
        <div className="w-[15%] flex-shrink-0">
          <ColumnHeader 
            title="LXX/SBLGNT (Greek)" 
            searchTerm={searches.lxx} 
            onSearchChange={(v) => handleSearchChange('lxx', v)}
            onClear={() => clearSearch('lxx')}
          />
        </div>
      </div>
      
      <div className="flex-grow flex-1 relative overflow-x-auto">
        <div className="absolute inset-0 min-w-max md:min-w-0">
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
                    <div className="w-[10%] p-3 text-sm font-medium text-slate-500 flex-shrink-0 flex items-start border-r border-slate-100">
                      {item.index}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 border-r border-slate-100 break-words">
                      {item.net}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 border-r border-slate-100 break-words">
                      {item.web}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 border-r border-slate-100 break-words">
                      {item.kjv}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 border-r border-slate-100 break-words">
                      {item.krv}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 border-r border-slate-100 break-words" dir="rtl">
                      {item.wlc}
                    </div>
                    <div className="w-[15%] p-3 text-sm text-slate-800 flex-shrink-0 break-words">
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

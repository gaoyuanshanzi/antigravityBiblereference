import React, { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Search, X, BookOpen } from 'lucide-react';

const ColumnHeader = ({ title, searchTerm, onSearchChange, isActive, onClear }) => (
  <div className="flex flex-col gap-2 p-3 bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
    <div className="font-semibold text-slate-800 flex justify-between items-center text-xs lg:text-sm">
      <span>{title}</span>
    </div>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
        <Search size={12} className="text-slate-400" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="block w-full pl-7 pr-7 py-1.5 border border-slate-300 rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {searchTerm && (
        <button 
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
        >
          <X size={12} />
        </button>
      )}
    </div>
  </div>
);

const OT_BOOKS = new Set([
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi'
]);

export default function BibleViewer({ data, onDataFiltered }) {
  const [searches, setSearches] = useState({
    net: '',
    web: '',
    kjv: '',
    krv: '',
    cuv: '',
    kougo: '',
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
      const queries = refSearch.split(',')
                               .map(q => q.toLowerCase().trim())
                               .filter(q => q)
                               .slice(0, 10);
      
      result = result.filter(item => {
        const itemIndexLower = item.index.toLowerCase();
        
        return queries.some(q => {
          if (q === 'ot') {
            const lastSpaceIdx = item.index.lastIndexOf(' ');
            if (lastSpaceIdx === -1) return false;
            const bookName = item.index.substring(0, lastSpaceIdx);
            return OT_BOOKS.has(bookName);
          }
          if (q === 'nt') {
            const lastSpaceIdx = item.index.lastIndexOf(' ');
            if (lastSpaceIdx === -1) return false;
            const bookName = item.index.substring(0, lastSpaceIdx);
            return !OT_BOOKS.has(bookName);
          }

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
            if (itemIndexLower === q) return true;
            
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

  // Fixed pixel width per column – keeps header and rows in sync during scroll
  const COL_REF  = 160;
  const COL_TEXT = 200;
  const TOTAL_W  = COL_REF + COL_TEXT * 8; // 1760px

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Results Count Box */}
      <div className="bg-indigo-50/60 p-2 border-b border-indigo-100 flex items-center justify-center text-indigo-900 font-semibold text-sm shadow-inner flex-shrink-0">
        <span className="bg-white px-4 py-1.5 rounded-full shadow-sm border border-indigo-200 flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          <span>검색된 성경 구절: <span className="text-indigo-600 text-base">{filteredData.length.toLocaleString()}</span> 개</span>
        </span>
      </div>

      {/* Reference search bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
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

      {/* Shared horizontal scroll wrapper for header + body */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">

        {/* ── Column Headers ── */}
        <div
          className="flex flex-shrink-0 border-b border-slate-200 shadow-sm z-10 bg-white"
          style={{ width: TOTAL_W }}
        >
          <div style={{ width: COL_REF, minWidth: COL_REF }} className="flex-shrink-0 bg-slate-100 border-r border-slate-200 flex items-center justify-center p-3 font-semibold text-slate-800 text-xs lg:text-sm">
            Reference
          </div>
          {[
            { key: 'net',   title: 'NET (English)' },
            { key: 'web',   title: 'WEB (English)' },
            { key: 'kjv',   title: 'KJV (English)' },
            { key: 'krv',   title: 'KRV (Korean)'  },
            { key: 'cuv',   title: 'CUV (Chinese)'  },
            { key: 'kougo', title: '口語訳 (Japanese)' },
            { key: 'wlc',   title: 'WLC/HNT (Hebrew)' },
            { key: 'lxx',   title: 'LXX/SBLGNT (Greek)' },
          ].map(({ key, title }, i, arr) => (
            <div
              key={key}
              style={{ width: COL_TEXT, minWidth: COL_TEXT }}
              className={`flex-shrink-0${i < arr.length - 1 ? ' border-r border-slate-200' : ''}`}
            >
              <ColumnHeader
                title={title}
                searchTerm={searches[key]}
                onSearchChange={(v) => handleSearchChange(key, v)}
                onClear={() => clearSearch(key)}
              />
            </div>
          ))}
        </div>

        {/* ── Data Rows (virtual scroll) ── */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No verses found matching your search.
            </div>
          ) : (
            <Virtuoso
              style={{ height: '100%', width: TOTAL_W }}
              totalCount={filteredData.length}
              itemContent={(index) => {
                const item = filteredData[index];
                return (
                  <div
                    className="flex border-b border-slate-100 hover:bg-indigo-50/50 transition-colors duration-150 py-2"
                    style={{ width: TOTAL_W }}
                  >
                    <div style={{ width: COL_REF, minWidth: COL_REF }} className="p-2 text-xs lg:text-sm font-medium text-slate-500 flex-shrink-0 flex items-start border-r border-slate-100">
                      {item.index}
                    </div>
                    {[
                      { key: 'net' },
                      { key: 'web' },
                      { key: 'kjv' },
                      { key: 'krv' },
                      { key: 'cuv' },
                      { key: 'kougo' },
                      { key: 'wlc',  dir: 'rtl' },
                      { key: 'lxx' },
                    ].map(({ key, dir }, i, arr) => (
                      <div
                        key={key}
                        dir={dir}
                        style={{ width: COL_TEXT, minWidth: COL_TEXT }}
                        className={`p-2 text-xs lg:text-sm text-slate-800 flex-shrink-0 break-words${i < arr.length - 1 ? ' border-r border-slate-100' : ''}`}
                      >
                        {item[key]}
                      </div>
                    ))}
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

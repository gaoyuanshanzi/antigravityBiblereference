import Papa from 'papaparse';

export const exportToCSV = (data, filename = 'bible_comparison.csv') => {
  // Map data to the desired column format
  const formattedData = data.map(row => ({
    'Index': row.index,
    'KJV (English)': row.kjv,
    'KRV (Korean)': row.krv,
    'WLC (Hebrew)': row.wlc,
    'LXX (Greek)': row.lxx
  }));

  const csv = Papa.unparse(formattedData);
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel Korean support
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

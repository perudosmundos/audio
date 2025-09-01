import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocaleString } from '@/lib/locales';

const FilterAndSearchControls = ({ years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, currentLanguage }) => {
  const navigate = useNavigate();
  return (
    <div className="mb-6 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
        <div className="w-full sm:flex-1">
          <select 
            value={selectedYear || ''} 
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? null : e.target.value)}
            className="w-full bg-slate-700/60 border-slate-600 hover:border-purple-500/70 focus:ring-purple-500 text-white h-9 text-xs sm:text-sm rounded px-3"
          >
            <option value="all">{getLocaleString('allYears', currentLanguage)}</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="w-full sm:flex-1">
          <select 
            value={selectedMonth || ''} 
            onChange={(e) => setSelectedMonth(e.target.value === 'all' ? null : e.target.value)} 
            disabled={!selectedYear}
            className="w-full bg-slate-700/60 border-slate-600 hover:border-purple-500/70 focus:ring-purple-500 text-white h-9 text-xs sm:text-sm rounded px-3 disabled:opacity-50"
          >
            <option value="all">{getLocaleString('allMonths', currentLanguage)}</option>
            {months.map(month => (
              <option key={month.value} value={month.value}>
                {getLocaleString(month.labelKey, currentLanguage)}
              </option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => navigate('/deep-search')} 
          className="w-full sm:w-auto bg-purple-600/10 hover:bg-purple-700/20 border-purple-500/50 text-purple-300 hover:text-purple-200 font-semibold shadow-md hover:shadow-lg transition-all duration-300 h-9 rounded-lg flex items-center justify-center gap-1.5 px-3 text-xs sm:text-sm border"
          title={getLocaleString('navigateToDeepSearch', currentLanguage)}
        >
          <div className="h-3.5 w-3.5">🔍</div>
          <span>{getLocaleString('search', currentLanguage)}</span>
        </button>
      </div>
    </div>
  );
}

export default FilterAndSearchControls;
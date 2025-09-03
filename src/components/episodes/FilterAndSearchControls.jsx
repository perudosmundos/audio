import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import CustomSelect from '@/components/ui/CustomSelect';

const FilterAndSearchControls = ({ years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, currentLanguage }) => {
  const navigate = useNavigate();

  // Подготавливаем опции для годов
  const yearOptions = [
    { value: 'all', label: getLocaleString('allYears', currentLanguage) },
    ...years.map(year => ({ value: year, label: year }))
  ];

  // Подготавливаем опции для месяцев
  const monthOptions = [
    { value: 'all', label: getLocaleString('allMonths', currentLanguage) },
    ...months.map(month => ({ 
      value: month.value, 
      label: getLocaleString(month.labelKey, currentLanguage) 
    }))
  ];

  return (
    <div className="mb-6 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
        <div className="w-full sm:flex-1">
          <CustomSelect
            value={selectedYear || 'all'}
            onChange={(value) => setSelectedYear(value === 'all' ? null : value)}
            options={yearOptions}
            placeholder={getLocaleString('allYears', currentLanguage)}
          />
        </div>
        <div className="w-full sm:flex-1">
          <CustomSelect
            value={selectedMonth || 'all'}
            onChange={(value) => setSelectedMonth(value === 'all' ? null : value)}
            options={monthOptions}
            placeholder={getLocaleString('allMonths', currentLanguage)}
            disabled={!selectedYear}
          />
        </div>
        <button 
          onClick={() => navigate('/deep-search')} 
          className="w-full sm:w-auto bg-purple-600/10 hover:bg-purple-700/20 border-purple-500/50 text-purple-300 hover:text-purple-200 font-semibold shadow-md hover:shadow-lg transition-all duration-300 h-9 rounded-lg flex items-center justify-center gap-1.5 px-3 text-xs sm:text-sm border"
          title={getLocaleString('navigateToDeepSearch', currentLanguage)}
        >
          <Search className="h-3.5 w-3.5" />
          <span>{getLocaleString('search', currentLanguage)}</span>
        </button>
      </div>
    </div>
  );
}

export default FilterAndSearchControls;
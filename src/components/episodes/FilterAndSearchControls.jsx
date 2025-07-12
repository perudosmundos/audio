import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search as SearchIconLucide, CalendarDays } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const FilterAndSearchControls = ({ years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, currentLanguage }) => {
  const navigate = useNavigate();
  return (
    <div className="mb-6 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
        <div className="w-full sm:flex-1">
          <Select value={selectedYear || ''} onValueChange={(value) => setSelectedYear(value === 'all' ? null : value)}>
            <SelectTrigger className="w-full bg-slate-700/60 border-slate-600 hover:border-purple-500/70 focus:ring-purple-500 text-white h-9 text-xs sm:text-sm">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-purple-400 opacity-80" />
              <SelectValue placeholder={getLocaleString('filterByYear', currentLanguage)} />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="all" className="focus:bg-slate-700">{getLocaleString('allYears', currentLanguage)}</SelectItem>
              {years.map(year => <SelectItem key={year} value={year} className="focus:bg-slate-700">{year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:flex-1">
          <Select value={selectedMonth || ''} onValueChange={(value) => setSelectedMonth(value === 'all' ? null : value)} disabled={!selectedYear}>
            <SelectTrigger className="w-full bg-slate-700/60 border-slate-600 hover:border-purple-500/70 focus:ring-purple-500 text-white h-9 text-xs sm:text-sm" disabled={!selectedYear}>
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-purple-400 opacity-80" />
              <SelectValue placeholder={getLocaleString('filterByMonth', currentLanguage)} />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="all" className="focus:bg-slate-700">{getLocaleString('allMonths', currentLanguage)}</SelectItem>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value} className="focus:bg-slate-700">
                  {getLocaleString(month.labelKey, currentLanguage)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={() => navigate('/deep-search')} 
          variant="outline"
          className="w-full sm:w-auto bg-purple-600/10 hover:bg-purple-700/20 border-purple-500/50 text-purple-300 hover:text-purple-200 font-semibold shadow-md hover:shadow-lg transition-all duration-300 h-9 rounded-lg flex items-center justify-center gap-1.5 px-3 text-xs sm:text-sm"
          title={getLocaleString('navigateToDeepSearch', currentLanguage)}
        >
          <SearchIconLucide className="h-3.5 w-3.5" />
          <span>{getLocaleString('search', currentLanguage)}</span>
        </Button>
      </div>
    </div>
  );
};

export default FilterAndSearchControls;
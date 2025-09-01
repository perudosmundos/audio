import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';

const UploadFilters = ({ 
  filesToProcess, 
  onFilterChange, 
  onSortChange, 
  onSearchChange,
  currentLanguage 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    onSearchChange(value);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    onFilterChange({ status: value, language: languageFilter });
  };

  const handleLanguageFilterChange = (value) => {
    setLanguageFilter(value);
    onFilterChange({ status: statusFilter, language: value });
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    onSortChange({ field: value, order: sortOrder });
  };

  const handleSortOrderChange = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange({ field: sortBy, order: newOrder });
  };

  const getStatusCount = (status) => {
    switch (status) {
      case 'all':
        return filesToProcess.length;
      case 'pending':
        return filesToProcess.filter(f => !f.isUploading && !f.uploadComplete && !f.uploadError).length;
      case 'processing':
        return filesToProcess.filter(f => f.isUploading).length;
      case 'completed':
        return filesToProcess.filter(f => f.uploadComplete && !f.uploadError).length;
      case 'error':
        return filesToProcess.filter(f => f.uploadError).length;
      default:
        return 0;
    }
  };

  const getLanguageCount = (lang) => {
    if (lang === 'all') return filesToProcess.length;
    return filesToProcess.filter(f => f.lang === lang).length;
  };

  const getButtonVariant = (currentValue, buttonValue) => {
    return currentValue === buttonValue ? 'default' : 'outline';
  };

  return (
    <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
      <div className="flex flex-col gap-4">
        {/* Поиск */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 bg-slate-600 border-slate-500 text-slate-100"
          />
        </div>

        {/* Фильтры по статусу */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Status Filter</h4>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'error', label: 'Error' }
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={getButtonVariant(statusFilter, value)}
                size="sm"
                onClick={() => handleStatusFilterChange(value)}
                className="text-xs"
              >
                {label} ({getStatusCount(value)})
              </Button>
            ))}
          </div>
        </div>

        {/* Фильтры по языку */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Language Filter</h4>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'es', label: 'Spanish' },
              { value: 'en', label: 'English' },
              { value: 'ru', label: 'Russian' }
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={getButtonVariant(languageFilter, value)}
                size="sm"
                onClick={() => handleLanguageFilterChange(value)}
                className="text-xs"
              >
                {label} ({getLanguageCount(value)})
              </Button>
            ))}
          </div>
        </div>

        {/* Сортировка */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Sort By</h4>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'name', label: 'Name' },
              { value: 'date', label: 'Date' },
              { value: 'status', label: 'Status' },
              { value: 'language', label: 'Language' }
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={getButtonVariant(sortBy, value)}
                size="sm"
                onClick={() => handleSortChange(value)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSortOrderChange}
              className="text-xs"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-3 w-3 mr-1" />
              ) : (
                <SortDesc className="h-3 w-3 mr-1" />
              )}
              {sortOrder === 'asc' ? 'Asc' : 'Desc'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadFilters;

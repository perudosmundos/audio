import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomSelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = '', 
  disabled = false,
  className = '',
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedIndex = options.findIndex(option => option.value === value);
      if (selectedIndex >= 0) {
        setHighlightedIndex(selectedIndex);
        listRef.current.children[selectedIndex]?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [isOpen, value, options]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < options.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : options.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const selectedOption = options.find(option => option.value === value);

  return (
    <div 
      ref={selectRef}
      className={`relative ${className}`}
      {...props}
    >
      {/* Select Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full h-9 px-3 pr-8 text-left text-xs sm:text-sm
          bg-slate-800/50 border border-slate-700/50 rounded-lg
          text-slate-100 hover:border-purple-500/70 focus:border-purple-500/70
          focus:outline-none focus:ring-2 focus:ring-purple-500/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 flex items-center justify-between
          shadow-lg
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selectedOption?.label || placeholder}
      >
        <span className="truncate">
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800/95 border border-slate-700/50 rounded-lg shadow-xl backdrop-blur-sm">
          <ul
            ref={listRef}
            role="listbox"
            className="py-1 max-h-60 overflow-auto"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`
                  px-3 py-2 text-xs sm:text-sm cursor-pointer
                  transition-colors duration-150
                  ${option.value === value 
                    ? 'bg-purple-600/30 text-purple-200' 
                    : highlightedIndex === index
                    ? 'bg-slate-700/50 text-slate-200'
                    : 'text-slate-300 hover:bg-slate-700/30 hover:text-slate-200'
                  }
                  ${index === 0 ? 'rounded-t-lg' : ''}
                  ${index === options.length - 1 ? 'rounded-b-lg' : ''}
                `}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;

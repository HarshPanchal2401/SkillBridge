'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface AutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    icon?: React.ElementType;
    label?: string;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
    value,
    onChange,
    suggestions,
    placeholder,
    icon: Icon,
    label,
}) => {
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        onChange(query);

        if (query.trim()) {
            const filtered = suggestions.filter((s) =>
                s.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
        }
        setSelectedIndex(-1);
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            handleSuggestionClick(filteredSuggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="space-y-1.5 group relative" ref={containerRef}>
            {label && (
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2 group-focus-within:text-green-600 transition-colors">
                    {Icon && <Icon size={12} />}
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (value.trim()) {
                            const filtered = suggestions.filter((s) =>
                                s.toLowerCase().includes(value.toLowerCase())
                            );
                            setFilteredSuggestions(filtered);
                            setShowSuggestions(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:border-green-500 focus:bg-white rounded-xl outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-300"
                    placeholder={placeholder}
                />
                <ChevronDown
                    size={14}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 transition-transform ${showSuggestions ? 'rotate-180' : ''}`}
                />
            </div>

            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredSuggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors ${index === selectedIndex ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => handleSuggestionClick(suggestion)}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

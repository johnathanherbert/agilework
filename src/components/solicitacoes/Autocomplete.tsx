"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchListaTecnica } from "@/lib/dashpesagem-api";

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  sugestoes?: string[];
  ref?: any;
}

export const Autocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(
  ({ label, value, onChange, onKeyPress, className, placeholder, sugestoes }, ref) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || "");
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Carregar medicamentos do arquivo estático se disponível
    useEffect(() => {
      const loadSuggestions = async () => {
        try {
          const response = await fetch("/utils/medicamentos.txt");
          if (response.ok) {
            const data = await response.text();
            const items = data.split("\n").map((item) => item.trim()).filter(Boolean);
            setSuggestions(items);
          }
        } catch (error) {
          console.log("Sugestões locais não carregadas");
        }
      };

      loadSuggestions();
    }, []);

    useEffect(() => {
      setInputValue(value || "");
    }, [value]);

    useEffect(() => {
      if (sugestoes && sugestoes.length > 0) {
        setFilteredSuggestions(sugestoes);
        setIsOpen(true);
      }
    }, [sugestoes]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);

      if (newValue.trim().length >= 2) {
        // Primeiro filtra da lista local
        const filtered = suggestions.filter((item) =>
          item.toLowerCase().includes(newValue.toLowerCase())
        );
        if (filtered.length > 0) {
          setFilteredSuggestions(filtered.slice(0, 10));
          setIsOpen(true);
        } else {
          // Busca sugestões online do dashpesagem
          try {
            const onlineSuggestions = await fetchListaTecnica({ sugestoes: newValue });
            if (Array.isArray(onlineSuggestions) && onlineSuggestions.length > 0) {
              setFilteredSuggestions(onlineSuggestions);
              setIsOpen(true);
            }
          } catch (err) {
            // Silently ignore
          }
        }
      } else {
        setIsOpen(false);
      }
    };

    const handleSuggestionClick = (suggestion: string) => {
      setInputValue(suggestion);
      onChange(suggestion);
      setIsOpen(false);
    };

    return (
      <div ref={wrapperRef} className="relative w-full">
        <div className="relative">
          <input
            ref={ref}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={onKeyPress}
            placeholder={placeholder || label}
            className={`w-full px-3 py-2 bg-white dark:bg-gray-700 
              border border-gray-300 dark:border-gray-600 rounded-lg 
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              text-gray-900 dark:text-white placeholder-gray-400 
              dark:placeholder-gray-400 text-sm transition-colors ${className}`}
          />
          {label && (
            <label className="absolute -top-2 left-2 px-1 text-xs font-medium 
              text-gray-600 dark:text-gray-400 
              bg-white dark:bg-gray-800">
              {label}
            </label>
          )}
        </div>

        {isOpen && filteredSuggestions.length > 0 && (
          <ul
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl 
            max-h-60 overflow-auto divide-y divide-gray-100 dark:divide-gray-700/50"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 cursor-pointer text-xs font-medium text-gray-800 dark:text-gray-200 
                  hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

Autocomplete.displayName = "Autocomplete";
export default Autocomplete;

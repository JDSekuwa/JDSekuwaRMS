"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  required?: boolean;
}

export function SearchableSelect({ value, onChange, options, placeholder, required }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption.label);
    } else {
      setSearch("");
    }
  }, [value, options]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        required={required}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          if (selectedOption && search === selectedOption.label) {
            setSearch("");
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            if (selectedOption) {
              setSearch(selectedOption.label);
            } else {
              setSearch("");
            }
          }, 200);
        }}
        className="w-full rounded-control border border-border pl-3 pr-10 py-2 text-sm text-ink bg-white outline-none focus:border-primary"
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-card border border-border rounded-control shadow-lg py-1 text-xs text-ink bg-white dark:bg-card">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                onMouseDown={() => {
                  onChange(opt.id);
                  setSearch(opt.label);
                  setIsOpen(false);
                }}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-primary/10 transition-colors",
                  opt.id === value && "bg-primary/5 text-primary font-black"
                )}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-ink-muted italic">No items found</div>
          )}
        </div>
      )}
    </div>
  );
}

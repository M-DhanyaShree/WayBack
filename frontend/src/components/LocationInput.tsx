import React, { useState, useRef } from 'react';

interface LocationInputProps {
  label: string;
  value: string;
  onChangeName: (name: string) => void;
  onSelect: (lat: number, lng: number, name: string) => void;
  placeholder?: string;
}

export default function LocationInput({ label, value, onChangeName, onSelect, placeholder }: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number>();

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSuggestions(data);
    } catch (e) {
      console.error('Error fetching locations', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChangeName(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(val);
    }, 500);
  };

  const handleSelect = (s: any) => {
    onChangeName(s.display_name);
    onSelect(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "Type a location..."}
        className="glass-input w-full p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {loading && <div className="absolute right-3 top-9 text-xs text-muted-foreground">Loading...</div>}
      {suggestions.length > 0 && (
        <ul className="absolute z-[200] w-full bg-white/90 backdrop-blur border border-white/50 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSelect(s)}
              className="p-2 border-b last:border-0 hover:bg-muted cursor-pointer text-sm"
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

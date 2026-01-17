import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface ComponentProps {
    label: string;
    onSelect: (name: string | null) => void;
    selectedName: string | null;
    accentColor?: string;
    distance?: string;
}

interface SearchResult {
    id: number;
    name: string;
    gender: string;
}

export default function ParticipantSelector({ label, onSelect, selectedName, accentColor = '#00AEEF', distance }: ComponentProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const highlightedItemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const fetchParticipants = async () => {
            setLoading(true);
            try {
                const url = new URL('http://localhost:8787/api/results');
                url.searchParams.set('name', query);
                if (distance) {
                    url.searchParams.set('distance', distance);
                }
                const response = await fetch(url.toString());
                const data = await response.json();
                if (Array.isArray(data)) {
                    setResults(data);
                    setHighlightedIndex(-1);
                } else {
                    setResults([]);
                }
            } catch (error) {
                console.error("Failed to fetch participants:", error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchParticipants, 300);
        return () => clearTimeout(timeoutId);
    }, [query, distance]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (e.target && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedItemRef.current) {
            highlightedItemRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [highlightedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && results[highlightedIndex]) {
                    onSelect(results[highlightedIndex].name);
                    setIsOpen(false);
                    setQuery('');
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleClear = () => {
        onSelect(null);
        setQuery('');
        setResults([]);
        inputRef.current?.focus();
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Label */}
            <label
                style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '10px',
                    color: accentColor
                }}
            >
                {label}
            </label>

            {/* Input Container */}
            <div className="relative group">
                {/* Selected state - matches input styling */}
                {selectedName ? (
                    <div
                        style={{
                            width: '100%',
                            background: 'white',
                            border: `2px solid ${accentColor}`,
                            borderRadius: '12px',
                            paddingLeft: '14px',
                            paddingRight: '40px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            fontSize: '14px',
                            color: '#1E293B',
                            display: 'flex',
                            alignItems: 'center',
                            position: 'relative',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <span style={{ flex: 1, fontWeight: 500 }}>{selectedName}</span>
                        <button
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94A3B8',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClear();
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault();
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#F1F5F9';
                                e.currentTarget.style.color = '#64748B';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#94A3B8';
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    /* Search input */
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            style={{
                                width: '100%',
                                background: 'white',
                                border: '1px solid #E2E8F0',
                                color: '#1E293B',
                                borderRadius: '12px',
                                paddingLeft: '44px',
                                paddingRight: '40px',
                                paddingTop: '12px',
                                paddingBottom: '12px',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                                outline: 'none',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                            }}
                            placeholder="Search by name..."
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={(e) => {
                                setIsOpen(true);
                                e.target.style.borderColor = accentColor;
                                e.target.style.boxShadow = `0 0 0 3px ${accentColor}20`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#E2E8F0';
                                e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: loading ? accentColor : '#94A3B8',
                                transition: 'color 0.2s'
                            }}
                        />
                        {query && (
                            <button
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#94A3B8',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setQuery('');
                                    setResults([]);
                                    inputRef.current?.focus();
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#F1F5F9';
                                    e.currentTarget.style.color = '#64748B';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#94A3B8';
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}

                {/* Dropdown */}
                {isOpen && results.length > 0 && !selectedName && (
                    <div
                        className="absolute z-50 w-full mt-2 py-2 rounded-xl shadow-lg overflow-hidden animate-fade-in-up"
                        style={{
                            animationDuration: '0.2s',
                            maxHeight: '280px',
                            overflowY: 'auto',
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                    >
                        {results.map((p, index) => (
                            <div
                                key={p.id}
                                ref={highlightedIndex === index ? highlightedItemRef : null}
                                style={{
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    background: highlightedIndex === index ? '#F8FAFC' : 'transparent',
                                    color: highlightedIndex === index ? '#1E293B' : '#64748B',
                                    transition: 'all 0.15s'
                                }}
                                onClick={() => {
                                    onSelect(p.name);
                                    setIsOpen(false);
                                    setQuery('');
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                {p.name}
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {isOpen && query.length >= 2 && results.length === 0 && !loading && !selectedName && (
                    <div
                        className="absolute z-50 w-full mt-2 py-6 px-4 rounded-xl text-center animate-fade-in-up"
                        style={{
                            animationDuration: '0.2s',
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                    >
                        <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '4px' }}>
                            Dalībnieks nav atrasts
                        </p>
                        {distance && (
                            <p style={{ color: '#94A3B8', fontSize: '12px' }}>
                                Varbūt viņš/-a skrēja {distance === 'Tautas' ? 'Sporta' : 'Tautas'} distancē?
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

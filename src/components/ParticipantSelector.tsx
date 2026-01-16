
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface ComponentProps {
    label: string;
    onSelect: (name: string | null) => void;
    selectedName: string | null;
}

interface SearchResult {
    id: number;
    name: string;
    gender: string;
}

export default function ParticipantSelector({ label, onSelect, selectedName }: ComponentProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const fetchParticipants = async () => {
            setLoading(true);
            try {
                // Fetch from Worker API
                const response = await fetch(`http://localhost:8787/api/results?name=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    setResults(data);
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
    }, [query]);

    return (
        <div className="relative w-full">
            <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="Search participant..."
                    value={selectedName || query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (selectedName) onSelect(null); // Clear selection on edit
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                <Search className={`absolute left-3 top-2.5 text-gray-500 w-5 h-5 ${loading ? 'animate-pulse' : ''}`} />

                {selectedName && (
                    <button
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                        onClick={() => {
                            onSelect(null);
                            setQuery('');
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && !selectedName && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {results.map((p) => (
                        <div
                            key={p.id}
                            className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white flex justify-between items-center"
                            onClick={() => {
                                onSelect(p.name);
                                setIsOpen(false);
                            }}
                        >
                            <span>{p.name}</span>
                            <span className="text-xs text-gray-400">{p.gender}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

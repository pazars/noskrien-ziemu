import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import ParticipantSelector from './ParticipantSelector';
import { compareRaces, type HistoryResponse } from '../utils/comparison';

export default function RaceComparison() {
    const [p1Name, setP1Name] = useState<string | null>(null);
    const [p2Name, setP2Name] = useState<string | null>(null);
    const [category, setCategory] = useState<string>('Tautas');
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!p1Name || !p2Name) {
                setChartData([]);
                return;
            }

            setLoading(true);
            try {
                // Fetch full history by NAME for both
                const [hist1, hist2] = await Promise.all([
                    fetch(`http://localhost:8787/api/history?name=${encodeURIComponent(p1Name)}`).then(res => res.json()) as Promise<HistoryResponse>,
                    fetch(`http://localhost:8787/api/history?name=${encodeURIComponent(p2Name)}`).then(res => res.json()) as Promise<HistoryResponse>
                ]);

                // Use shared comparison logic
                const commonRaces = compareRaces(hist1, hist2, category);
                setChartData(commonRaces);

            } catch (error) {
                console.error("Error comparing:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [p1Name, p2Name, category]);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
            padding: '20px',
            boxSizing: 'border-box',
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: 'white',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h1 className="text-2xl font-bold mb-4 text-center shrink-0">Head-to-Head Comparison</h1>

            <div className="flex justify-center mb-4 shrink-0">
                <div className="bg-gray-800 rounded-lg p-1 flex gap-2">
                    {['Tautas', 'Sporta'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`px-4 py-1 rounded-md text-sm transition-colors ${category === c
                                ? 'bg-blue-600 text-white font-medium'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                        >
                            {c} Class
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-4 mb-4 justify-center max-w-4xl mx-auto w-full shrink-0">
                <ParticipantSelector label="Participant 1" onSelect={setP1Name} selectedName={p1Name} />
                <div className="flex items-center pt-6 text-xl font-bold text-gray-500">VS</div>
                <ParticipantSelector label="Participant 2" onSelect={setP2Name} selectedName={p2Name} />
            </div>

            {loading && <div className="text-center shrink-0">Loading comparison data...</div>}

            {!loading && chartData.length > 0 && (
                <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                    <h3 className="text-center mb-2 text-gray-300">
                        Pace Difference (sec/km)
                        <br />
                        <span className="text-sm text-gray-500">Positive: {p1Name} is slower | Negative: {p1Name} is faster</span>
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="date"
                                stroke="#888"
                                angle={-45}
                                textAnchor="end"
                                height={60}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().substr(2)}`;
                                }}
                            />
                            <YAxis stroke="#888" label={{ value: 'Diff (sec/km)', angle: -90, position: 'insideLeft', fill: '#888' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                formatter={(value: any, name: any) => {
                                    if (name === 'diff' && typeof value === 'number') return [`${value.toFixed(1)} s/km`, 'Pace Diff'];
                                    return [value, name];
                                }}
                            />
                            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="diff"
                                stroke="#8884d8"
                                strokeWidth={3}
                                dot={{ r: 6 }}
                                activeDot={{ r: 8 }}
                                name="Pace Difference"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
            {!loading && p1Name && p2Name && chartData.length === 0 && (
                <div className="text-center text-gray-400 mt-10 shrink-0">
                    No common races found between {p1Name} and {p2Name}.
                </div>
            )}
        </div>
    );
}

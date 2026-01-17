import { useEffect, useState, useRef, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import ParticipantSelector from './ParticipantSelector';
import { compareRaces, type HistoryResponse } from '../utils/comparison';
import { Snowflake, Minus, Loader2 } from 'lucide-react';

// High-contrast season colors that rotate
const SEASON_COLOR_PALETTE = [
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#FF9800', // Orange
    '#4CAF50', // Green
    '#9C27B0', // Purple
    '#F44336', // Red
    '#2196F3', // Blue
    '#CDDC39', // Lime
    '#795548', // Brown
];

const getSeasonColor = (season: string, allSeasons: string[] = []) => {
    if (!allSeasons || allSeasons.length === 0) {
        return SEASON_COLOR_PALETTE[0];
    }
    const sortedSeasons = [...allSeasons].sort();
    const index = sortedSeasons.indexOf(season);
    return SEASON_COLOR_PALETTE[index >= 0 ? index % SEASON_COLOR_PALETTE.length : 0];
};


const formatPaceDiff = (diff: number) => {
    const absDiff = Math.abs(Math.round(diff));
    const mins = Math.floor(absDiff / 60);
    const secs = absDiff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Custom tooltip
const CustomTooltip = ({ active, payload, p1Name, p2Name, originalP1Name, originalP2Name, allSeasons }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const diff = data.diff;

    // Determine colors based on which original person each display name corresponds to
    const p1Color = p1Name === originalP1Name ? '#00AEEF' : '#F97316';
    const p2Color = p2Name === originalP2Name ? '#F97316' : '#00AEEF';

    return (
        <div style={{
            background: 'white',
            border: `2px solid ${getSeasonColor(data.season, allSeasons)}`,
            borderRadius: '12px',
            padding: '14px 16px',
            minWidth: '220px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)'
        }}>
            <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: '6px', fontSize: '15px' }}>{data.race}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                {new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}{data.distance} km
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                <span style={{ color: p1Color, fontWeight: 500 }}>{p1Name}</span>
                <span style={{ color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{data.p1Time}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                <span style={{ color: p2Color, fontWeight: 500 }}>{p2Name}</span>
                <span style={{ color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{data.p2Time}</span>
            </div>

            <div style={{
                textAlign: 'center',
                padding: '8px',
                borderRadius: '8px',
                background: diff < 0 ? `rgba(${p1Color === '#00AEEF' ? '0, 174, 239' : '249, 115, 22'}, 0.1)` : diff > 0 ? `rgba(${p2Color === '#F97316' ? '249, 115, 22' : '0, 174, 239'}, 0.1)` : 'rgba(100, 116, 139, 0.1)',
                color: diff < 0 ? p1Color : diff > 0 ? p2Color : '#64748B',
                fontSize: '13px',
                fontWeight: 600
            }}>
                {formatPaceDiff(diff)} /km
            </div>
        </div>
    );
};

// Factory function for custom dot
const createCustomDot = (allSeasons: string[]) => (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;

    return (
        <g>
            <circle
                cx={cx}
                cy={cy}
                r={6}
                fill={getSeasonColor(payload.season, allSeasons)}
                stroke="white"
                strokeWidth={2}
            />
        </g>
    );
};

// Factory function for custom active dot
const createCustomActiveDot = (allSeasons: string[]) => (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;

    return (
        <g>
            <circle
                cx={cx}
                cy={cy}
                r={14}
                fill={getSeasonColor(payload.season, allSeasons)}
                fillOpacity={0.2}
            />
            <circle
                cx={cx}
                cy={cy}
                r={8}
                fill={getSeasonColor(payload.season, allSeasons)}
                stroke="white"
                strokeWidth={3}
            />
        </g>
    );
};

// Animated Toggle Component
const CategoryToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const tautasRef = useRef<HTMLSpanElement>(null);
    const sportaRef = useRef<HTMLSpanElement>(null);
    const [sliderStyle, setSliderStyle] = useState({ left: 4, width: 0 });

    useEffect(() => {
        const activeRef = value === 'Tautas' ? tautasRef : sportaRef;
        if (activeRef.current) {
            setSliderStyle({
                left: activeRef.current.offsetLeft,
                width: activeRef.current.offsetWidth
            });
        }
    }, [value]);

    return (
        <div className="toggle-container">
            <div
                className="toggle-slider"
                style={{
                    left: sliderStyle.left,
                    width: sliderStyle.width
                }}
            />
            <span
                ref={tautasRef}
                className={`toggle-option ${value === 'Tautas' ? 'active' : ''}`}
                onClick={() => onChange('Tautas')}
            >
                Tautas
            </span>
            <span
                ref={sportaRef}
                className={`toggle-option ${value === 'Sporta' ? 'active' : ''}`}
                onClick={() => onChange('Sporta')}
            >
                Sporta
            </span>
        </div>
    );
};

// Plot Mode Toggle Component
const PlotModeToggle = ({ value, onChange }: { value: 'difference' | 'individual'; onChange: (v: 'difference' | 'individual') => void }) => {
    const diffRef = useRef<HTMLSpanElement>(null);
    const indivRef = useRef<HTMLSpanElement>(null);
    const [sliderStyle, setSliderStyle] = useState({ left: 4, width: 0 });

    useEffect(() => {
        const activeRef = value === 'difference' ? diffRef : indivRef;
        if (activeRef.current) {
            setSliderStyle({
                left: activeRef.current.offsetLeft,
                width: activeRef.current.offsetWidth
            });
        }
    }, [value]);

    return (
        <div className="toggle-container" style={{ fontSize: '13px' }}>
            <div
                className="toggle-slider"
                style={{
                    left: sliderStyle.left,
                    width: sliderStyle.width
                }}
            />
            <span
                ref={diffRef}
                className={`toggle-option ${value === 'difference' ? 'active' : ''}`}
                onClick={() => onChange('difference')}
                style={{ padding: '6px 14px' }}
            >
                Starpība
            </span>
            <span
                ref={indivRef}
                className={`toggle-option ${value === 'individual' ? 'active' : ''}`}
                onClick={() => onChange('individual')}
                style={{ padding: '6px 14px' }}
            >
                Temps
            </span>
        </div>
    );
};

// Stats Summary Component
const StatsSummary = ({ p1Name, p2Name, chartData }: { p1Name: string; p2Name: string; chartData: any[] }) => {
    const stats = useMemo(() => {
        const p1Wins = chartData.filter(d => d.diff < 0).length;
        const p2Wins = chartData.filter(d => d.diff > 0).length;
        return { p1Wins, p2Wins };
    }, [chartData]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 0',
            marginBottom: '8px'
        }}>
            {/* P1 side - name then number */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                width: '160px',
                gap: '16px'
            }}>
                <span style={{
                    fontSize: '14px',
                    color: '#00AEEF',
                    fontWeight: 600,
                    textAlign: 'right'
                }}>
                    {p1Name.split(' ')[0]}
                </span>
                <span style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#00AEEF',
                    fontFamily: 'JetBrains Mono, monospace',
                    width: '48px',
                    textAlign: 'center'
                }}>
                    {stats.p1Wins}
                </span>
            </div>

            {/* Center divider */}
            <div style={{
                width: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#94A3B8'
                }}>
                    :
                </span>
            </div>

            {/* P2 side - number then name */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                width: '160px',
                gap: '16px'
            }}>
                <span style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#F97316',
                    fontFamily: 'JetBrains Mono, monospace',
                    width: '48px',
                    textAlign: 'center'
                }}>
                    {stats.p2Wins}
                </span>
                <span style={{
                    fontSize: '14px',
                    color: '#F97316',
                    fontWeight: 600,
                    textAlign: 'left'
                }}>
                    {p2Name.split(' ')[0]}
                </span>
            </div>
        </div>
    );
};

export default function RaceComparison() {
    const [p1Name, setP1Name] = useState<string | null>(null);
    const [p2Name, setP2Name] = useState<string | null>(null);
    const [category, setCategory] = useState<string>('Tautas');
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [plotMode, setPlotMode] = useState<'difference' | 'individual'>('difference');

    // Display names that may be swapped to show faster runner first
    const [displayP1Name, setDisplayP1Name] = useState<string | null>(null);
    const [displayP2Name, setDisplayP2Name] = useState<string | null>(null);

    // Track whether participants were swapped
    const [isSwapped, setIsSwapped] = useState(false);

    // Compute all seasons for color mapping
    const allSeasons = useMemo(() => {
        return [...new Set(chartData.map(d => d.season))].sort();
    }, [chartData]);

    // Compute Y-axis ticks for difference plot (every 15s or 30s depending on range)
    const { differenceTicks, differenceInterval } = useMemo(() => {
        if (chartData.length === 0) return { differenceTicks: undefined, differenceInterval: 15 };
        const maxAbsDiff = Math.max(...chartData.map(d => Math.abs(d.diff)));
        const interval = maxAbsDiff > 150 ? 30 : 15; // Use 30s if any diff > 2:30, otherwise 15s
        const min = Math.min(0, Math.floor(Math.min(...chartData.map(d => d.diff)) / interval) * interval);
        const max = Math.max(0, Math.ceil(Math.max(...chartData.map(d => d.diff)) / interval) * interval);
        const ticks = [];
        for (let i = min; i <= max; i += interval) {
            ticks.push(i);
        }
        return { differenceTicks: ticks, differenceInterval: interval };
    }, [chartData]);

    // Compute Y-axis ticks for individual plot (every 30 seconds, starting at 180)
    const individualTicks = useMemo(() => {
        if (chartData.length === 0) return undefined;
        const min = 180;
        const max = Math.ceil(Math.max(...chartData.map(d => Math.max(d.pace1, d.pace2))) / 30) * 30;
        const ticks = [];
        for (let i = min; i <= max; i += 30) {
            ticks.push(i);
        }
        return ticks;
    }, [chartData]);

    useEffect(() => {
        const fetchData = async () => {
            if (!p1Name || !p2Name) {
                setChartData([]);
                setDisplayP1Name(null);
                setDisplayP2Name(null);
                setIsSwapped(false);
                return;
            }

            setLoading(true);
            try {
                const [hist1, hist2] = await Promise.all([
                    fetch(`/api/history?name=${encodeURIComponent(p1Name)}`).then(res => res.json()) as Promise<HistoryResponse>,
                    fetch(`/api/history?name=${encodeURIComponent(p2Name)}`).then(res => res.json()) as Promise<HistoryResponse>
                ]);

                let commonRaces = compareRaces(hist1, hist2, category);
                let finalP1Name = p1Name;
                let finalP2Name = p2Name;
                let swapped = false;

                // Determine if we should swap runners so the faster one (more wins) has positive y-axis
                if (commonRaces.length > 0) {
                    const p1Wins = commonRaces.filter(r => r.diff < 0).length;
                    const p2Wins = commonRaces.filter(r => r.diff > 0).length;

                    // If p1 has more wins, swap both data and names
                    if (p1Wins > p2Wins) {
                        commonRaces = commonRaces.map(race => ({
                            ...race,
                            pace1: race.pace2,
                            pace2: race.pace1,
                            p1Time: race.p2Time,
                            p2Time: race.p1Time,
                            diff: -race.diff
                        }));
                        // Swap names as well
                        finalP1Name = p2Name;
                        finalP2Name = p1Name;
                        swapped = true;
                    }
                }

                setDisplayP1Name(finalP1Name);
                setDisplayP2Name(finalP2Name);
                setIsSwapped(swapped);
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
            height: '100vh',
            width: '100%',
            maxWidth: '100vw',
            overflow: 'hidden',
            padding: '16px 24px 8px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
        }}>
            {/* Header - logo left, toggle centered */}
            <header style={{
                marginBottom: '8px',
                paddingLeft: '8px',
                paddingRight: '8px',
                paddingTop: '4px',
                flexShrink: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1fr) auto minmax(180px, 1fr)',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <a
                        href="https://noskrienziemu.lv"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'block',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                            borderRadius: '8px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        <img
                            src="/LOGO-NZ-PNG.png"
                            alt="Noskrien Ziemu"
                            style={{ height: '40px', width: 'auto', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
                        />
                    </a>
                </div>
                <CategoryToggle value={category} onChange={setCategory} />
                <div /> {/* Spacer for centering toggle */}
            </header>

            {/* Participant Selection */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
                marginBottom: '4px',
                padding: '0 16px',
                flexShrink: 0
            }}>

                {/* Search inputs row */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '24px',
                    alignItems: 'center'
                }}>
                    <div style={{ flex: 1 }}>
                        <ParticipantSelector
                            label="1. dalībnieks"
                            onSelect={setP1Name}
                            selectedName={p1Name}
                            accentColor="#00AEEF"
                            distance={category}
                        />
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: '24px'
                    }}>
                        <div className="glass" style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>VS</span>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <ParticipantSelector
                            label="2. dalībnieks"
                            onSelect={setP2Name}
                            selectedName={p2Name}
                            accentColor="#F97316"
                            distance={category}
                        />
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: '#64748B'
                    }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading race data...</span>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && (!p1Name || !p2Name) && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(0, 174, 239, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px'
                    }}>
                        <Snowflake style={{ width: '40px', height: '40px', color: '#00AEEF' }} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
                        Rezultātu salīdzinājums
                    </h2>
                    <p style={{ color: '#64748B', maxWidth: '400px' }}>
                        Izvēlies divus dalībniekus, lai salīdzinātu viņu rezultātus
                    </p>
                </div>
            )}

            {/* No Common Races */}
            {!loading && p1Name && p2Name && chartData.length === 0 && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px'
                    }}>
                        <Minus style={{ width: '32px', height: '32px', color: '#94A3B8' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#1E293B', marginBottom: '8px' }}>
                        Nav kopīgu skrējienu
                    </h3>
                    <p style={{ color: '#64748B', maxWidth: '400px' }}>
                        {displayP1Name || p1Name} un {displayP2Name || p2Name} nav piedalījušies kopīgos {category} klases skrējienos.
                    </p>
                </div>
            )}

            {/* Chart */}
            {!loading && chartData.length > 0 && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0
                }}>
                    {/* Stats Summary */}
                    <StatsSummary p1Name={displayP1Name || p1Name!} p2Name={displayP2Name || p2Name!} chartData={chartData} />

                    {/* Plot Mode Toggle - above chart container */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingRight: '8px',
                        marginBottom: '8px'
                    }}>
                        <PlotModeToggle value={plotMode} onChange={setPlotMode} />
                    </div>

                    {/* Chart Container */}
                    <div style={{
                        flex: 1,
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '24px',
                        padding: '8px 12px 12px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                        border: '1px solid rgba(226, 232, 240, 0.5)',
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
                                >
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            {chartData.map((point, i) => {
                                                const percent = (i / (chartData.length - 1)) * 100;
                                                return (
                                                    <stop
                                                        key={i}
                                                        offset={`${percent}%`}
                                                        stopColor={getSeasonColor(point.season, allSeasons)}
                                                    />
                                                );
                                            })}
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E2E8F0"
                                        strokeOpacity={1}
                                        vertical={false}
                                    />

                                    {plotMode === 'difference' && (
                                        <ReferenceLine
                                            y={0}
                                            stroke="#94A3B8"
                                            strokeWidth={1}
                                            strokeDasharray="4 4"
                                        />
                                    )}

                                    <XAxis
                                        dataKey="race"
                                        stroke="#CBD5E1"
                                        tick={{ fill: '#64748B', fontSize: 11 }}
                                        tickLine={{ stroke: '#CBD5E1' }}
                                        axisLine={{ stroke: '#CBD5E1' }}
                                        angle={-30}
                                        textAnchor="end"
                                        height={45}
                                        interval={0}
                                    />

                                    {plotMode === 'difference' ? (
                                        <YAxis
                                            stroke="#CBD5E1"
                                            tick={{ fill: '#64748B', fontSize: 11 }}
                                            tickLine={{ stroke: '#CBD5E1' }}
                                            axisLine={{ stroke: '#CBD5E1' }}
                                            domain={[
                                                (dataMin: number) => Math.min(0, Math.floor(dataMin / differenceInterval) * differenceInterval),
                                                (dataMax: number) => Math.max(0, Math.ceil(dataMax / differenceInterval) * differenceInterval)
                                            ]}
                                            ticks={differenceTicks}
                                            tickFormatter={(val) => {
                                                const absVal = Math.abs(Math.round(val));
                                                const sign = val > 0 ? '+' : val < 0 ? '-' : '';
                                                const mins = Math.floor(absVal / 60);
                                                const secs = absVal % 60;
                                                if (mins > 0) {
                                                    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
                                                }
                                                return `${sign}${secs}`;
                                            }}
                                            label={{
                                                value: 'Tempa starpība',
                                                angle: -90,
                                                position: 'center',
                                                fill: '#64748B',
                                                fontSize: 12,
                                                dx: -20
                                            }}
                                        />
                                    ) : (
                                        <YAxis
                                            stroke="#CBD5E1"
                                            tick={{ fill: '#64748B', fontSize: 11 }}
                                            tickLine={{ stroke: '#CBD5E1' }}
                                            axisLine={{ stroke: '#CBD5E1' }}
                                            domain={[
                                                180, // 3:00 min/km - nobody will average faster than this
                                                (dataMax: number) => Math.ceil(dataMax / 30) * 30
                                            ]}
                                            ticks={individualTicks}
                                            tickFormatter={(val) => {
                                                const mins = Math.floor(val / 60);
                                                const secs = val % 60;
                                                return `${mins}:${secs.toString().padStart(2, '0')}`;
                                            }}
                                            label={{
                                                value: 'Pace /km',
                                                angle: -90,
                                                position: 'center',
                                                fill: '#64748B',
                                                fontSize: 12,
                                                dx: -20
                                            }}
                                        />
                                    )}

                                    <Tooltip
                                        content={<CustomTooltip p1Name={displayP1Name || p1Name!} p2Name={displayP2Name || p2Name!} originalP1Name={p1Name} originalP2Name={p2Name} allSeasons={allSeasons} />}
                                        cursor={{ stroke: '#94A3B8', strokeDasharray: '4 4' }}
                                    />

                                    {plotMode === 'difference' ? (
                                        <Line
                                            type="monotone"
                                            dataKey="diff"
                                            stroke="url(#lineGradient)"
                                            strokeWidth={3}
                                            dot={createCustomDot(allSeasons)}
                                            activeDot={createCustomActiveDot(allSeasons)}
                                        />
                                    ) : (
                                        <>
                                            <Line
                                                type="monotone"
                                                dataKey="pace1"
                                                stroke={isSwapped ? "#F97316" : "#00AEEF"}
                                                strokeWidth={3}
                                                dot={createCustomDot(allSeasons)}
                                                activeDot={createCustomActiveDot(allSeasons)}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="pace2"
                                                stroke={isSwapped ? "#00AEEF" : "#F97316"}
                                                strokeWidth={3}
                                                dot={createCustomDot(allSeasons)}
                                                activeDot={createCustomActiveDot(allSeasons)}
                                            />
                                        </>
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer style={{
                flexShrink: 0,
                textAlign: 'center',
                padding: '8px 0',
                fontSize: '11px',
                color: '#94A3B8',
                fontWeight: 400
            }}>
                Izstrādāja{' '}
                <a
                    href="https://www.instagram.com/pazars"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: '#64748B',
                        textDecoration: 'none',
                        fontWeight: 500,
                        transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#00AEEF'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
                >
                    Dāvis Pazars
                </a>
            </footer>
        </div>
    );
}

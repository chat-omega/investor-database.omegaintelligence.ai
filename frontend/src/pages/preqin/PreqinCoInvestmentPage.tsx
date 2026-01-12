import { useState, useRef, useEffect } from 'react';
import { Network, Search, Loader2 } from 'lucide-react';
import { usePreqinFirms, useFirmNetwork, useCoInvestors, formatAUM } from '@/services/preqinApi';
import type { FirmsParams, PreqinFirm, NetworkNode, NetworkLink } from '@/types/preqin';

export function PreqinCoInvestmentPage() {
  const [searchInput, setSearchInput] = useState('');
  const [selectedFirmId, setSelectedFirmId] = useState<string | undefined>();
  const [selectedFirmName, setSelectedFirmName] = useState<string>('');
  const [maxHops, setMaxHops] = useState(2);
  const [minDeals, setMinDeals] = useState(1);
  const [selectedCoInvestor, setSelectedCoInvestor] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Search for firms
  const [searchParams] = useState<FirmsParams>({ page: 1, page_size: 10 });
  const { data: searchResults, isLoading: searchLoading } = usePreqinFirms(
    searchInput.length >= 2 ? { ...searchParams, search: searchInput } : { page: 1, page_size: 0 }
  );

  // Get network data for selected firm
  const { data: networkData, isLoading: networkLoading } = useFirmNetwork(
    selectedFirmId,
    maxHops,
    minDeals
  );

  // Get co-investors list
  const { data: coInvestorsData } = useCoInvestors(selectedFirmId, minDeals, 50);

  const handleSelectFirm = (firm: PreqinFirm) => {
    setSelectedFirmId(firm.id);
    setSelectedFirmName(firm.name);
    setSearchInput('');
  };

  const handleClearSelection = () => {
    setSelectedFirmId(undefined);
    setSelectedFirmName('');
    setSelectedCoInvestor(null);
  };

  // Simple canvas-based network visualization
  useEffect(() => {
    if (!networkData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    const nodes = networkData.nodes || [];
    const links = networkData.links || [];

    if (nodes.length === 0) return;

    // Calculate positions in a radial layout
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // Group nodes by hop level
    const nodesByHop: Record<number, NetworkNode[]> = {};
    nodes.forEach(node => {
      const hop = node.hop_level || 0;
      if (!nodesByHop[hop]) nodesByHop[hop] = [];
      nodesByHop[hop].push(node);
    });

    // Position nodes in concentric circles
    Object.entries(nodesByHop).forEach(([hopStr, hopNodes]) => {
      const hop = parseInt(hopStr);
      const radius = hop === 0 ? 0 : 100 + hop * 120;
      const angleStep = (2 * Math.PI) / Math.max(hopNodes.length, 1);

      hopNodes.forEach((node, i) => {
        if (hop === 0) {
          nodePositions[node.id] = { x: centerX, y: centerY };
        } else {
          const angle = i * angleStep - Math.PI / 2;
          nodePositions[node.id] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        }
      });
    });

    // Draw links
    links.forEach((link: NetworkLink) => {
      const source = nodePositions[link.source as string];
      const target = nodePositions[link.target as string];
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = `rgba(251, 191, 36, ${Math.min(0.8, 0.2 + (link.deal_count || 1) * 0.1)})`;
      ctx.lineWidth = Math.min(4, 1 + (link.deal_count || 1) * 0.5);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const isCenter = node.hop_level === 0;
      const isSelected = selectedCoInvestor === node.id;
      const baseRadius = isCenter ? 20 : 12;
      const radius = isSelected ? baseRadius + 4 : baseRadius;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);

      if (isCenter) {
        ctx.fillStyle = '#f59e0b';
      } else if (node.firm_type === 'GP') {
        ctx.fillStyle = '#3b82f6';
      } else if (node.firm_type === 'LP') {
        ctx.fillStyle = '#22c55e';
      } else {
        ctx.fillStyle = '#64748b';
      }
      ctx.fill();

      if (isSelected || isCenter) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node label
      ctx.fillStyle = '#fff';
      ctx.font = isCenter ? 'bold 12px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.name.length > 20 ? node.name.substring(0, 20) + '...' : node.name;
      ctx.fillText(label, pos.x, pos.y + radius + 4);
    });

    // Legend
    const legendY = 20;
    const legendItems = [
      { color: '#f59e0b', label: 'Selected Firm' },
      { color: '#3b82f6', label: 'GP' },
      { color: '#22c55e', label: 'LP' },
    ];

    legendItems.forEach((item, i) => {
      const x = 20;
      const y = legendY + i * 25;

      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = item.color;
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + 24, y + 8);
    });

  }, [networkData, selectedCoInvestor]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Co-Investment Network</h1>
              <p className="text-sm text-slate-400">Visualize Firm Relationships</p>
            </div>
          </div>
          {selectedFirmName && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-slate-400">Analyzing</div>
                <div className="text-white font-medium">{selectedFirmName}</div>
              </div>
              <button
                onClick={handleClearSelection}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Search & Co-investors */}
        <div className="w-80 border-r border-slate-700/20 flex flex-col">
          {/* Search Section */}
          <div className="p-4 border-b border-slate-700/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search for a firm..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Search Results */}
            {searchInput.length >= 2 && (
              <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-3 text-center text-slate-400">Searching...</div>
                ) : !searchResults?.items.length ? (
                  <div className="p-3 text-center text-slate-400">No firms found</div>
                ) : (
                  searchResults.items.map((firm) => (
                    <button
                      key={firm.id}
                      onClick={() => handleSelectFirm(firm)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0"
                    >
                      <div className="text-white text-sm font-medium">{firm.name}</div>
                      <div className="text-slate-400 text-xs">
                        {firm.firm_type} | {firm.headquarters_country || 'Unknown'} | {formatAUM(firm.aum_usd)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-slate-700/20 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Max Hops</label>
              <input
                type="range"
                min="1"
                max="3"
                value={maxHops}
                onChange={(e) => setMaxHops(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="text-sm text-white text-center">{maxHops} hop{maxHops > 1 ? 's' : ''}</div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Min Deals Together</label>
              <input
                type="range"
                min="1"
                max="10"
                value={minDeals}
                onChange={(e) => setMinDeals(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="text-sm text-white text-center">{minDeals}+ deals</div>
            </div>
          </div>

          {/* Co-investors List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              Co-Investors ({coInvestorsData?.total_co_investors || 0})
            </h3>
            {!selectedFirmId ? (
              <div className="text-center text-slate-500 py-8">
                Select a firm to see co-investors
              </div>
            ) : !coInvestorsData?.co_investors.length ? (
              <div className="text-center text-slate-500 py-8">
                No co-investors found
              </div>
            ) : (
              <div className="space-y-2">
                {coInvestorsData.co_investors.map((coInvestor) => (
                  <button
                    key={coInvestor.firm_id}
                    onClick={() => setSelectedCoInvestor(
                      selectedCoInvestor === coInvestor.firm_id ? null : coInvestor.firm_id
                    )}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedCoInvestor === coInvestor.firm_id
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-white text-sm font-medium truncate">
                        {coInvestor.firm_name}
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        coInvestor.firm_type === 'GP' ? 'bg-blue-500/20 text-blue-400' :
                        coInvestor.firm_type === 'LP' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {coInvestor.firm_type || '-'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-slate-400">
                      <span>{coInvestor.deal_count} deals</span>
                      {coInvestor.total_value_usd && (
                        <span>{formatAUM(coInvestor.total_value_usd)}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Graph Visualization */}
        <div className="flex-1 relative">
          {!selectedFirmId ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Co-Investment Network</h3>
                <p className="text-slate-400 max-w-md">
                  Search and select a firm to visualize its co-investment network.
                  See which firms have invested together across deals.
                </p>
              </div>
            </div>
          ) : networkLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading network...</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-full"
            />
          )}

          {/* Network Stats Overlay */}
          {networkData && (
            <div className="absolute bottom-4 right-4 bg-slate-800/90 border border-slate-700 rounded-lg p-3 text-sm">
              <div className="text-slate-400">
                <span className="text-white font-medium">{networkData.nodes?.length || 0}</span> firms
                {' | '}
                <span className="text-white font-medium">{networkData.links?.length || 0}</span> connections
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useMemo, useCallback } from 'react';
import { Network, Search, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { Modal } from '@/components/ui/Modal';
import { usePreqinFirms, useFirmNetwork, useCoInvestors, useCoInvestmentDetails, formatAUM, formatDate } from '@/services/preqinApi';
import type { FirmsParams, PreqinFirm } from '@/types/preqin';

interface GraphNode {
  id: string;
  name: string;
  firm_type?: string;
  aum_usd?: number;
  hop_level: number;
  color: string;
  x?: number;  // Added by force-graph at runtime
  y?: number;  // Added by force-graph at runtime
}

interface GraphLink {
  source: string;
  target: string;
  deal_count: number;
  total_value_usd?: number;
}

export function PreqinCoInvestmentPage() {
  const [searchInput, setSearchInput] = useState('');
  const [selectedFirmId, setSelectedFirmId] = useState<string | undefined>();
  const [selectedFirmName, setSelectedFirmName] = useState<string>('');
  const [maxHops, setMaxHops] = useState(2);
  const [minDeals, setMinDeals] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealPartnerFirmId, setDealPartnerFirmId] = useState<string | null>(null);

  const fgRef = useRef<any>();

  // Search for firms
  const [searchParams] = useState<FirmsParams>({ page: 1, page_size: 10 });
  const shouldSearch = searchInput.length >= 2;
  const { data: searchResults, isLoading: searchLoading } = usePreqinFirms(
    { ...searchParams, search: searchInput },
    shouldSearch
  );

  // Get network data for selected firm
  const { data: networkData, isLoading: networkLoading } = useFirmNetwork(
    selectedFirmId,
    maxHops,
    minDeals
  );

  // Get co-investors list
  const { data: coInvestorsData } = useCoInvestors(selectedFirmId, minDeals, 50);

  // Get deal details for modal
  const { data: dealDetails, isLoading: dealsLoading } = useCoInvestmentDetails(
    selectedFirmId,
    dealPartnerFirmId || undefined
  );

  // Transform network data for force graph
  const graphData = useMemo(() => {
    if (!networkData?.nodes || !networkData?.links) {
      return { nodes: [], links: [] };
    }

    const nodes: GraphNode[] = networkData.nodes.map((n: any) => ({
      ...n,
      color: n.hop_level === 0 ? '#f59e0b' :
             n.firm_type === 'GP' ? '#3b82f6' :
             n.firm_type === 'LP' ? '#22c55e' : '#64748b'
    }));

    const links: GraphLink[] = networkData.links.map((l: any) => ({
      ...l
    }));

    return { nodes, links };
  }, [networkData]);

  const handleSelectFirm = (firm: PreqinFirm) => {
    setSelectedFirmId(firm.id);
    setSelectedFirmName(firm.name);
    setSearchInput('');
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  };

  const handleClearSelection = () => {
    setSelectedFirmId(undefined);
    setSelectedFirmName('');
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  };

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);

    if (node) {
      const newHighlightNodes = new Set<string>();
      const newHighlightLinks = new Set<GraphLink>();

      newHighlightNodes.add(node.id);

      graphData.links.forEach((link: GraphLink) => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

        if (sourceId === node.id || targetId === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(sourceId);
          newHighlightNodes.add(targetId);
        }
      });

      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [graphData.links]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Center view on clicked node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(2, 500);
    }
    // Open modal for co-investor nodes (not the selected firm)
    if (node.id !== selectedFirmId) {
      setDealPartnerFirmId(node.id);
      setDealModalOpen(true);
    }
  }, [selectedFirmId]);

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.5, 300);
    }
  };

  const handleFitToView = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4 flex-shrink-0">
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

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Search & Co-investors */}
        <div className="w-80 border-r border-slate-700/20 flex flex-col flex-shrink-0">
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
                    onClick={() => {
                      setDealPartnerFirmId(coInvestor.firm_id);
                      setDealModalOpen(true);
                    }}
                    className="w-full text-left p-3 rounded-lg transition-colors bg-slate-800 hover:bg-slate-700"
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
        <div className="flex-1 relative bg-slate-800/50 min-w-0">
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
            <>
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel={(node: GraphNode) => `${node.name}\n${node.firm_type || 'Unknown'}\n${node.aum_usd ? formatAUM(node.aum_usd) : ''}`}
                nodeColor={(node: GraphNode) =>
                  highlightNodes.size > 0
                    ? (highlightNodes.has(node.id) ? node.color : '#374151')
                    : node.color
                }
                nodeRelSize={8}
                nodeVal={(node: GraphNode) => node.hop_level === 0 ? 3 : 1}
                linkWidth={(link: GraphLink) =>
                  highlightLinks.size > 0
                    ? (highlightLinks.has(link) ? Math.min(5, 1 + link.deal_count * 0.5) : 0.5)
                    : Math.min(4, 1 + link.deal_count * 0.3)
                }
                linkColor={(link: GraphLink) =>
                  highlightLinks.size > 0
                    ? (highlightLinks.has(link) ? 'rgba(251, 191, 36, 0.8)' : 'rgba(100, 116, 139, 0.2)')
                    : 'rgba(251, 191, 36, 0.4)'
                }
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onLinkClick={(link: GraphLink) => {
                  const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                  const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
                  const partnerId = sourceId === selectedFirmId ? targetId : sourceId;
                  setDealPartnerFirmId(partnerId);
                  setDealModalOpen(true);
                }}
                onEngineStop={() => fgRef.current?.zoomToFit(400, 50)}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                backgroundColor="#1e293b"
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={(link: GraphLink) =>
                  highlightLinks.has(link) ? 3 : 0
                }
                cooldownTicks={100}
                warmupTicks={50}
              />

              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <button
                  onClick={handleZoomIn}
                  className="p-2 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={handleFitToView}
                  className="p-2 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  title="Fit to View"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {/* Legend */}
              <div className="absolute top-4 left-4 bg-slate-800/90 border border-slate-700 rounded-lg p-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                    <span className="text-slate-300">Selected Firm</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-slate-300">GP</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-slate-300">LP</span>
                  </div>
                </div>
              </div>

              {/* Hovered Node Info */}
              {hoveredNode && (
                <div className="absolute bottom-20 left-4 bg-slate-800/95 border border-slate-700 rounded-lg p-4 max-w-xs">
                  <h4 className="text-white font-medium mb-1">{hoveredNode.name}</h4>
                  <div className="text-sm text-slate-400 space-y-1">
                    <div>Type: <span className="text-slate-300">{hoveredNode.firm_type || 'Unknown'}</span></div>
                    {hoveredNode.aum_usd && (
                      <div>AUM: <span className="text-slate-300">{formatAUM(hoveredNode.aum_usd)}</span></div>
                    )}
                    <div>Hop Level: <span className="text-slate-300">{hoveredNode.hop_level}</span></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Network Stats Overlay */}
          {networkData && (
            <div className="absolute bottom-4 right-4 bg-slate-800/90 border border-slate-700 rounded-lg p-3 text-sm">
              <div className="text-slate-400">
                <span className="text-white font-medium">{networkData.nodes?.length || 0}</span> firms
                {' | '}
                <span className="text-white font-medium">{networkData.links?.length || 0}</span> connections
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Scroll to zoom | Drag to pan | Click nodes/edges for deals
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deal Details Modal */}
      <Modal
        isOpen={dealModalOpen}
        onClose={() => {
          setDealModalOpen(false);
          setDealPartnerFirmId(null);
        }}
        title={dealDetails ? `Co-Investments: ${selectedFirmName} & ${dealDetails.firm_b_name}` : 'Co-Investment Details'}
        size="xl"
      >
        {dealsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : dealDetails ? (
          <div>
            <div className="mb-4 flex items-center justify-between text-sm text-slate-600">
              <span>{dealDetails.total_deals} deal{dealDetails.total_deals !== 1 ? 's' : ''} together</span>
              {dealDetails.total_value_usd && (
                <span>Total Value: {formatAUM(dealDetails.total_value_usd)}</span>
              )}
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Target Company</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Deal Type</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-700">Date</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-700">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {dealDetails.deals.map((deal) => (
                    <tr key={deal.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900">{deal.target_company_name || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{deal.deal_type || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{formatDate(deal.deal_date)}</td>
                      <td className="py-2 px-3 text-right text-slate-900">{formatAUM(deal.deal_value_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">No deal data available</div>
        )}
      </Modal>
    </div>
  );
}

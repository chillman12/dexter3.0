'use client'

import { LiveOpportunityUpdate } from '../hooks/useWebSocket'

interface ArbitrageOpportunitiesProps {
  opportunities: LiveOpportunityUpdate[]
  isConnected: boolean
}

export default function ArbitrageOpportunities({ opportunities, isConnected }: ArbitrageOpportunitiesProps) {
  const formatProfit = (profit: number) => {
    if (profit >= 1000) {
      return `$${(profit / 1000).toFixed(1)}k`
    }
    return `$${profit.toFixed(0)}`
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-green-400 bg-green-500/20'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'high':
        return 'text-red-400 bg-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const sortedOpportunities = [...opportunities].sort((a, b) => b.profit_percentage - a.profit_percentage)

  return (
    <div className="dexter-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          🎯 Arbitrage Opportunities
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {opportunities.length} active
          </span>
          {opportunities.length > 0 && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
              LIVE
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sortedOpportunities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {isConnected ? 'Scanning for opportunities...' : 'Disconnected - No opportunities available'}
          </div>
        ) : (
          sortedOpportunities.map((opportunity) => (
            <div 
              key={opportunity.id} 
              className="bg-gradient-to-r from-gray-700 to-gray-800 border border-gray-600 rounded-lg p-4 hover:border-blue-500/50 transition-all duration-200"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-white flex items-center">
                    {opportunity.pair}
                    <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {opportunity.exchanges.join(' → ')}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(opportunity.risk_level)}`}>
                  {opportunity.risk_level}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Profit %</p>
                  <p className="text-lg font-bold text-green-400">
                    +{opportunity.profit_percentage.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Est. Profit</p>
                  <p className="text-lg font-bold text-green-400">
                    {formatProfit(opportunity.estimated_profit)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
                  Execute
                </button>
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
                  Analyze
                </button>
                <button className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors">
                  ℹ️
                </button>
              </div>

              {/* Timestamp */}
              <div className="mt-2 pt-2 border-t border-gray-600">
                <p className="text-xs text-gray-400">
                  Detected: {new Date(opportunity.timestamp * 1000).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {opportunities.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm font-semibold text-green-400">
                {opportunities.filter(o => o.profit_percentage > 1).length}
              </p>
              <p className="text-xs text-gray-400">High Profit</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-400">
                {opportunities.filter(o => o.risk_level === 'Low').length}
              </p>
              <p className="text-xs text-gray-400">Low Risk</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-400">
                {Math.max(...opportunities.map(o => o.profit_percentage)).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-400">Best Profit</p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time indicator */}
      {isConnected && (
        <div className="mt-2 text-center">
          <span className="inline-flex items-center text-xs text-green-400">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            Real-time arbitrage scanning active
          </span>
        </div>
      )}
    </div>
  )
}
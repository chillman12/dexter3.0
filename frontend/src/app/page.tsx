'use client'

import { useWebSocket } from './hooks/useWebSocket'
import LivePriceFeed from './components/LivePriceFeed'
import ArbitrageOpportunities from './components/ArbitrageOpportunities'
import MevProtectionMonitor from './components/MevProtectionMonitor'
import FlashLoanSimulator from './components/FlashLoanSimulator'
import MarketDepthChart from './components/MarketDepthChart'
import ConnectionStatus from './components/ConnectionStatus'
import PlatformStats from './components/PlatformStats'

export default function DashboardPage() {
  // Helper function to safely convert to number and apply toFixed
  const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  const {
    isConnected,
    connectionStatus,
    priceUpdates,
    opportunityUpdates,
    mevAlerts,
    marketDepthUpdates,
    connectionStats,
    lastMessage
  } = useWebSocket()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                🚀 DEXTER v3.0
              </h1>
              <span className="text-sm text-gray-400">Advanced DeFi Arbitrage Platform</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <ConnectionStatus 
                isConnected={isConnected}
                status={connectionStatus}
                stats={connectionStats}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Real-time Status Banner */}
        <div className="mb-8 p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold">Live Data Streaming Active</span>
            </div>
            <div className="text-sm text-gray-300">
              {connectionStats.messagesReceived.toLocaleString()} messages received
              {lastMessage && (
                <span className="ml-2">
                  • Last: {new Date(lastMessage.timestamp * 1000).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Row - Platform Stats */}
        <div className="mb-8">
          <PlatformStats />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Price Feeds & Opportunities */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Live Price Feed */}
            <LivePriceFeed 
              priceUpdates={priceUpdates}
              isConnected={isConnected}
            />
            
            {/* Arbitrage Opportunities */}
            <ArbitrageOpportunities 
              opportunities={opportunityUpdates}
              isConnected={isConnected}
            />
          </div>

          {/* Center Column - Charts & Analysis */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Market Depth Chart */}
            <MarketDepthChart 
              pair="SOL/USDC"
            />
            
            {/* Flash Loan Simulator */}
            <FlashLoanSimulator />
          </div>

          {/* Right Column - MEV Protection & Advanced Tools */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* MEV Protection Monitor */}
            <MevProtectionMonitor 
              mevAlerts={mevAlerts}
              isConnected={isConnected}
            />
            
            {/* Real-time Strategy Performance */}
            <div className="dexter-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
                Strategy Performance
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-sm">Arbitrage Detection</span>
                  <span className="text-green-400 font-mono">
                    {opportunityUpdates.length} active
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-sm">MEV Protection</span>
                  <span className="text-blue-400 font-mono">
                    {mevAlerts.length} alerts
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-sm">Flash Loan Sim</span>
                  <span className="text-purple-400 font-mono">Ready</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-sm">Price Feeds</span>
                  <span className="text-yellow-400 font-mono">
                    {priceUpdates.length} streams
                  </span>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="dexter-card">
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">WebSocket</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Data Flow</span>
                  <span className="text-green-400 text-xs">
                    {connectionStats.messagesReceived > 0 ? 'Active' : 'Waiting'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Latency</span>
                  <span className="text-blue-400 text-xs font-mono">~50ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Uptime</span>
                  <span className="text-purple-400 text-xs">99.9%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Extended Analytics */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real-time Log */}
          <div className="dexter-card">
            <h3 className="text-lg font-semibold mb-4">Real-time Activity Log</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...opportunityUpdates.slice(0, 3), ...mevAlerts.slice(0, 2)].map((item, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 bg-gray-700 rounded text-sm">
                  <span className="text-gray-400 font-mono">
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className="text-white">
                    {'profit_percentage' in item 
                      ? `🎯 Arbitrage: ${safeToFixed(item.profit_percentage)}% on ${item.pair}`
                      : `🛡️ MEV Alert: ${item.threat_type} - ${item.risk_level} risk`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="dexter-card">
            <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {opportunityUpdates.filter(o => o.profit_percentage > 1).length}
                </div>
                <div className="text-sm text-gray-400">High-Profit Opps</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {mevAlerts.filter(a => a.risk_level === 'High').length}
                </div>
                <div className="text-sm text-gray-400">High-Risk MEV</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {priceUpdates.length}
                </div>
                <div className="text-sm text-gray-400">Price Streams</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {isConnected ? '100%' : '0%'}
                </div>
                <div className="text-sm text-gray-400">System Health</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
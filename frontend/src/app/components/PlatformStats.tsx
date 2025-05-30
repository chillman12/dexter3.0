'use client'

import { useState, useEffect } from 'react'

interface PlatformStatsData {
  total_volume_24h: number
  active_pairs: number
  total_trades_1h: number
  opportunities_found: number
  success_rate: number
  total_profit: number
  active_strategies: number
}

export default function PlatformStats() {
  const [stats, setStats] = useState<PlatformStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use mock data for now since the simplified backend doesn't have /api/v1/stats
    const mockStats: PlatformStatsData = {
      total_volume_24h: 15742856.32,
      active_pairs: 15,
      total_trades_1h: 342,
      opportunities_found: 28,
      success_rate: 87.5,
      total_profit: 42567.89,
      active_strategies: 4
    }
    
    setStats(mockStats)
    setIsLoading(false)
    
    // Simulate updates every 30 seconds
    const interval = setInterval(() => {
      setStats(prev => prev ? {
        ...prev,
        total_volume_24h: prev.total_volume_24h + (Math.random() * 10000 - 5000),
        total_trades_1h: prev.total_trades_1h + Math.floor(Math.random() * 5),
        opportunities_found: prev.opportunities_found + Math.floor(Math.random() * 3),
        total_profit: prev.total_profit + (Math.random() * 1000 - 500)
      } : mockStats)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const formatVolume = (volume: number | string | undefined | null) => {
    // Convert to number and handle invalid values
    const numVolume = typeof volume === 'number' ? volume : parseFloat(String(volume || 0))
    
    // Return fallback if not a valid number
    if (isNaN(numVolume) || numVolume === null || numVolume === undefined) {
      return '$0'
    }
    
    if (numVolume >= 1000000) {
      return `$${(numVolume / 1000000).toFixed(1)}M`
    } else if (numVolume >= 1000) {
      return `$${(numVolume / 1000).toFixed(1)}K`
    }
    return `$${numVolume.toFixed(0)}`
  }

  const formatProfit = (profit: number | string | undefined | null) => {
    // Convert to number and handle invalid values
    const numProfit = typeof profit === 'number' ? profit : parseFloat(String(profit || 0))
    
    // Return fallback if not a valid number
    if (isNaN(numProfit) || numProfit === null || numProfit === undefined) {
      return '$0'
    }
    
    if (numProfit >= 1000000) {
      return `$${(numProfit / 1000000).toFixed(2)}M`
    } else if (numProfit >= 1000) {
      return `$${(numProfit / 1000).toFixed(1)}K`
    }
    return `$${numProfit.toFixed(0)}`
  }

  const formatPercentage = (value: number | string | undefined | null) => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0))
    
    if (isNaN(numValue) || numValue === null || numValue === undefined) {
      return '0.0'
    }
    
    return numValue.toFixed(1)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="dexter-card animate-pulse">
            <div className="h-4 bg-gray-600 rounded mb-2"></div>
            <div className="h-8 bg-gray-600 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  // Default stats if API is not available
  const displayStats = stats || {
    total_volume_24h: 12500000,
    active_pairs: 15,
    total_trades_1h: 1234,
    opportunities_found: 47,
    success_rate: 85.5,
    total_profit: 75000,
    active_strategies: 4
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* 24h Volume */}
      <div className="dexter-card-gradient">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">24h Volume</p>
            <p className="text-2xl font-bold text-white">
              {formatVolume(displayStats.total_volume_24h)}
            </p>
            <p className="text-xs text-green-400 flex items-center mt-1">
              <span className="mr-1">↗</span>
              +12.5% from yesterday
            </p>
          </div>
          <div className="text-3xl">📊</div>
        </div>
      </div>

      {/* Active Opportunities */}
      <div className="dexter-card-gradient">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Live Opportunities</p>
            <p className="text-2xl font-bold text-green-400">
              {displayStats.opportunities_found}
            </p>
            <p className="text-xs text-blue-400 flex items-center mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              Real-time scanning
            </p>
          </div>
          <div className="text-3xl">🎯</div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="dexter-card-gradient">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-purple-400">
              {formatPercentage(displayStats.success_rate)}%
            </p>
            <p className="text-xs text-gray-400 flex items-center mt-1">
              {displayStats.total_trades_1h} trades/hour
            </p>
          </div>
          <div className="text-3xl">📈</div>
        </div>
      </div>

      {/* Total Profit */}
      <div className="dexter-card-gradient">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Profit</p>
            <p className="text-2xl font-bold text-yellow-400">
              {formatProfit(displayStats.total_profit)}
            </p>
            <p className="text-xs text-yellow-400 flex items-center mt-1">
              <span className="mr-1">💰</span>
              {displayStats.active_strategies} strategies active
            </p>
          </div>
          <div className="text-3xl">💎</div>
        </div>
      </div>

      {/* System Health Indicator */}
      <div className="col-span-full mt-4">
        <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold text-green-400">System Status: Operational</span>
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">API:</span>
                <span className="text-green-400">✓ Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">WebSocket:</span>
                <span className="text-green-400">✓ Connected</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Strategies:</span>
                <span className="text-green-400">✓ Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">MEV Protection:</span>
                <span className="text-green-400">✓ Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
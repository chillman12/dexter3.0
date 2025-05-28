'use client'

import { LiveMevAlert } from '../hooks/useWebSocket'

interface MevProtectionMonitorProps {
  mevAlerts: LiveMevAlert[]
  isConnected: boolean
}

export default function MevProtectionMonitor({ mevAlerts, isConnected }: MevProtectionMonitorProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'high':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'low':
        return 'text-green-400 bg-green-500/20 border-green-500/30'
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getThreatIcon = (threatType: string) => {
    switch (threatType.toLowerCase()) {
      case 'frontrunning':
        return '🏃‍♂️'
      case 'sandwiching':
        return '🥪'
      case 'jit arbitrage':
        return '⚡'
      case 'backrunning':
        return '🔄'
      default:
        return '⚠️'
    }
  }

  const recentAlerts = mevAlerts.slice(0, 5)
  const highRiskAlerts = mevAlerts.filter(alert => alert.risk_level === 'High').length

  return (
    <div className="dexter-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></span>
          🛡️ MEV Protection
        </h3>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded font-medium">
            ACTIVE
          </span>
        </div>
      </div>

      {/* Protection Status */}
      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-blue-400 text-sm font-medium">Protection Status</span>
          <span className="text-green-400 text-sm font-bold">ENABLED</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400">Threats Detected:</span>
            <span className="ml-1 text-white font-mono">{mevAlerts.length}</span>
          </div>
          <div>
            <span className="text-gray-400">High Risk:</span>
            <span className="ml-1 text-red-400 font-mono">{highRiskAlerts}</span>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Threats</h4>
        
        {recentAlerts.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            {isConnected ? 
              <div>
                <div className="text-green-400 mb-2">✅</div>
                <div>No threats detected</div>
                <div className="text-xs mt-1">Protection is working</div>
              </div>
              : 'Disconnected - No monitoring data'
            }
          </div>
        ) : (
          recentAlerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`border rounded-lg p-3 ${getRiskColor(alert.risk_level)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getThreatIcon(alert.threat_type)}</span>
                  <div>
                    <h5 className="font-medium text-white text-sm">{alert.threat_type}</h5>
                    <p className="text-xs opacity-80">{alert.description}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(alert.risk_level)}`}>
                  {alert.risk_level}
                </span>
              </div>

              {/* Affected Tokens */}
              {alert.affected_tokens.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">Affected tokens:</p>
                  <div className="flex flex-wrap gap-1">
                    {alert.affected_tokens.map((token, index) => (
                      <span key={index} className="px-2 py-0.5 bg-gray-700 text-xs rounded">
                        {token}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs opacity-60">
                {new Date(alert.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Protection Settings */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Protection Settings</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Private Mempool</span>
            <span className="text-green-400 text-xs">ON</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Gas Price Limit</span>
            <span className="text-green-400 text-xs">1.5x</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Slippage Protection</span>
            <span className="text-green-400 text-xs">ON</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Real-time Monitoring</span>
            <span className="text-green-400 text-xs flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
          Configure
        </button>
        <button className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
          View Log
        </button>
      </div>

      {/* Real-time status */}
      {isConnected && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center text-xs text-blue-400">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></span>
            Real-time MEV monitoring active
          </span>
        </div>
      )}
    </div>
  )
}
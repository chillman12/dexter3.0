'use client'

import { LivePriceUpdate } from '../hooks/useWebSocket'

interface LivePriceFeedProps {
  priceUpdates: LivePriceUpdate[]
  isConnected: boolean
}

export default function LivePriceFeed({ priceUpdates, isConnected }: LivePriceFeedProps) {
  // Group price updates by pair for better display
  const pricesByPair = priceUpdates.reduce((acc, update) => {
    if (!acc[update.pair]) {
      acc[update.pair] = []
    }
    acc[update.pair].push(update)
    return acc
  }, {} as Record<string, LivePriceUpdate[]>)

  // Get latest price for each pair from each exchange
  const latestPrices = Object.entries(pricesByPair).map(([pair, updates]) => {
    const latestByExchange = updates.reduce((acc, update) => {
      if (!acc[update.exchange] || update.timestamp > acc[update.exchange].timestamp) {
        acc[update.exchange] = update
      }
      return acc
    }, {} as Record<string, LivePriceUpdate>)
    
    return {
      pair,
      exchanges: Object.values(latestByExchange)
    }
  })

  const formatPrice = (price: number) => {
    if (price < 1) {
      return price.toFixed(6)
    } else if (price < 100) {
      return price.toFixed(4)
    } else {
      return price.toFixed(2)
    }
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}%`
  }

  return (
    <div className="dexter-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          Live Price Feed
        </h3>
        <span className="text-xs text-gray-400">
          {priceUpdates.length} streams active
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {latestPrices.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {isConnected ? 'Waiting for price data...' : 'Disconnected - No data available'}
          </div>
        ) : (
          latestPrices.map(({ pair, exchanges }) => (
            <div key={pair} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-white">{pair}</h4>
                <span className="text-xs text-gray-400">
                  {exchanges.length} exchanges
                </span>
              </div>
              
              <div className="space-y-2">
                {exchanges.map((update) => (
                  <div key={`${pair}-${update.exchange}`} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-300">{update.exchange}</span>
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        update.exchange.includes('Binance') || update.exchange.includes('Coinbase') 
                          ? 'bg-blue-500/20 text-blue-300' 
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {update.exchange.includes('Binance') || update.exchange.includes('Coinbase') ? 'CEX' : 'DEX'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-white">
                        ${formatPrice(update.price)}
                      </span>
                      <span className={`text-xs font-mono ${
                        update.change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatChange(update.change_24h)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price spread analysis */}
              {exchanges.length > 1 && (
                <div className="mt-3 pt-2 border-t border-gray-600">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Spread:</span>
                    <span className="text-yellow-400 font-mono">
                      {((Math.max(...exchanges.map(e => e.price)) - Math.min(...exchanges.map(e => e.price))) / Math.min(...exchanges.map(e => e.price)) * 100).toFixed(3)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Live data indicator */}
      {isConnected && priceUpdates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Last update:</span>
            <span className="font-mono">
              {new Date(Math.max(...priceUpdates.map(p => p.timestamp * 1000))).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
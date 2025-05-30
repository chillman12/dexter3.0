'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WebSocketMessage, LivePriceUpdate, LiveOpportunityUpdate, LiveMevAlert, UseWebSocketReturn } from './useWebSocket'

// Mock WebSocket that generates realistic data
export function useMockWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connected')
  const [priceUpdates, setPriceUpdates] = useState<LivePriceUpdate[]>([])
  const [opportunityUpdates, setOpportunityUpdates] = useState<LiveOpportunityUpdate[]>([])
  const [mevAlerts, setMevAlerts] = useState<LiveMevAlert[]>([])
  const [marketDepthUpdates, setMarketDepthUpdates] = useState<any[]>([])
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [connectionStats, setConnectionStats] = useState({
    messagesReceived: 0,
    lastMessageTime: Date.now(),
    reconnectAttempts: 0
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Exchange lists
  const CEX_EXCHANGES = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Gate.io', 'KuCoin', 'Bitfinex', 'Gemini']
  const DEX_EXCHANGES = ['Jupiter', 'Raydium', 'Orca', 'Uniswap V3', 'SushiSwap', 'PancakeSwap', 'Curve', 'Balancer']
  
  const PAIRS = [
    'SOL/USDT', 'ETH/USDT', 'BTC/USDT', 'BNB/USDT', 'XRP/USDT',
    'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
    'UNI/USDT', 'ATOM/USDT'
  ]

  // Base prices for different tokens (current market prices)
  const BASE_PRICES: Record<string, number> = {
    'SOL/USDT': 171.12,
    'ETH/USDT': 3400.00,
    'BTC/USDT': 95000.00,
    'BNB/USDT': 580.50,
    'XRP/USDT': 0.52,
    'ADA/USDT': 0.98,
    'AVAX/USDT': 38.75,
    'DOT/USDT': 7.82,
    'MATIC/USDT': 0.89,
    'LINK/USDT': 14.25,
    'UNI/USDT': 11.45,
    'ATOM/USDT': 10.15
  }

  // Exchange-specific price adjustments (some exchanges consistently higher/lower)
  const EXCHANGE_ADJUSTMENTS: Record<string, number> = {
    // CEX adjustments
    'Binance': 1.0000,      // Reference price
    'Coinbase': 1.0002,     // Usually slightly higher
    'Kraken': 0.9998,       // Usually slightly lower
    'OKX': 1.0001,          // Close to Binance
    'Bybit': 0.9999,        // Slightly lower
    'Gate.io': 1.0003,      // Higher fees = higher prices
    'KuCoin': 1.0001,       // Close to market
    'Bitfinex': 1.0002,     // Premium exchange
    'Gemini': 1.0004,       // US premium
    // DEX adjustments
    'Jupiter': 1.0005,      // Aggregator premium
    'Raydium': 1.0003,      // Popular DEX
    'Orca': 1.0006,         // Higher slippage
    'Uniswap V3': 1.0008,   // ETH-based premium
    'SushiSwap': 1.0007,    // Similar to Uniswap
    'PancakeSwap': 1.0004,  // BSC based
    'Curve': 0.9997,        // Stablecoin focused, tighter spreads
    'Balancer': 1.0005      // Multi-asset pools
  }

  const generatePriceData = useCallback(() => {
    const priceData: Record<string, any[]> = {}
    
    PAIRS.forEach(pair => {
      const basePrice = BASE_PRICES[pair] || 100
      const exchanges: any[] = []
      
      // Generate prices for each exchange with realistic variations
      [...CEX_EXCHANGES, ...DEX_EXCHANGES].forEach(exchange => {
        const exchangeAdjustment = EXCHANGE_ADJUSTMENTS[exchange] || 1.0
        const randomVariation = (Math.random() - 0.5) * 0.002 // ±0.1% random variation
        const price = basePrice * exchangeAdjustment * (1 + randomVariation)
        
        // Different spreads for different exchange types
        let spread: number
        if (exchange === 'Binance' || exchange === 'Coinbase') {
          spread = 0.0005 // 0.05% for top CEXs
        } else if (CEX_EXCHANGES.includes(exchange)) {
          spread = 0.001 // 0.1% for other CEXs
        } else if (exchange === 'Curve') {
          spread = 0.0003 // Tighter spread for stablecoin DEX
        } else {
          spread = 0.003 // 0.3% for most DEXs
        }
        
        const bid = price * (1 - spread)
        const ask = price * (1 + spread)
        
        // Realistic volume and liquidity based on exchange
        let volume24h: number
        let liquidity: number
        
        if (exchange === 'Binance') {
          volume24h = 50000000 + Math.random() * 50000000
          liquidity = 100000000 + Math.random() * 100000000
        } else if (exchange === 'Coinbase' || exchange === 'Kraken') {
          volume24h = 30000000 + Math.random() * 30000000
          liquidity = 80000000 + Math.random() * 50000000
        } else if (CEX_EXCHANGES.includes(exchange)) {
          volume24h = 10000000 + Math.random() * 20000000
          liquidity = 30000000 + Math.random() * 30000000
        } else if (exchange === 'Uniswap V3' || exchange === 'PancakeSwap') {
          volume24h = 20000000 + Math.random() * 30000000
          liquidity = 50000000 + Math.random() * 50000000
        } else {
          volume24h = 5000000 + Math.random() * 15000000
          liquidity = 20000000 + Math.random() * 30000000
        }
        
        exchanges.push({
          exchange,
          type: CEX_EXCHANGES.includes(exchange) ? 'CEX' : 'DEX',
          price: parseFloat(price.toFixed(4)),
          bid: parseFloat(bid.toFixed(4)),
          ask: parseFloat(ask.toFixed(4)),
          volume24h: Math.floor(volume24h),
          liquidity: Math.floor(liquidity),
          lastUpdate: new Date().toISOString()
        })
      })
      
      priceData[pair] = exchanges
    })
    
    return priceData
  }, [])

  const generateArbitrageOpportunities = useCallback((priceData: Record<string, any[]>) => {
    const opportunities: any[] = []
    
    Object.entries(priceData).forEach(([pair, exchanges]) => {
      // Find best buy and sell prices
      let bestBuy = { exchange: '', price: Infinity }
      let bestSell = { exchange: '', price: 0 }
      
      exchanges.forEach(ex => {
        if (ex.ask < bestBuy.price) {
          bestBuy = { exchange: ex.exchange, price: ex.ask }
        }
        if (ex.bid > bestSell.price) {
          bestSell = { exchange: ex.exchange, price: ex.bid }
        }
      })
      
      const profitPercent = ((bestSell.price - bestBuy.price) / bestBuy.price) * 100
      
      if (profitPercent > 0.1) {
        opportunities.push({
          id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pair,
          buyExchange: {
            name: bestBuy.exchange,
            type: CEX_EXCHANGES.includes(bestBuy.exchange) ? 'CEX' : 'DEX',
            price: bestBuy.price,
            liquidity: Math.random() * 1000000,
            fee: 0.001
          },
          sellExchange: {
            name: bestSell.exchange,
            type: CEX_EXCHANGES.includes(bestSell.exchange) ? 'CEX' : 'DEX',
            price: bestSell.price,
            liquidity: Math.random() * 1000000,
            fee: 0.001
          },
          profitPercentage: profitPercent,
          netProfit: profitPercent - 0.2, // Subtract fees
          requiredCapital: 10000,
          confidence: 70 + Math.random() * 30,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          executionPath: [`Buy on ${bestBuy.exchange}`, `Transfer`, `Sell on ${bestSell.exchange}`]
        })
      }
    })
    
    return opportunities
  }, [])

  useEffect(() => {
    // Simulate WebSocket data updates
    const updateData = () => {
      const priceData = generatePriceData()
      
      // Send price update message
      const priceMessage: WebSocketMessage = {
        message_type: 'price_update',
        data: { prices: priceData },
        timestamp: Date.now()
      }
      setLastMessage(priceMessage)
      
      // Generate and send arbitrage opportunities
      const opportunities = generateArbitrageOpportunities(priceData)
      if (opportunities.length > 0) {
        const arbMessage: WebSocketMessage = {
          message_type: 'arbitrage_update',
          data: { opportunities },
          timestamp: Date.now()
        }
        
        // Alternate between price and arbitrage updates
        setTimeout(() => {
          setLastMessage(arbMessage)
        }, 500)
      }
      
      setConnectionStats(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1,
        lastMessageTime: Date.now()
      }))
    }

    // Initial update
    updateData()
    
    // Update every 2 seconds
    intervalRef.current = setInterval(updateData, 2000)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [generatePriceData, generateArbitrageOpportunities])

  const subscribe = useCallback((channels: string[], pairs?: string[]) => {
    console.log('📡 Mock subscribed to channels:', channels)
  }, [])

  const unsubscribe = useCallback((channels: string[]) => {
    console.log('📡 Mock unsubscribed from channels:', channels)
  }, [])

  const sendMessage = useCallback((message: any) => {
    console.log('📤 Mock sent message:', message)
    
    // Simulate execution response
    if (message.type === 'execute_arbitrage' || message.type === 'execute_trade') {
      setTimeout(() => {
        setLastMessage({
          message_type: 'execution_update',
          data: {
            opportunityId: message.data.opportunityId || `trade_${Date.now()}`,
            status: 'completed',
            message: 'Trade executed successfully (simulated)',
            txHash: `0x${Math.random().toString(16).substr(2, 64)}`
          },
          timestamp: Date.now()
        })
      }, 1000)
    }
  }, [])

  return {
    isConnected,
    connectionStatus,
    priceUpdates,
    opportunityUpdates,
    mevAlerts,
    marketDepthUpdates,
    subscribe,
    unsubscribe,
    sendMessage,
    lastMessage,
    connectionStats
  }
}
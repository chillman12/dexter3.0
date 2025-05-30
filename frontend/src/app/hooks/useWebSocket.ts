'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface WebSocketMessage {
  message_type: string
  data: any
  timestamp: number
}

export interface LivePriceUpdate {
  pair: string
  price: number
  change_24h: number
  volume_24h: number
  exchange: string
  timestamp: number
}

export interface LiveOpportunityUpdate {
  id: string
  pair: string
  profit_percentage: number
  estimated_profit: number
  exchanges: string[]
  risk_level: string
  timestamp: number
}

export interface LiveMevAlert {
  id: string
  threat_type: string
  risk_level: string
  description: string
  affected_tokens: string[]
  timestamp: number
}

export interface SubscriptionRequest {
  action: 'subscribe' | 'unsubscribe'
  channels: string[]
  pairs?: string[]
}

export interface UseWebSocketReturn {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  priceUpdates: LivePriceUpdate[]
  opportunityUpdates: LiveOpportunityUpdate[]
  mevAlerts: LiveMevAlert[]
  marketDepthUpdates: any[]
  subscribe: (channels: string[], pairs?: string[]) => void
  unsubscribe: (channels: string[]) => void
  sendMessage: (message: any) => void
  lastMessage: WebSocketMessage | null
  connectionStats: {
    messagesReceived: number
    lastMessageTime: number
    reconnectAttempts: number
  }
}

export function useWebSocket(url: string = 'ws://localhost:3002', useMock: boolean = true): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [priceUpdates, setPriceUpdates] = useState<LivePriceUpdate[]>([])
  const [opportunityUpdates, setOpportunityUpdates] = useState<LiveOpportunityUpdate[]>([])
  const [mevAlerts, setMevAlerts] = useState<LiveMevAlert[]>([])
  const [marketDepthUpdates, setMarketDepthUpdates] = useState<any[]>([])
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [connectionStats, setConnectionStats] = useState({
    messagesReceived: 0,
    lastMessageTime: 0,
    reconnectAttempts: 0
  })

  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const subscriptions = useRef<Set<string>>(new Set())

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    console.log('🔌 Connecting to WebSocket:', url)
    setConnectionStatus('connecting')

    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected successfully')
        setIsConnected(true)
        setConnectionStatus('connected')
        setConnectionStats(prev => ({ ...prev, reconnectAttempts: 0 }))

        // Resubscribe to previous channels
        if (subscriptions.current.size > 0) {
          const subscribeMessage: SubscriptionRequest = {
            action: 'subscribe',
            channels: Array.from(subscriptions.current)
          }
          ws.current?.send(JSON.stringify(subscribeMessage))
        }
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
          setConnectionStats(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastMessageTime: Date.now()
          }))

          // Route messages to appropriate state based on message type
          switch (message.message_type) {
            case 'price_update':
              const priceUpdate = message.data as LivePriceUpdate
              setPriceUpdates(prev => {
                const filtered = prev.filter(p => 
                  !(p.pair === priceUpdate.pair && p.exchange === priceUpdate.exchange)
                )
                return [...filtered, priceUpdate].slice(-100) // Keep last 100 updates
              })
              break

            case 'opportunity_update':
              const opportunityUpdate = message.data as LiveOpportunityUpdate
              setOpportunityUpdates(prev => {
                const filtered = prev.filter(o => o.id !== opportunityUpdate.id)
                return [opportunityUpdate, ...filtered].slice(0, 20) // Keep latest 20
              })
              break

            case 'mev_alert':
              const mevAlert = message.data as LiveMevAlert
              setMevAlerts(prev => [mevAlert, ...prev].slice(0, 10)) // Keep latest 10
              break

            case 'market_depth':
              setMarketDepthUpdates(prev => [message.data, ...prev].slice(0, 5))
              break

            default:
              console.log('📨 Unknown message type:', message.message_type)
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      }

      ws.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus('disconnected')

        // Attempt to reconnect after 3 seconds, but limit attempts
        if (!event.wasClean && connectionStats.reconnectAttempts < 5) {
          setConnectionStats(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }))
          const delay = Math.min(3000 * Math.pow(2, connectionStats.reconnectAttempts), 30000) // Exponential backoff, max 30s
          reconnectTimeout.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (connectionStats.reconnectAttempts >= 5) {
          console.warn('🚫 Max reconnection attempts reached, stopping reconnection')
          setConnectionStatus('error')
        }
      }

      ws.current.onerror = (event) => {
        console.error('❌ WebSocket error occurred')
        setConnectionStatus('error')
        // Don't immediately try to reconnect on error, let onclose handle it
      }

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
    }
    ws.current?.close()
    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  const subscribe = useCallback((channels: string[], pairs?: string[]) => {
    channels.forEach(channel => subscriptions.current.add(channel))
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      const subscribeMessage: SubscriptionRequest = {
        action: 'subscribe',
        channels,
        pairs
      }
      ws.current.send(JSON.stringify(subscribeMessage))
      console.log('📡 Subscribed to channels:', channels)
    }
  }, [])

  const unsubscribe = useCallback((channels: string[]) => {
    channels.forEach(channel => subscriptions.current.delete(channel))
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      const unsubscribeMessage: SubscriptionRequest = {
        action: 'unsubscribe',
        channels
      }
      ws.current.send(JSON.stringify(unsubscribeMessage))
      console.log('📡 Unsubscribed from channels:', channels)
    }
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
      console.log('📤 Sent message:', message)
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Auto-subscribe to default channels on connection
  useEffect(() => {
    if (isConnected) {
      // Subscribe to all data feeds for comprehensive dashboard
      subscribe(['prices', 'opportunities', 'mev', 'depth', 'alpha'])
    }
  }, [isConnected, subscribe])

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
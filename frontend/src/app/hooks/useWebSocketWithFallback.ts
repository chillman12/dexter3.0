'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { useMockWebSocket } from './useMockWebSocket'

export function useWebSocketWithFallback() {
  const [useMock, setUseMock] = useState(false)
  const realWebSocket = useWebSocket('ws://localhost:3002', false)
  const mockWebSocket = useMockWebSocket()
  
  // Switch to mock after connection failures
  useEffect(() => {
    if (realWebSocket.connectionStatus === 'error' || 
        (realWebSocket.connectionStatus === 'disconnected' && realWebSocket.connectionStats.reconnectAttempts >= 3)) {
      console.log('🔄 Switching to mock WebSocket data')
      setUseMock(true)
    }
  }, [realWebSocket.connectionStatus, realWebSocket.connectionStats.reconnectAttempts])
  
  // Return mock or real based on connection status
  return useMock ? mockWebSocket : realWebSocket
}
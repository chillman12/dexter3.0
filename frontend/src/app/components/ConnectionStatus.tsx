'use client'

interface ConnectionStatusProps {
  isConnected: boolean
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  stats: {
    messagesReceived: number
    lastMessageTime: number
    reconnectAttempts: number
  }
}

export default function ConnectionStatus({ isConnected, status, stats }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-400 bg-green-500/20'
      case 'connecting':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'disconnected':
        return 'text-gray-400 bg-gray-500/20'
      case 'error':
        return 'text-red-400 bg-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢'
      case 'connecting':
        return '🟡'
      case 'disconnected':
        return '⚫'
      case 'error':
        return '🔴'
      default:
        return '⚫'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
      case 'error':
        return 'Connection Error'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="flex items-center space-x-4">
      {/* Main Status */}
      <div className="flex items-center space-x-2">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
          {getStatusIcon()} {getStatusText()}
        </span>
      </div>

      {/* Stats */}
      {isConnected && (
        <div className="hidden md:flex items-center space-x-4 text-sm text-gray-400">
          <div className="flex items-center space-x-1">
            <span>📊</span>
            <span>{stats.messagesReceived.toLocaleString()} msgs</span>
          </div>
          
          {stats.lastMessageTime > 0 && (
            <div className="flex items-center space-x-1">
              <span>⏰</span>
              <span>
                {Math.round((Date.now() - stats.lastMessageTime) / 1000)}s ago
              </span>
            </div>
          )}

          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-400 font-medium">LIVE</span>
          </div>
        </div>
      )}

      {/* Reconnect attempts indicator */}
      {status === 'connecting' && stats.reconnectAttempts > 0 && (
        <div className="text-sm text-yellow-400">
          Attempt {stats.reconnectAttempts}
        </div>
      )}
    </div>
  )
}
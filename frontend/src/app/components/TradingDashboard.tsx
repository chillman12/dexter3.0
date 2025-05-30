'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface TradeOrder {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  pnl?: number;
}

interface Portfolio {
  totalValue: number;
  availableBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
}

interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export default function TradingDashboard() {
  const [activeOrders, setActiveOrders] = useState<TradeOrder[]>([]);
  const [completedTrades, setCompletedTrades] = useState<TradeOrder[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    totalValue: 10000,
    availableBalance: 5000,
    positions: [],
    dailyPnL: 125.50,
    totalPnL: 1250.75,
  });
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const { 
    isConnected, 
    lastMessage, 
    sendMessage, 
    priceUpdates,
    opportunityUpdates 
  } = useWebSocket();

  useEffect(() => {
    // Handle incoming WebSocket messages
    if (lastMessage?.message_type === 'trade_update') {
      const trade = lastMessage.data as TradeOrder;
      if (trade.status === 'completed') {
        setActiveOrders(prev => prev.filter(o => o.id !== trade.id));
        setCompletedTrades(prev => [trade, ...prev].slice(0, 50));
      } else {
        setActiveOrders(prev => {
          const index = prev.findIndex(o => o.id === trade.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = trade;
            return updated;
          }
          return [trade, ...prev];
        });
      }
    } else if (lastMessage?.message_type === 'portfolio_update') {
      setPortfolio(lastMessage.data);
    }
  }, [lastMessage]);

  const toggleAutoTrading = () => {
    const newState = !isAutoTrading;
    setIsAutoTrading(newState);
    sendMessage({
      type: 'toggle_auto_trading',
      enabled: newState,
    });
  };

  const executeTrade = (opportunity: any) => {
    sendMessage({
      type: 'execute_trade',
      opportunity,
    });
  };

  const cancelOrder = (orderId: string) => {
    sendMessage({
      type: 'cancel_order',
      orderId,
    });
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Portfolio Overview</h2>
          <button
            onClick={toggleAutoTrading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isAutoTrading
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isAutoTrading ? '🤖 Auto-Trading ON' : '🤖 Auto-Trading OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Total Value</p>
            <p className="text-2xl font-bold text-white">
              ${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Available Balance</p>
            <p className="text-2xl font-bold text-white">
              ${portfolio.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Daily P&L</p>
            <p className={`text-2xl font-bold ${portfolio.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolio.dailyPnL >= 0 ? '+' : ''}${Math.abs(portfolio.dailyPnL).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total P&L</p>
            <p className={`text-2xl font-bold ${portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolio.totalPnL >= 0 ? '+' : ''}${Math.abs(portfolio.totalPnL).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Active Orders */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Active Orders</h3>
        {activeOrders.length === 0 ? (
          <p className="text-gray-400">No active orders</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-2">Pair</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => (
                  <tr key={order.id} className="border-t border-gray-700">
                    <td className="py-2 text-white">{order.pair}</td>
                    <td className={`py-2 ${order.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {order.side.toUpperCase()}
                    </td>
                    <td className="py-2 text-white">{order.amount.toFixed(4)}</td>
                    <td className="py-2 text-white">${order.price.toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.status === 'executing' ? 'bg-yellow-900 text-yellow-300' :
                        order.status === 'pending' ? 'bg-gray-700 text-gray-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Positions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Open Positions</h3>
        {portfolio.positions.length === 0 ? (
          <p className="text-gray-400">No open positions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Entry Price</th>
                  <th className="pb-2">Current Price</th>
                  <th className="pb-2">P&L</th>
                  <th className="pb-2">P&L %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((position, index) => (
                  <tr key={index} className="border-t border-gray-700">
                    <td className="py-2 text-white">{position.symbol}</td>
                    <td className="py-2 text-white">{position.amount.toFixed(4)}</td>
                    <td className="py-2 text-white">${position.entryPrice.toFixed(2)}</td>
                    <td className="py-2 text-white">${position.currentPrice.toFixed(2)}</td>
                    <td className={`py-2 ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}${Math.abs(position.unrealizedPnL).toFixed(2)}
                    </td>
                    <td className={`py-2 ${position.unrealizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
        {completedTrades.length === 0 ? (
          <p className="text-gray-400">No completed trades</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Pair</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {completedTrades.map((trade) => (
                  <tr key={trade.id} className="border-t border-gray-700">
                    <td className="py-2 text-gray-400 text-sm">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 text-white">{trade.pair}</td>
                    <td className={`py-2 ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side.toUpperCase()}
                    </td>
                    <td className="py-2 text-white">{trade.amount.toFixed(4)}</td>
                    <td className="py-2 text-white">${trade.price.toFixed(2)}</td>
                    <td className={`py-2 ${(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}$${Math.abs(trade.pnl).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface AlphaStrategyUpdate {
  strategy_type: string;
  opportunity_id: string;
  action: string;
  details: any;
  profit_estimate: number;
  confidence: number;
  timestamp: number;
}

const STRATEGY_INFO = {
  jit_liquidity: {
    name: 'JIT Liquidity Provider',
    icon: '💧',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  stat_arb: {
    name: 'Statistical Arbitrage',
    icon: '📊',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  liquidity_snipe: {
    name: 'Liquidity Sniper',
    icon: '🎯',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  market_making: {
    name: 'Market Making Bot',
    icon: '📈',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  cross_chain: {
    name: 'Cross-Chain Arbitrage',
    icon: '🌐',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  mev_protection: {
    name: 'MEV Protection',
    icon: '🛡️',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  sandwich_protect: {
    name: 'Sandwich Protector',
    icon: '🥪',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  yield_aggregator: {
    name: 'Yield Aggregator',
    icon: '🌾',
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
  },
  options_trader: {
    name: 'Options Trader',
    icon: '📊',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
};

export default function AlphaStrategies() {
  const [alphaUpdates, setAlphaUpdates] = useState<AlphaStrategyUpdate[]>([]);
  const [strategyStats, setStrategyStats] = useState<Record<string, {
    active: number;
    completed: number;
    totalProfit: number;
  }>>({});
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [executingStrategies, setExecutingStrategies] = useState<Set<string>>(new Set());

  const ws = useWebSocket();

  useEffect(() => {
    // Subscribe to alpha channel
    if (ws.isConnected) {
      ws.subscribe(['alpha']);
    }
  }, [ws.isConnected]);

  useEffect(() => {
    // Handle incoming alpha strategy updates
    if (ws.lastMessage && ws.lastMessage.message_type === 'alpha_strategy_update') {
      const update = ws.lastMessage.data as AlphaStrategyUpdate;
      
      setAlphaUpdates(prev => {
        const newUpdates = [update, ...prev].slice(0, 50); // Keep last 50 updates
        return newUpdates;
      });

      // Update strategy statistics
      setStrategyStats(prev => {
        const stats = { ...prev };
        const type = update.strategy_type;
        
        if (!stats[type]) {
          stats[type] = { active: 0, completed: 0, totalProfit: 0 };
        }

        if (update.action === 'detected') {
          stats[type].active++;
        } else if (update.action === 'completed') {
          stats[type].active = Math.max(0, stats[type].active - 1);
          stats[type].completed++;
          stats[type].totalProfit += update.profit_estimate;
        } else if (update.action === 'failed') {
          stats[type].active = Math.max(0, stats[type].active - 1);
        }

        return stats;
      });
    }
  }, [ws.lastMessage]);

  const executeStrategy = (update: AlphaStrategyUpdate) => {
    setExecutingStrategies(prev => new Set(prev).add(update.opportunity_id));
    
    // Send execution command (you'll need to implement this in your WebSocket)
    ws.sendMessage({
      action: 'execute_alpha_strategy',
      strategy_id: update.opportunity_id,
      strategy_type: update.strategy_type,
    });

    // Simulate execution completion
    setTimeout(() => {
      setExecutingStrategies(prev => {
        const newSet = new Set(prev);
        newSet.delete(update.opportunity_id);
        return newSet;
      });
    }, 3000);
  };

  const formatDetails = (type: string, details: any) => {
    switch (type) {
      case 'stat_arb':
        return `${details.pair1}/${details.pair2} - Spread: ${details.spread.toFixed(4)}`;
      case 'jit_liquidity':
        return `Pool: ${details.pool} - Size: $${details.trade_size.toLocaleString()}`;
      case 'liquidity_snipe':
        return `${details.token} - Initial: $${details.initial_liquidity.toLocaleString()}`;
      case 'market_making':
        return `${details.pair} - Bid/Ask: ${details.bid_spread.toFixed(3)}/${details.ask_spread.toFixed(3)}`;
      case 'cross_chain':
        return `${details.source_chain} → ${details.target_chain} (${details.profit_percentage.toFixed(2)}%)`;
      default:
        return JSON.stringify(details);
    }
  };

  const filteredUpdates = selectedStrategy 
    ? alphaUpdates.filter(u => u.strategy_type === selectedStrategy)
    : alphaUpdates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dexter-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">🎯 Alpha Extraction Strategies</h2>
            <p className="text-gray-400">Advanced Solana DEX/CEX alpha generation strategies</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-400">
              ${Object.values(strategyStats).reduce((sum, stat) => sum + stat.totalProfit, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">Total Alpha Generated</div>
          </div>
        </div>

        {/* Strategy Stats Grid */}
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {Object.entries(STRATEGY_INFO).map(([key, info]) => {
            const stats = strategyStats[key] || { active: 0, completed: 0, totalProfit: 0 };
            const isSelected = selectedStrategy === key;
            
            return (
              <button
                key={key}
                onClick={() => setSelectedStrategy(isSelected ? null : key)}
                className={`${info.bgColor} ${info.borderColor} border rounded-lg p-3 transition-all ${
                  isSelected ? 'ring-2 ring-white/50' : 'hover:scale-105'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{info.icon}</span>
                  {stats.active > 0 && (
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full animate-pulse">
                      {stats.active}
                    </span>
                  )}
                </div>
                <div className={`text-xs font-medium ${info.color}`}>{info.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {stats.completed} done
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Updates Feed */}
      <div className="dexter-card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Live Alpha Updates
          {selectedStrategy && (
            <span className="ml-2 text-sm text-gray-400">
              (Filtered: {STRATEGY_INFO[selectedStrategy]?.name})
            </span>
          )}
        </h3>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredUpdates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Waiting for alpha opportunities...
            </div>
          ) : (
            filteredUpdates.map((update) => {
              const info = STRATEGY_INFO[update.strategy_type] || {
                name: update.strategy_type,
                icon: '🤖',
                color: 'text-gray-400',
                bgColor: 'bg-gray-500/10',
                borderColor: 'border-gray-500/30',
              };
              const isExecuting = executingStrategies.has(update.opportunity_id);

              return (
                <div
                  key={update.opportunity_id}
                  className={`${info.bgColor} ${info.borderColor} border rounded-lg p-4 transition-all hover:scale-[1.01]`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${info.color}`}>
                            {info.name}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            update.action === 'detected' ? 'bg-blue-500/20 text-blue-400' :
                            update.action === 'executing' ? 'bg-yellow-500/20 text-yellow-400' :
                            update.action === 'completed' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {update.action}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {formatDetails(update.strategy_type, update.details)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-green-400">
                            Est. Profit: ${update.profit_estimate.toFixed(2)}
                          </span>
                          <span className="text-blue-400">
                            Confidence: {(update.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="text-gray-500">
                            {new Date(update.timestamp * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {update.action === 'detected' && update.confidence > 0.7 && (
                      <button
                        onClick={() => executeStrategy(update)}
                        disabled={isExecuting}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          isExecuting
                            ? 'bg-yellow-600 animate-pulse cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transform hover:scale-105'
                        } text-white`}
                      >
                        {isExecuting ? 'Executing...' : 'Execute'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Strategy Performance Chart (placeholder) */}
      <div className="dexter-card">
        <h3 className="text-lg font-semibold mb-4">Strategy Performance</h3>
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
          Performance charts coming soon...
        </div>
      </div>
    </div>
  );
}
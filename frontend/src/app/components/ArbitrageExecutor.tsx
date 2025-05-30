'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface ArbitrageOpportunity {
  id: string;
  pair: string;
  buyExchange: {
    name: string;
    type: 'DEX' | 'CEX';
    price: number;
    liquidity: number;
    fee: number;
  };
  sellExchange: {
    name: string;
    type: 'DEX' | 'CEX';
    price: number;
    liquidity: number;
    fee: number;
  };
  profitPercentage: number;
  netProfit: number;
  requiredCapital: number;
  confidence: number;
  expiresAt: string;
  executionPath: string[];
}

interface ExecutionStatus {
  opportunityId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  message: string;
  txHash?: string;
}

export default function ArbitrageExecutor() {
  const { lastMessage, isConnected, sendMessage } = useWebSocket();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [executionStatuses, setExecutionStatuses] = useState<Record<string, ExecutionStatus>>({});
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [autoExecute, setAutoExecute] = useState(false);
  const [minProfitThreshold, setMinProfitThreshold] = useState(0.5);
  const [showOnlyHighConfidence, setShowOnlyHighConfidence] = useState(true);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.message_type === 'arbitrage_update' && lastMessage.data.opportunities) {
      const newOpps = lastMessage.data.opportunities as ArbitrageOpportunity[];
      setOpportunities(newOpps);
      
      // Auto-execute if enabled and meets criteria
      if (autoExecute) {
        newOpps.forEach(opp => {
          if (opp.netProfit >= minProfitThreshold && 
              opp.confidence >= 80 && 
              !executionStatuses[opp.id]) {
            executeArbitrage(opp);
          }
        });
      }
    } else if (lastMessage.message_type === 'execution_update') {
      setExecutionStatuses(prev => ({
        ...prev,
        [lastMessage.data.opportunityId]: lastMessage.data
      }));
    }
  }, [lastMessage, autoExecute, minProfitThreshold, executionStatuses]);

  const executeArbitrage = (opportunity: ArbitrageOpportunity) => {
    // Set pending status
    setExecutionStatuses(prev => ({
      ...prev,
      [opportunity.id]: {
        opportunityId: opportunity.id,
        status: 'pending',
        message: 'Preparing execution...'
      }
    }));

    // Send execution request
    sendMessage({
      type: 'execute_arbitrage',
      data: {
        opportunityId: opportunity.id,
        amount: selectedAmount,
        slippage: 0.5 // 0.5% slippage tolerance
      }
    });
  };

  const cancelExecution = (opportunityId: string) => {
    sendMessage({
      type: 'cancel_execution',
      data: { opportunityId }
    });
    
    setExecutionStatuses(prev => {
      const updated = { ...prev };
      delete updated[opportunityId];
      return updated;
    });
  };

  const getStatusColor = (status: ExecutionStatus['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'executing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-400 bg-green-500/20';
    if (confidence >= 70) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const filteredOpportunities = opportunities.filter(opp => 
    !showOnlyHighConfidence || opp.confidence >= 70
  );

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">
            ⚡ Arbitrage Executor
          </h2>
          <p className="text-gray-400">
            One-click execution for profitable arbitrage opportunities
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Amount:</label>
            <input
              type="number"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="bg-gray-800 text-white rounded px-3 py-1 w-24"
              min="100"
              max="100000"
              step="100"
            />
            <span className="text-gray-400">USDT</span>
          </div>
          
          <button
            onClick={() => setAutoExecute(!autoExecute)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoExecute
                ? 'bg-green-600 text-white animate-pulse'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {autoExecute ? '🤖 Auto ON' : '🤖 Auto OFF'}
          </button>
          
          <button
            onClick={() => setShowOnlyHighConfidence(!showOnlyHighConfidence)}
            className={`px-3 py-2 rounded-lg transition-colors ${
              showOnlyHighConfidence
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            ⭐ High Confidence
          </button>
        </div>
      </div>

      {/* Auto-Execute Settings */}
      {autoExecute && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">⚠️ Auto-execution is active</span>
              <span className="text-sm text-gray-400">
                Min profit: {minProfitThreshold}% | Min confidence: 80%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={minProfitThreshold}
              onChange={(e) => setMinProfitThreshold(Number(e.target.value))}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* Opportunities List */}
      <div className="space-y-4">
        {filteredOpportunities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl">No arbitrage opportunities available</div>
            <div className="text-sm mt-2">Scanning markets for profitable trades...</div>
          </div>
        ) : (
          filteredOpportunities.map((opp) => {
            const status = executionStatuses[opp.id];
            const isExecuting = status && (status.status === 'pending' || status.status === 'executing');
            
            return (
              <div
                key={opp.id}
                className={`bg-gray-800 rounded-lg p-6 border transition-all ${
                  opp.netProfit >= 1 
                    ? 'border-green-500/50 shadow-green-500/20 shadow-lg' 
                    : 'border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{opp.pair}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(opp.confidence)}`}>
                        {opp.confidence}% confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Buy:</span>
                        <span className="text-white font-medium">{opp.buyExchange.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          opp.buyExchange.type === 'DEX' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {opp.buyExchange.type}
                        </span>
                      </div>
                      <span className="text-gray-600">→</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Sell:</span>
                        <span className="text-white font-medium">{opp.sellExchange.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          opp.sellExchange.type === 'DEX' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {opp.sellExchange.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">
                      +{opp.netProfit.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      ${(opp.netProfit * selectedAmount / 100).toFixed(2)} profit
                    </div>
                  </div>
                </div>

                {/* Price Details */}
                <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-gray-400">Buy Price</div>
                    <div className="text-white font-medium">${opp.buyExchange.price.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Sell Price</div>
                    <div className="text-white font-medium">${opp.sellExchange.price.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Total Fees</div>
                    <div className="text-yellow-400 font-medium">
                      {((opp.buyExchange.fee + opp.sellExchange.fee) * 100).toFixed(3)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Expires In</div>
                    <div className="text-orange-400 font-medium">
                      {(() => {
                        const expires = new Date(opp.expiresAt).getTime();
                        const now = Date.now();
                        const seconds = Math.max(0, Math.floor((expires - now) / 1000));
                        return `${seconds}s`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Execution Path */}
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-1">Execution Path:</div>
                  <div className="flex items-center gap-2 text-xs">
                    {opp.executionPath.map((step, index) => (
                      <React.Fragment key={index}>
                        <span className="bg-gray-700 px-2 py-1 rounded">{step}</span>
                        {index < opp.executionPath.length - 1 && <span className="text-gray-600">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!isExecuting ? (
                      <button
                        onClick={() => executeArbitrage(opp)}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all transform hover:scale-105"
                      >
                        ⚡ Execute Trade
                      </button>
                    ) : (
                      <button
                        onClick={() => cancelExecution(opp.id)}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                      >
                        ❌ Cancel
                      </button>
                    )}
                    
                    <button
                      className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      📊 Analyze
                    </button>
                  </div>
                  
                  {status && (
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${getStatusColor(status.status)}`}>
                        {status.status === 'executing' && '⏳ '}
                        {status.message}
                      </span>
                      {status.txHash && (
                        <a
                          href={`https://solscan.io/tx/${status.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View TX →
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Liquidity Warning */}
                {(opp.buyExchange.liquidity < 100000 || opp.sellExchange.liquidity < 100000) && (
                  <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs text-yellow-400">
                    ⚠️ Low liquidity detected. Trade may experience slippage.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {opportunities.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{opportunities.length}</div>
              <div className="text-sm text-gray-400">Active Opportunities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {opportunities.filter(o => o.netProfit >= 1).length}
              </div>
              <div className="text-sm text-gray-400">High Profit (&gt;1%)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {opportunities.filter(o => o.confidence >= 90).length}
              </div>
              <div className="text-sm text-gray-400">High Confidence</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                ${opportunities.reduce((sum, o) => sum + (o.netProfit * selectedAmount / 100), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">Total Potential</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
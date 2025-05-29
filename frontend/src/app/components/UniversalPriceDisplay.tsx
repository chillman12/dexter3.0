'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface ExchangePrice {
  exchange: string;
  type: 'DEX' | 'CEX' | 'Aggregator';
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  fees: {
    maker: number;
    taker: number;
  };
  tradeable: boolean;
  lastUpdate: string;
}

interface ArbitrageOpportunity {
  id: string;
  pair: string;
  buyExchange: {
    name: string;
    type: string;
    price: number;
    liquidity: number;
    fee: number;
  };
  sellExchange: {
    name: string;
    type: string;
    price: number;
    liquidity: number;
    fee: number;
  };
  profitPercentage: number;
  netProfit: number;
  requiredCapital: number;
  totalFees: number;
  executionPath: string[];
  confidence: number;
  expiresAt: string;
}

export default function UniversalPriceDisplay() {
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [prices, setPrices] = useState<{ [key: string]: ExchangePrice[] }>({});
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'DEX' | 'CEX'>('ALL');
  const { lastMessage, isConnected } = useWebSocket();

  // Available trading pairs
  const tradingPairs = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'XRP/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'DOT/USDT',
    'MATIC/USDT',
    'LINK/USDT',
    'UNI/USDT',
    'ATOM/USDT',
  ];

  useEffect(() => {
    if (lastMessage?.message_type === 'price_update') {
      setPrices(lastMessage.data.prices || {});
    } else if (lastMessage?.message_type === 'arbitrage_update') {
      setOpportunities(lastMessage.data.opportunities || []);
    }
  }, [lastMessage]);

  // Filter prices based on selected exchange type
  const filteredPrices = prices[selectedPair]?.filter(price => 
    filter === 'ALL' || price.type === filter
  ) || [];

  // Sort by best price (lowest ask for buying)
  const sortedPrices = [...filteredPrices].sort((a, b) => a.ask - b.ask);

  // Calculate spread analysis
  const spreadAnalysis = () => {
    if (sortedPrices.length < 2) return null;
    
    const minAsk = Math.min(...sortedPrices.map(p => p.ask));
    const maxBid = Math.max(...sortedPrices.map(p => p.bid));
    const potential = maxBid > minAsk ? ((maxBid - minAsk) / minAsk * 100).toFixed(2) : 0;
    
    return {
      minAsk,
      maxBid,
      potential,
      minAskExchange: sortedPrices.find(p => p.ask === minAsk)?.exchange,
      maxBidExchange: sortedPrices.find(p => p.bid === maxBid)?.exchange,
    };
  };

  const analysis = spreadAnalysis();

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Universal Exchange Price Tracker
            </h2>
            <p className="text-gray-400">
              Real-time prices from {Object.keys(prices).length} pairs across DEX & CEX
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Pair Selector */}
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tradingPairs.map(pair => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
            
            {/* Exchange Type Filter */}
            <div className="flex bg-gray-700 rounded-lg">
              {['ALL', 'DEX', 'CEX'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type as any)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filter === type 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            
            {/* Connection Status */}
            <div className={`px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Arbitrage Alert */}
      {analysis && analysis.potential > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                💰 Arbitrage Opportunity Detected!
              </h3>
              <p className="text-gray-300">
                Buy on <span className="text-green-400 font-semibold">{analysis.minAskExchange}</span> at ${analysis.minAsk.toFixed(2)}
                {' → '}
                Sell on <span className="text-blue-400 font-semibold">{analysis.maxBidExchange}</span> at ${analysis.maxBid.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">
                +{analysis.potential}%
              </div>
              <div className="text-sm text-gray-400">Gross Profit</div>
            </div>
          </div>
        </div>
      )}

      {/* Price Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Exchange
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Bid
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ask
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Spread
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  24h Volume
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Liquidity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Fees
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedPrices.map((price, index) => (
                <tr key={`${price.exchange}-${index}`} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-white">
                        {price.exchange}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      price.type === 'DEX' 
                        ? 'bg-purple-500/20 text-purple-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {price.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-white">
                      ${price.bid.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-white">
                      ${price.ask.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-400">
                      ${price.spread.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({((price.spread / price.price) * 100).toFixed(3)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-400">
                      ${(price.volume24h / 1000000).toFixed(2)}M
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-400">
                      ${(price.liquidity / 1000000).toFixed(2)}M
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-xs text-gray-400">
                      <div>M: {(price.fees.maker * 100).toFixed(2)}%</div>
                      <div>T: {(price.fees.taker * 100).toFixed(2)}%</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                      price.tradeable 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {price.tradeable ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Arbitrage Opportunities */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          🎯 Live Arbitrage Opportunities
        </h3>
        <div className="space-y-3">
          {opportunities.slice(0, 5).map(opp => (
            <div key={opp.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-white">{opp.pair}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    opp.confidence > 80 
                      ? 'bg-green-500/20 text-green-400' 
                      : opp.confidence > 60 
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {opp.confidence.toFixed(0)}% confidence
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">
                    +{opp.netProfit.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-400">Net Profit</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Buy on {opp.buyExchange.name}</div>
                  <div className="text-white">${opp.buyExchange.price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Sell on {opp.sellExchange.name}</div>
                  <div className="text-white">${opp.sellExchange.price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Required Capital</div>
                  <div className="text-white">${opp.requiredCapital.toFixed(2)}</div>
                </div>
              </div>
              
              <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">
                Execute Trade
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface ExchangePrice {
  exchange: string;
  type: 'DEX' | 'CEX';
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  liquidity: number;
  lastUpdate: string;
}

interface ArbitrageOpportunity {
  id: string;
  pair: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  netProfit: number;
  requiredCapital: number;
  confidence: number;
  expiresAt: string;
}

interface PriceAnalysis {
  pair: string;
  lowestAsk: { exchange: string; price: number; type: string };
  highestBid: { exchange: string; price: number; type: string };
  spread: number;
  arbitrageExists: boolean;
  potentialProfit: number;
}

export default function LiveArbitrageWidget() {
  const { lastMessage, isConnected } = useWebSocket();
  const [pricesByPair, setPricesByPair] = useState<Record<string, ExchangePrice[]>>({});
  const [liveOpportunities, setLiveOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [priceAnalysis, setPriceAnalysis] = useState<PriceAnalysis[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('SOL/USDT');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Process incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.message_type === 'price_update' && lastMessage.data.prices) {
      setPricesByPair(lastMessage.data.prices);
      setLastUpdate(new Date());
      
      // Analyze prices for arbitrage opportunities
      analyzePrices(lastMessage.data.prices);
    } else if (lastMessage.message_type === 'arbitrage_update' && lastMessage.data.opportunities) {
      setLiveOpportunities(lastMessage.data.opportunities);
    }
  }, [lastMessage]);

  // Analyze prices across exchanges
  const analyzePrices = (prices: Record<string, ExchangePrice[]>) => {
    const analysis: PriceAnalysis[] = [];

    Object.entries(prices).forEach(([pair, exchangePrices]) => {
      if (exchangePrices.length < 2) return;

      // Find lowest ask and highest bid
      let lowestAsk = { exchange: '', price: Infinity, type: '' };
      let highestBid = { exchange: '', price: 0, type: '' };

      exchangePrices.forEach((ep) => {
        if (ep.ask < lowestAsk.price) {
          lowestAsk = { exchange: ep.exchange, price: ep.ask, type: ep.type };
        }
        if (ep.bid > highestBid.price) {
          highestBid = { exchange: ep.exchange, price: ep.bid, type: ep.type };
        }
      });

      const spread = highestBid.price - lowestAsk.price;
      const arbitrageExists = spread > 0;
      const potentialProfit = arbitrageExists ? (spread / lowestAsk.price) * 100 : 0;

      analysis.push({
        pair,
        lowestAsk,
        highestBid,
        spread: Math.abs(spread),
        arbitrageExists,
        potentialProfit,
      });
    });

    // Sort by profit potential
    analysis.sort((a, b) => b.potentialProfit - a.potentialProfit);
    setPriceAnalysis(analysis);
  };

  // Get all unique pairs
  const allPairs = Object.keys(pricesByPair);

  // Get prices for selected pair
  const selectedPairPrices = pricesByPair[selectedPair] || [];

  // Calculate statistics
  const stats = {
    totalExchanges: selectedPairPrices.length,
    dexCount: selectedPairPrices.filter(p => p.type === 'DEX').length,
    cexCount: selectedPairPrices.filter(p => p.type === 'CEX').length,
    avgPrice: selectedPairPrices.reduce((sum, p) => sum + p.price, 0) / (selectedPairPrices.length || 1),
    totalVolume: selectedPairPrices.reduce((sum, p) => sum + p.volume24h, 0),
    totalLiquidity: selectedPairPrices.reduce((sum, p) => sum + p.liquidity, 0),
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎯 Live Arbitrage Analysis Widget
          </h2>
          <p className="text-gray-400 text-sm">
            Real-time price comparison across all CEX & DEX platforms
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸️ Paused'}
          </button>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </div>
        </div>
      </div>

      {/* Top Arbitrage Opportunities */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">
          💰 Top Arbitrage Opportunities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {priceAnalysis.slice(0, 4).map((analysis) => (
            <div
              key={analysis.pair}
              className={`p-4 rounded-lg border ${
                analysis.arbitrageExists
                  ? 'bg-green-500/10 border-green-500/50'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-white">{analysis.pair}</span>
                {analysis.arbitrageExists && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                    +{analysis.potentialProfit.toFixed(3)}%
                  </span>
                )}
              </div>
              
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Buy:</span>
                  <span className="text-white">
                    {analysis.lowestAsk.exchange} (${analysis.lowestAsk.price.toFixed(4)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sell:</span>
                  <span className="text-white">
                    {analysis.highestBid.exchange} (${analysis.highestBid.price.toFixed(4)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Spread:</span>
                  <span className={analysis.arbitrageExists ? 'text-green-400' : 'text-gray-400'}>
                    ${analysis.spread.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pair Selector and Live Prices */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            📊 Live Price Comparison
          </h3>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allPairs.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {/* Price Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {selectedPairPrices
            .sort((a, b) => a.ask - b.ask)
            .map((price, index) => (
            <div
              key={`${price.exchange}-${index}`}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{price.exchange}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    price.type === 'DEX' 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {price.type}
                  </span>
                </div>
                <span className="text-lg font-bold text-white">
                  ${price.price.toFixed(4)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Bid:</span>
                  <span className="text-green-400 ml-2">${price.bid.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Ask:</span>
                  <span className="text-red-400 ml-2">${price.ask.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">24h Vol:</span>
                  <span className="text-gray-300 ml-2">${(price.volume24h / 1000000).toFixed(2)}M</span>
                </div>
                <div>
                  <span className="text-gray-400">Liquidity:</span>
                  <span className="text-gray-300 ml-2">${(price.liquidity / 1000000).toFixed(2)}M</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-white font-semibold mb-3">📈 Market Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <div className="text-gray-400 text-xs">Total Exchanges</div>
            <div className="text-white font-semibold">{stats.totalExchanges}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">DEX Count</div>
            <div className="text-purple-400 font-semibold">{stats.dexCount}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">CEX Count</div>
            <div className="text-blue-400 font-semibold">{stats.cexCount}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Avg Price</div>
            <div className="text-white font-semibold">${stats.avgPrice.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">24h Volume</div>
            <div className="text-white font-semibold">${(stats.totalVolume / 1000000).toFixed(2)}M</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Total Liquidity</div>
            <div className="text-white font-semibold">${(stats.totalLiquidity / 1000000).toFixed(2)}M</div>
          </div>
        </div>
      </div>

      {/* Live Opportunities List */}
      {liveOpportunities.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            🚨 Live Executable Arbitrage
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {liveOpportunities.slice(0, 5).map((opp) => (
              <div
                key={opp.id}
                className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white">{opp.pair}</span>
                    <span className="text-sm text-gray-400 ml-2">
                      {opp.buyExchange} → {opp.sellExchange}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">
                      +{opp.netProfit.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-400">
                      ${opp.requiredCapital.toFixed(0)} capital
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-400">
                    Buy: ${opp.buyPrice.toFixed(4)} | Sell: ${opp.sellPrice.toFixed(4)}
                  </span>
                  <span className={`text-xs ${opp.confidence > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {opp.confidence.toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Last update: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}
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
  spread: number;
  spreadPercent: number;
}

interface TokenPrices {
  [token: string]: {
    [exchange: string]: ExchangePrice;
  };
}

interface ArbitrageAlert {
  token: string;
  buyExchange: string;
  sellExchange: string;
  profit: number;
  profitPercent: number;
  requiredCapital: number;
}

export default function ExchangePriceTicker() {
  const { lastMessage, isConnected, sendMessage } = useWebSocket();
  const [tokenPrices, setTokenPrices] = useState<TokenPrices>({});
  const [selectedToken, setSelectedToken] = useState<string>('SOL/USDT');
  const [arbitrageAlerts, setArbitrageAlerts] = useState<ArbitrageAlert[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showOnlyProfitable, setShowOnlyProfitable] = useState(false);

  // Define exchanges we track
  const CEX_EXCHANGES = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Gate.io', 'KuCoin', 'Huobi', 'Bitfinex', 'Gemini'];
  const DEX_EXCHANGES = ['Jupiter', 'Raydium', 'Orca', 'Uniswap V3', 'SushiSwap', 'PancakeSwap', 'QuickSwap', 'Curve', 'Balancer'];

  // Popular trading pairs
  const TRADING_PAIRS = [
    'SOL/USDT', 'ETH/USDT', 'BTC/USDT', 'BNB/USDT', 'XRP/USDT',
    'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
    'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT', 'APT/USDT'
  ];

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.message_type === 'price_update' && lastMessage.data.prices) {
      // Process incoming price data
      const newPrices: TokenPrices = {};
      
      Object.entries(lastMessage.data.prices).forEach(([pair, exchanges]: [string, any]) => {
        newPrices[pair] = {};
        
        exchanges.forEach((priceData: any) => {
          const spread = priceData.ask - priceData.bid;
          const spreadPercent = (spread / priceData.price) * 100;
          
          newPrices[pair][priceData.exchange] = {
            ...priceData,
            spread,
            spreadPercent
          };
        });
      });
      
      setTokenPrices(newPrices);
      
      // Calculate arbitrage opportunities
      calculateArbitrage(newPrices);
    }
  }, [lastMessage]);

  const calculateArbitrage = (prices: TokenPrices) => {
    const alerts: ArbitrageAlert[] = [];
    
    Object.entries(prices).forEach(([token, exchanges]) => {
      const exchangeList = Object.entries(exchanges);
      
      // Find best buy (lowest ask) and sell (highest bid) prices
      let bestBuy = { exchange: '', price: Infinity };
      let bestSell = { exchange: '', price: 0 };
      
      exchangeList.forEach(([exchange, data]) => {
        if (data.ask < bestBuy.price) {
          bestBuy = { exchange, price: data.ask };
        }
        if (data.bid > bestSell.price) {
          bestSell = { exchange, price: data.bid };
        }
      });
      
      // Calculate profit
      if (bestSell.price > bestBuy.price) {
        const profit = bestSell.price - bestBuy.price;
        const profitPercent = (profit / bestBuy.price) * 100;
        
        if (profitPercent > 0.1) { // Only show if profit > 0.1%
          alerts.push({
            token,
            buyExchange: bestBuy.exchange,
            sellExchange: bestSell.exchange,
            profit,
            profitPercent,
            requiredCapital: 10000 // $10k default
          });
        }
      }
    });
    
    // Sort by profit percentage
    alerts.sort((a, b) => b.profitPercent - a.profitPercent);
    setArbitrageAlerts(alerts.slice(0, 10)); // Keep top 10
  };

  const executeTrade = (alert: ArbitrageAlert) => {
    sendMessage({
      type: 'execute_arbitrage',
      data: {
        pair: alert.token,
        buyExchange: alert.buyExchange,
        sellExchange: alert.sellExchange,
        amount: alert.requiredCapital
      }
    });
  };

  const getPriceColor = (exchange: string, price: number, type: 'bid' | 'ask') => {
    const prices = tokenPrices[selectedToken];
    if (!prices) return '';
    
    const allPrices = Object.values(prices).map(p => type === 'bid' ? p.bid : p.ask);
    const isBest = type === 'bid' 
      ? price === Math.max(...allPrices)
      : price === Math.min(...allPrices);
    
    return isBest ? (type === 'bid' ? 'text-green-400' : 'text-red-400') : 'text-gray-300';
  };

  const selectedTokenPrices = tokenPrices[selectedToken] || {};
  const sortedExchanges = Object.entries(selectedTokenPrices)
    .sort((a, b) => a[1].ask - b[1].ask);

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            💹 Live Exchange Price Ticker
          </h2>
          <p className="text-gray-400 text-sm">
            Real-time prices from {CEX_EXCHANGES.length + DEX_EXCHANGES.length} exchanges
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TRADING_PAIRS.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
          
          <button
            onClick={() => setShowOnlyProfitable(!showOnlyProfitable)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              showOnlyProfitable 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            💰 Profitable Only
          </button>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </div>
        </div>
      </div>

      {/* Top Arbitrage Alerts */}
      {arbitrageAlerts.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            🚨 Live Arbitrage Opportunities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arbitrageAlerts.slice(0, 4).map((alert, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-white">{alert.token}</div>
                  <div className="text-sm text-gray-400">
                    Buy: {alert.buyExchange} → Sell: {alert.sellExchange}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">+{alert.profitPercent.toFixed(3)}%</div>
                  <button
                    onClick={() => executeTrade(alert)}
                    className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CEX Prices */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            CEX Prices
          </h3>
          <div className="space-y-2">
            {sortedExchanges
              .filter(([_, data]) => data.type === 'CEX')
              .map(([exchange, data]) => (
                <div key={exchange} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white">{exchange}</span>
                    <span className="text-lg font-bold text-white">${data.price.toFixed(4)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Bid: </span>
                      <span className={getPriceColor(exchange, data.bid, 'bid')}>
                        ${data.bid.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Ask: </span>
                      <span className={getPriceColor(exchange, data.ask, 'ask')}>
                        ${data.ask.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Spread: </span>
                      <span className="text-yellow-400">{data.spreadPercent.toFixed(3)}%</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Vol: ${(data.volume24h / 1000000).toFixed(2)}M | Liq: ${(data.liquidity / 1000000).toFixed(2)}M
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* DEX Prices */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
            DEX Prices
          </h3>
          <div className="space-y-2">
            {sortedExchanges
              .filter(([_, data]) => data.type === 'DEX')
              .map(([exchange, data]) => (
                <div key={exchange} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white">{exchange}</span>
                    <span className="text-lg font-bold text-white">${data.price.toFixed(4)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Bid: </span>
                      <span className={getPriceColor(exchange, data.bid, 'bid')}>
                        ${data.bid.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Ask: </span>
                      <span className={getPriceColor(exchange, data.ask, 'ask')}>
                        ${data.ask.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Spread: </span>
                      <span className="text-yellow-400">{data.spreadPercent.toFixed(3)}%</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Vol: ${(data.volume24h / 1000000).toFixed(2)}M | Liq: ${(data.liquidity / 1000000).toFixed(2)}M
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-gray-400 text-sm">Avg Price</div>
            <div className="text-xl font-bold text-white">
              ${(Object.values(selectedTokenPrices).reduce((sum, p) => sum + p.price, 0) / (Object.keys(selectedTokenPrices).length || 1)).toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Best Bid</div>
            <div className="text-xl font-bold text-green-400">
              ${Math.max(...Object.values(selectedTokenPrices).map(p => p.bid), 0).toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Best Ask</div>
            <div className="text-xl font-bold text-red-400">
              ${Math.min(...Object.values(selectedTokenPrices).map(p => p.ask), Infinity).toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Max Spread</div>
            <div className="text-xl font-bold text-yellow-400">
              {(() => {
                const bids = Object.values(selectedTokenPrices).map(p => p.bid);
                const asks = Object.values(selectedTokenPrices).map(p => p.ask);
                const maxBid = Math.max(...bids, 0);
                const minAsk = Math.min(...asks, Infinity);
                return maxBid > minAsk ? `+${((maxBid - minAsk) / minAsk * 100).toFixed(3)}%` : '0%';
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
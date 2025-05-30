'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ExchangePrice {
  exchange: string;
  type: 'DEX' | 'CEX';
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  liquidity: number;
  lastUpdate: number;
}

interface CoinData {
  symbol: string;
  name: string;
  icon: string;
  prices: Record<string, ExchangePrice>;
  bestBuy: { exchange: string; price: number };
  bestSell: { exchange: string; price: number };
  spread: number;
  spreadPercent: number;
  arbitrageProfit: number;
  avgPrice: number;
  priceChange24h: number;
}

interface ArbitrageOpportunity {
  id: string;
  coin: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
  confidence: number;
  liquidity: number;
  estimatedGas: number;
  netProfit: number;
}

export default function ProTradingDashboard() {
  const [coinsData, setCoinsData] = useState<Record<string, CoinData>>({});
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(10000);
  const [executingTrades, setExecutingTrades] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'profitable' | 'executable'>('profitable');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Professional coin list with current market data
  const COINS = [
    { symbol: 'SOL', name: 'Solana', icon: '☀️', basePrice: 171.12 },
    { symbol: 'ETH', name: 'Ethereum', icon: '💎', basePrice: 3400.00 },
    { symbol: 'BTC', name: 'Bitcoin', icon: '₿', basePrice: 95000.00 },
    { symbol: 'BNB', name: 'BNB', icon: '🔶', basePrice: 580.50 },
    { symbol: 'XRP', name: 'Ripple', icon: '💧', basePrice: 0.5248 },
    { symbol: 'ADA', name: 'Cardano', icon: '🔷', basePrice: 0.9823 },
    { symbol: 'AVAX', name: 'Avalanche', icon: '🏔️', basePrice: 38.75 },
    { symbol: 'DOT', name: 'Polkadot', icon: '⚪', basePrice: 7.82 },
    { symbol: 'MATIC', name: 'Polygon', icon: '🟣', basePrice: 0.8912 },
    { symbol: 'LINK', name: 'Chainlink', icon: '🔗', basePrice: 14.25 },
    { symbol: 'UNI', name: 'Uniswap', icon: '🦄', basePrice: 11.45 },
    { symbol: 'ATOM', name: 'Cosmos', icon: '⚛️', basePrice: 10.15 }
  ];

  const EXCHANGES = {
    CEX: ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Gate.io', 'KuCoin', 'Bitfinex', 'Gemini'],
    DEX: ['Jupiter', 'Raydium', 'Orca', 'Uniswap V3', 'SushiSwap', 'PancakeSwap', 'Curve', 'Balancer']
  };

  // Exchange-specific pricing characteristics
  const EXCHANGE_CHARACTERISTICS: Record<string, { baseSpread: number; priceAdjust: number; liquidity: number }> = {
    // CEX
    'Binance': { baseSpread: 0.0005, priceAdjust: 1.0000, liquidity: 100000000 },
    'Coinbase': { baseSpread: 0.0006, priceAdjust: 1.0002, liquidity: 80000000 },
    'Kraken': { baseSpread: 0.0007, priceAdjust: 0.9998, liquidity: 60000000 },
    'OKX': { baseSpread: 0.0006, priceAdjust: 1.0001, liquidity: 70000000 },
    'Bybit': { baseSpread: 0.0008, priceAdjust: 0.9999, liquidity: 50000000 },
    'Gate.io': { baseSpread: 0.0010, priceAdjust: 1.0003, liquidity: 40000000 },
    'KuCoin': { baseSpread: 0.0009, priceAdjust: 1.0001, liquidity: 45000000 },
    'Bitfinex': { baseSpread: 0.0007, priceAdjust: 1.0002, liquidity: 55000000 },
    'Gemini': { baseSpread: 0.0008, priceAdjust: 1.0004, liquidity: 35000000 },
    // DEX
    'Jupiter': { baseSpread: 0.0025, priceAdjust: 1.0005, liquidity: 30000000 },
    'Raydium': { baseSpread: 0.0030, priceAdjust: 1.0003, liquidity: 25000000 },
    'Orca': { baseSpread: 0.0035, priceAdjust: 1.0006, liquidity: 20000000 },
    'Uniswap V3': { baseSpread: 0.0020, priceAdjust: 1.0008, liquidity: 50000000 },
    'SushiSwap': { baseSpread: 0.0028, priceAdjust: 1.0007, liquidity: 35000000 },
    'PancakeSwap': { baseSpread: 0.0025, priceAdjust: 1.0004, liquidity: 40000000 },
    'Curve': { baseSpread: 0.0003, priceAdjust: 0.9997, liquidity: 60000000 },
    'Balancer': { baseSpread: 0.0022, priceAdjust: 1.0005, liquidity: 30000000 }
  };

  // Generate realistic market data
  const generateMarketData = () => {
    const newCoinsData: Record<string, CoinData> = {};
    const newOpportunities: ArbitrageOpportunity[] = [];

    COINS.forEach(coin => {
      const prices: Record<string, ExchangePrice> = {};
      let minAsk = Infinity;
      let maxBid = 0;
      let minAskExchange = '';
      let maxBidExchange = '';
      let priceSum = 0;
      let priceCount = 0;

      // Generate prices for each exchange
      [...EXCHANGES.CEX, ...EXCHANGES.DEX].forEach(exchange => {
        const chars = EXCHANGE_CHARACTERISTICS[exchange];
        const marketVolatility = 0.002; // 0.2% volatility
        const randomFactor = 1 + (Math.random() - 0.5) * marketVolatility;
        
        const basePrice = coin.basePrice * chars.priceAdjust * randomFactor;
        const spread = chars.baseSpread * (1 + Math.random() * 0.5); // Variable spread
        
        const bid = basePrice * (1 - spread);
        const ask = basePrice * (1 + spread);
        const volume = chars.liquidity * (0.5 + Math.random() * 0.5) * (coin.basePrice < 10 ? 10 : 1);

        prices[exchange] = {
          exchange,
          type: EXCHANGES.CEX.includes(exchange) ? 'CEX' : 'DEX',
          price: basePrice,
          bid,
          ask,
          volume24h: volume,
          liquidity: chars.liquidity * (0.7 + Math.random() * 0.3),
          lastUpdate: Date.now()
        };

        priceSum += basePrice;
        priceCount++;

        if (ask < minAsk) {
          minAsk = ask;
          minAskExchange = exchange;
        }
        if (bid > maxBid) {
          maxBid = bid;
          maxBidExchange = exchange;
        }
      });

      const avgPrice = priceSum / priceCount;
      const spread = maxBid - minAsk;
      const spreadPercent = spread > 0 ? (spread / minAsk) * 100 : 0;
      const arbitrageProfit = spreadPercent - 0.2; // Subtract estimated fees

      newCoinsData[coin.symbol] = {
        symbol: coin.symbol,
        name: coin.name,
        icon: coin.icon,
        prices,
        bestBuy: { exchange: minAskExchange, price: minAsk },
        bestSell: { exchange: maxBidExchange, price: maxBid },
        spread,
        spreadPercent,
        arbitrageProfit,
        avgPrice,
        priceChange24h: (Math.random() - 0.5) * 10 // -5% to +5%
      };

      // Create arbitrage opportunity if profitable
      if (arbitrageProfit > 0.1) {
        const buyLiquidity = prices[minAskExchange].liquidity;
        const sellLiquidity = prices[maxBidExchange].liquidity;
        const minLiquidity = Math.min(buyLiquidity, sellLiquidity);
        const confidence = Math.min(95, 50 + (arbitrageProfit * 10) + (minLiquidity / 1000000));
        
        newOpportunities.push({
          id: `${coin.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          coin: coin.symbol,
          buyExchange: minAskExchange,
          sellExchange: maxBidExchange,
          buyPrice: minAsk,
          sellPrice: maxBid,
          profit: spread * (tradeAmount / minAsk),
          profitPercent: arbitrageProfit,
          confidence,
          liquidity: minLiquidity,
          estimatedGas: 0.05, // $0.05 gas estimate
          netProfit: (spread * (tradeAmount / minAsk)) - 0.05
        });
      }
    });

    // Sort opportunities by profit
    newOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    setCoinsData(newCoinsData);
    setOpportunities(newOpportunities);
  };

  // Execute trade
  const executeTrade = async (opp: ArbitrageOpportunity) => {
    setExecutingTrades(prev => new Set(prev).add(opp.id));
    
    // Simulate trade execution
    setTimeout(() => {
      setExecutingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(opp.id);
        return newSet;
      });
      
      // Show success notification (you can add a toast here)
      console.log(`✅ Trade executed: ${opp.coin} - Profit: $${opp.netProfit.toFixed(2)}`);
    }, 2000);
  };

  // Initialize and update data
  useEffect(() => {
    generateMarketData();
    intervalRef.current = setInterval(generateMarketData, 1000); // Update every second

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tradeAmount]);

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'profitable') return opp.profitPercent > 0.5;
    if (filter === 'executable') return opp.confidence > 80 && opp.liquidity > 1000000;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">⚡ Pro Arbitrage Trading Dashboard</h1>
            <p className="text-gray-400">Real-time opportunities across {Object.keys(EXCHANGES.CEX).length + Object.keys(EXCHANGES.DEX).length} exchanges</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <label className="text-sm text-gray-400 mr-2">Trade Size:</label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(Number(e.target.value))}
                className="bg-gray-700 text-white rounded px-2 py-1 w-24"
                step="1000"
              />
              <span className="text-gray-400 ml-2">USDT</span>
            </div>
            
            <div className="flex bg-gray-800 rounded-lg">
              {['all', 'profitable', 'executable'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Top Opportunities Bar */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">🔥 Top Arbitrage Opportunities</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredOpportunities.slice(0, 3).map(opp => (
              <div key={opp.id} className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{opp.coin}</div>
                  <div className="text-sm text-gray-400">
                    {opp.buyExchange} → {opp.sellExchange}
                  </div>
                  <div className="text-green-400 font-bold">+{opp.profitPercent.toFixed(2)}%</div>
                </div>
                <button
                  onClick={() => executeTrade(opp)}
                  disabled={executingTrades.has(opp.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    executingTrades.has(opp.id)
                      ? 'bg-yellow-600 animate-pulse'
                      : 'bg-green-600 hover:bg-green-700 transform hover:scale-105'
                  }`}
                >
                  {executingTrades.has(opp.id) ? 'Executing...' : `+$${opp.netProfit.toFixed(2)}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coin Grid with Inline Prices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {COINS.map(coin => {
          const data = coinsData[coin.symbol];
          if (!data) return null;

          const hasArbitrage = data.arbitrageProfit > 0.1;
          const topExchanges = Object.values(data.prices)
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, 6);

          return (
            <div
              key={coin.symbol}
              className={`bg-gray-800 rounded-xl p-4 border transition-all ${
                hasArbitrage ? 'border-green-500/50 shadow-lg shadow-green-500/20' : 'border-gray-700'
              }`}
            >
              {/* Coin Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{coin.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{coin.symbol}</h3>
                    <p className="text-sm text-gray-400">{coin.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">${data.avgPrice.toFixed(4)}</div>
                  <div className={`text-sm ${data.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.priceChange24h >= 0 ? '+' : ''}{data.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Arbitrage Alert */}
              {hasArbitrage && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-green-400 font-semibold">+{data.arbitrageProfit.toFixed(2)}% Arbitrage</span>
                      <div className="text-xs text-gray-400 mt-1">
                        Buy {data.bestBuy.exchange} @ ${data.bestBuy.price.toFixed(4)} → 
                        Sell {data.bestSell.exchange} @ ${data.bestSell.price.toFixed(4)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const opp = opportunities.find(o => o.coin === coin.symbol);
                        if (opp) executeTrade(opp);
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Quick Trade
                    </button>
                  </div>
                </div>
              )}

              {/* Exchange Prices Grid */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 mb-1">Top Exchange Prices:</div>
                <div className="grid grid-cols-2 gap-2">
                  {topExchanges.map(exchange => (
                    <div key={exchange.exchange} className="bg-gray-700/50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300">{exchange.exchange}</span>
                        <span className={`text-xs px-1 rounded ${
                          exchange.type === 'CEX' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {exchange.type}
                        </span>
                      </div>
                      <div className="text-sm font-mono text-white">${exchange.price.toFixed(4)}</div>
                      <div className="text-xs text-gray-500">
                        <span className="text-green-500">{exchange.bid.toFixed(4)}</span>
                        {' / '}
                        <span className="text-red-500">{exchange.ask.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View All Button */}
              <button
                onClick={() => setSelectedCoin(coin.symbol)}
                className="w-full mt-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                View All {Object.keys(data.prices).length} Exchanges
              </button>
            </div>
          );
        })}
      </div>

      {/* Detailed View Modal */}
      {selectedCoin && coinsData[selectedCoin] && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCoin(null)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{selectedCoin} - All Exchange Prices</h2>
              <button onClick={() => setSelectedCoin(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(coinsData[selectedCoin].prices)
                .sort((a, b) => a.ask - b.ask)
                .map(price => (
                  <div key={price.exchange} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{price.exchange}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        price.type === 'CEX' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {price.type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Price:</span>
                        <span className="text-white ml-2">${price.price.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Volume:</span>
                        <span className="text-white ml-2">${(price.volume24h / 1000000).toFixed(2)}M</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Bid:</span>
                        <span className="text-green-400 ml-2">${price.bid.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Ask:</span>
                        <span className="text-red-400 ml-2">${price.ask.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
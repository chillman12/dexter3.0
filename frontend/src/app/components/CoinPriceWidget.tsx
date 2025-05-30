'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocketWithFallback } from '../hooks/useWebSocketWithFallback';

interface ExchangePrice {
  exchange: string;
  type: 'DEX' | 'CEX';
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  spreadPercent: number;
}

interface CoinData {
  symbol: string;
  name: string;
  icon: string;
  exchanges: ExchangePrice[];
  bestBuy: { exchange: string; price: number };
  bestSell: { exchange: string; price: number };
  arbitrageProfit: number;
  avgPrice: number;
}

export default function CoinPriceWidget() {
  const { lastMessage, isConnected, sendMessage } = useWebSocketWithFallback();
  const [coinsData, setCoinsData] = useState<Record<string, CoinData>>({});
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(1000);
  const [executingTrade, setExecutingTrade] = useState<string | null>(null);

  // Define coins with their metadata
  const COINS = [
    { symbol: 'SOL', name: 'Solana', icon: '☀️', pair: 'SOL/USDT' },
    { symbol: 'ETH', name: 'Ethereum', icon: '💎', pair: 'ETH/USDT' },
    { symbol: 'BTC', name: 'Bitcoin', icon: '₿', pair: 'BTC/USDT' },
    { symbol: 'BNB', name: 'BNB', icon: '🔶', pair: 'BNB/USDT' },
    { symbol: 'XRP', name: 'Ripple', icon: '💧', pair: 'XRP/USDT' },
    { symbol: 'ADA', name: 'Cardano', icon: '🔷', pair: 'ADA/USDT' },
    { symbol: 'AVAX', name: 'Avalanche', icon: '🏔️', pair: 'AVAX/USDT' },
    { symbol: 'DOT', name: 'Polkadot', icon: '⚪', pair: 'DOT/USDT' },
    { symbol: 'MATIC', name: 'Polygon', icon: '🟣', pair: 'MATIC/USDT' },
    { symbol: 'LINK', name: 'Chainlink', icon: '🔗', pair: 'LINK/USDT' },
    { symbol: 'UNI', name: 'Uniswap', icon: '🦄', pair: 'UNI/USDT' },
    { symbol: 'ATOM', name: 'Cosmos', icon: '⚛️', pair: 'ATOM/USDT' },
  ];

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.message_type === 'price_update' && lastMessage.data.prices) {
      const newCoinsData: Record<string, CoinData> = {};
      
      COINS.forEach(coin => {
        const exchangePrices = lastMessage.data.prices[coin.pair] || [];
        
        if (exchangePrices.length > 0) {
          // Find best buy and sell prices
          let bestBuy = { exchange: '', price: Infinity };
          let bestSell = { exchange: '', price: 0 };
          
          exchangePrices.forEach((price: any) => {
            if (price.ask < bestBuy.price) {
              bestBuy = { exchange: price.exchange, price: price.ask };
            }
            if (price.bid > bestSell.price) {
              bestSell = { exchange: price.exchange, price: price.bid };
            }
          });
          
          const avgPrice = exchangePrices.reduce((sum: number, p: any) => sum + p.price, 0) / exchangePrices.length;
          const arbitrageProfit = bestSell.price > bestBuy.price 
            ? ((bestSell.price - bestBuy.price) / bestBuy.price) * 100 
            : 0;
          
          newCoinsData[coin.symbol] = {
            symbol: coin.symbol,
            name: coin.name,
            icon: coin.icon,
            exchanges: exchangePrices.map((p: any) => ({
              ...p,
              spread: p.ask - p.bid,
              spreadPercent: ((p.ask - p.bid) / p.price) * 100
            })),
            bestBuy,
            bestSell,
            arbitrageProfit,
            avgPrice
          };
        }
      });
      
      setCoinsData(newCoinsData);
    }
  }, [lastMessage]);

  const executeArbitrage = (coin: CoinData) => {
    setExecutingTrade(coin.symbol);
    
    sendMessage({
      type: 'execute_arbitrage',
      data: {
        pair: `${coin.symbol}/USDT`,
        buyExchange: coin.bestBuy.exchange,
        sellExchange: coin.bestSell.exchange,
        buyPrice: coin.bestBuy.price,
        sellPrice: coin.bestSell.price,
        amount: tradeAmount,
        profitPercent: coin.arbitrageProfit
      }
    });
    
    // Reset after 2 seconds
    setTimeout(() => setExecutingTrade(null), 2000);
  };

  const executeTrade = (coin: string, exchange: string, side: 'buy' | 'sell', price: number) => {
    sendMessage({
      type: 'execute_trade',
      data: {
        pair: `${coin}/USDT`,
        exchange,
        side,
        price,
        amount: tradeAmount
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">
            💰 Coin Price Dashboard
          </h2>
          <p className="text-gray-400">
            Click any coin for instant trading across all exchanges
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Trade Amount:</label>
            <input
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(Number(e.target.value))}
              className="bg-gray-800 text-white rounded px-3 py-1 w-24"
              min="100"
              max="100000"
              step="100"
            />
            <span className="text-gray-400">USDT</span>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </div>
        </div>
      </div>

      {/* Coin Grid - Responsive layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {COINS.map(coin => {
          const coinData = coinsData[coin.symbol];
          
          return (
            <div
              key={coin.symbol}
              className={`bg-gray-800 rounded-xl p-4 border transition-all cursor-pointer hover:border-blue-500 ${
                selectedCoin === coin.symbol ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700'
              } ${coinData?.arbitrageProfit > 0.5 ? 'shadow-lg shadow-green-500/20' : ''}`}
              onClick={() => setSelectedCoin(selectedCoin === coin.symbol ? null : coin.symbol)}
            >
              {/* Coin Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{coin.icon}</span>
                  <div>
                    <h3 className="font-bold text-white">{coin.symbol}</h3>
                    <p className="text-xs text-gray-400">{coin.name}</p>
                  </div>
                </div>
                {coinData && (
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">
                      ${coinData.avgPrice.toFixed(4)}
                    </div>
                    {coinData.arbitrageProfit > 0.1 && (
                      <div className="text-xs text-green-400 animate-pulse">
                        +{coinData.arbitrageProfit.toFixed(2)}% arb
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Arbitrage Button */}
              {coinData && coinData.arbitrageProfit > 0.1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    executeArbitrage(coinData);
                  }}
                  className={`w-full mb-3 py-2 rounded-lg font-medium transition-all ${
                    executingTrade === coin.symbol
                      ? 'bg-yellow-600 text-white animate-pulse'
                      : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white transform hover:scale-105'
                  }`}
                >
                  {executingTrade === coin.symbol ? '⏳ Executing...' : `⚡ Quick Arb +${coinData.arbitrageProfit.toFixed(2)}%`}
                </button>
              )}

              {/* Exchange Prices */}
              {selectedCoin === coin.symbol && coinData && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  <div className="text-xs text-gray-400 mb-2">Exchange Prices:</div>
                  
                  {/* CEX Prices */}
                  <div className="space-y-1">
                    <div className="text-xs text-blue-400 font-semibold">CEX</div>
                    {coinData.exchanges
                      .filter(e => e.type === 'CEX')
                      .sort((a, b) => a.ask - b.ask)
                      .map((exchange, index) => (
                        <div key={`${exchange.exchange}-${index}`} className="bg-gray-700/50 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 font-semibold">{exchange.exchange}</span>
                              {exchange.ask === coinData.bestBuy.price && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-1 rounded">Best Buy</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                executeTrade(coin.symbol, exchange.exchange, 'buy', exchange.ask);
                              }}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                            >
                              Buy
                            </button>
                          </div>
                          <div className="flex justify-between text-xs">
                            <div>
                              <span className="text-gray-500">Price:</span>
                              <span className="text-white font-mono ml-1">${exchange.price.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Spread:</span>
                              <span className="text-yellow-400 ml-1">{exchange.spreadPercent.toFixed(3)}%</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <div>
                              <span className="text-green-500">Bid: ${exchange.bid.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-red-500">Ask: ${exchange.ask.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* DEX Prices */}
                  <div className="space-y-1 mt-2">
                    <div className="text-xs text-purple-400 font-semibold">DEX</div>
                    {coinData.exchanges
                      .filter(e => e.type === 'DEX')
                      .sort((a, b) => a.ask - b.ask)
                      .map((exchange, index) => (
                        <div key={`${exchange.exchange}-${index}`} className="bg-gray-700/50 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 font-semibold">{exchange.exchange}</span>
                              {exchange.bid === coinData.bestSell.price && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-1 rounded">Best Sell</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                executeTrade(coin.symbol, exchange.exchange, 'buy', exchange.ask);
                              }}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                            >
                              Buy
                            </button>
                          </div>
                          <div className="flex justify-between text-xs">
                            <div>
                              <span className="text-gray-500">Price:</span>
                              <span className="text-white font-mono ml-1">${exchange.price.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Spread:</span>
                              <span className="text-yellow-400 ml-1">{exchange.spreadPercent.toFixed(3)}%</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <div>
                              <span className="text-green-500">Bid: ${exchange.bid.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-red-500">Ask: ${exchange.ask.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Summary Stats - Always visible */}
              {coinData && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-gray-400">Best Buy:</span>
                      <div className="text-green-400 font-semibold">${coinData.bestBuy.price.toFixed(4)}</div>
                      <div className="text-gray-500">{coinData.bestBuy.exchange}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Best Sell:</span>
                      <div className="text-blue-400 font-semibold">${coinData.bestSell.price.toFixed(4)}</div>
                      <div className="text-gray-500">{coinData.bestSell.exchange}</div>
                    </div>
                  </div>
                  
                  {/* Quick price preview when not expanded */}
                  {selectedCoin !== coin.symbol && (
                    <div className="grid grid-cols-3 gap-1 text-xs mt-2">
                      <div className="bg-gray-700/50 rounded px-1 py-0.5">
                        <span className="text-gray-500">Binance:</span>
                        <span className="text-gray-300 ml-1">
                          ${coinData.exchanges.find(e => e.exchange === 'Binance')?.price.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="bg-gray-700/50 rounded px-1 py-0.5">
                        <span className="text-gray-500">Coinbase:</span>
                        <span className="text-gray-300 ml-1">
                          ${coinData.exchanges.find(e => e.exchange === 'Coinbase')?.price.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="bg-gray-700/50 rounded px-1 py-0.5">
                        <span className="text-gray-500">Jupiter:</span>
                        <span className="text-gray-300 ml-1">
                          ${coinData.exchanges.find(e => e.exchange === 'Jupiter')?.price.toFixed(2) || '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">
              {Object.keys(coinsData).length}
            </div>
            <div className="text-sm text-gray-400">Active Coins</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {Object.values(coinsData).filter(c => c.arbitrageProfit > 0.5).length}
            </div>
            <div className="text-sm text-gray-400">Arbitrage Opps</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {Object.values(coinsData).reduce((sum, c) => sum + c.exchanges.filter(e => e.type === 'CEX').length, 0)}
            </div>
            <div className="text-sm text-gray-400">CEX Prices</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {Object.values(coinsData).reduce((sum, c) => sum + c.exchanges.filter(e => e.type === 'DEX').length, 0)}
            </div>
            <div className="text-sm text-gray-400">DEX Prices</div>
          </div>
        </div>
      </div>
    </div>
  );
}
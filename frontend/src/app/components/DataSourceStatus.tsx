'use client';

import React, { useState, useEffect } from 'react';

interface DataSource {
  name: string;
  type: 'DEX' | 'CEX' | 'API';
  status: 'active' | 'inactive' | 'error';
  lastUpdate: Date;
  latency: number;
  dataPoints: number;
}

export default function DataSourceStatus() {
  const [dataSources, setDataSources] = useState<DataSource[]>([
    // CEX Sources
    { name: 'Binance', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 45, dataPoints: 156 },
    { name: 'Coinbase', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 52, dataPoints: 142 },
    { name: 'Kraken', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 68, dataPoints: 128 },
    { name: 'OKX', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 89, dataPoints: 134 },
    { name: 'Bybit', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 76, dataPoints: 121 },
    { name: 'Gate.io', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 95, dataPoints: 118 },
    { name: 'KuCoin', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 82, dataPoints: 125 },
    { name: 'Huobi', type: 'CEX', status: 'inactive', lastUpdate: new Date(), latency: 0, dataPoints: 0 },
    { name: 'Bitfinex', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 71, dataPoints: 139 },
    { name: 'Gemini', type: 'CEX', status: 'active', lastUpdate: new Date(), latency: 48, dataPoints: 147 },
    
    // DEX Sources
    { name: 'Jupiter', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 124, dataPoints: 89 },
    { name: 'Raydium', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 132, dataPoints: 87 },
    { name: 'Orca', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 128, dataPoints: 91 },
    { name: 'Uniswap V3', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 156, dataPoints: 78 },
    { name: 'SushiSwap', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 164, dataPoints: 72 },
    { name: 'PancakeSwap', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 148, dataPoints: 81 },
    { name: 'Curve', type: 'DEX', status: 'active', lastUpdate: new Date(), latency: 142, dataPoints: 76 },
    
    // API Sources
    { name: 'GeckoTerminal', type: 'API', status: 'active', lastUpdate: new Date(), latency: 234, dataPoints: 45 },
    { name: 'DEX Screener', type: 'API', status: 'active', lastUpdate: new Date(), latency: 198, dataPoints: 52 },
    { name: 'Bitquery', type: 'API', status: 'active', lastUpdate: new Date(), latency: 312, dataPoints: 38 },
  ]);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setDataSources(prev => prev.map(source => ({
        ...source,
        lastUpdate: new Date(),
        latency: source.status === 'active' ? Math.floor(Math.random() * 50) + source.latency * 0.8 : 0,
        dataPoints: source.status === 'active' ? source.dataPoints + Math.floor(Math.random() * 5) : source.dataPoints
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: DataSource['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-400';
    if (latency < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  const stats = {
    totalSources: dataSources.length,
    activeSources: dataSources.filter(s => s.status === 'active').length,
    avgLatency: Math.round(
      dataSources.filter(s => s.status === 'active').reduce((sum, s) => sum + s.latency, 0) / 
      dataSources.filter(s => s.status === 'active').length
    ),
    totalDataPoints: dataSources.reduce((sum, s) => sum + s.dataPoints, 0)
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📡 Live Data Sources</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-400">Active:</span>
            <span className="text-green-400 font-bold ml-2">{stats.activeSources}/{stats.totalSources}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">Avg Latency:</span>
            <span className={`font-bold ml-2 ${getLatencyColor(stats.avgLatency)}`}>{stats.avgLatency}ms</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dataSources.map((source) => (
          <div key={source.name} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(source.status)}`}></div>
                <span className="font-semibold text-white">{source.name}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                source.type === 'DEX' ? 'bg-purple-500/20 text-purple-400' : 
                source.type === 'CEX' ? 'bg-blue-500/20 text-blue-400' :
                'bg-orange-500/20 text-orange-400'
              }`}>
                {source.type}
              </span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Latency:</span>
                <span className={getLatencyColor(source.latency)}>{source.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Data Points:</span>
                <span className="text-white">{source.dataPoints.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Update:</span>
                <span className="text-gray-300 text-xs">
                  {source.lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{stats.totalDataPoints.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Data Points</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{stats.activeSources}</div>
            <div className="text-sm text-gray-400">Active Sources</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {dataSources.filter(s => s.type === 'CEX').length}
            </div>
            <div className="text-sm text-gray-400">CEX Sources</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {dataSources.filter(s => s.type === 'DEX').length}
            </div>
            <div className="text-sm text-gray-400">DEX Sources</div>
          </div>
        </div>
      </div>
    </div>
  );
}
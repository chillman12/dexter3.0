'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface CrossChainRoute {
  id: string;
  token: string;
  amount: number;
  sourceChain: string;
  destinationChain: string;
  bridges: Bridge[];
  totalFee: number;
  estimatedTime: number;
  profit: number;
  profitPercentage: number;
}

interface Bridge {
  name: string;
  fee: number;
  time: number;
}

interface ChainInfo {
  name: string;
  gasPrice: number;
  blockTime: number;
  nativeToken: string;
  nativeTokenPrice: number;
}

const CHAINS: Record<string, ChainInfo> = {
  solana: { name: 'Solana', gasPrice: 0.000005, blockTime: 1, nativeToken: 'SOL', nativeTokenPrice: 171.12 },
  ethereum: { name: 'Ethereum', gasPrice: 30, blockTime: 12, nativeToken: 'ETH', nativeTokenPrice: 3400 },
  bsc: { name: 'BSC', gasPrice: 5, blockTime: 3, nativeToken: 'BNB', nativeTokenPrice: 600 },
  polygon: { name: 'Polygon', gasPrice: 30, blockTime: 2, nativeToken: 'MATIC', nativeTokenPrice: 0.8 },
  avalanche: { name: 'Avalanche', gasPrice: 25, blockTime: 2, nativeToken: 'AVAX', nativeTokenPrice: 35 },
};

export default function CrossChainArbitrage() {
  const [routes, setRoutes] = useState<CrossChainRoute[]>([]);
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [amount, setAmount] = useState(1000);
  const [isScanning, setIsScanning] = useState(false);
  const { data, sendMessage } = useWebSocket();

  useEffect(() => {
    if (data?.type === 'cross_chain_routes') {
      setRoutes(data.routes);
      setIsScanning(false);
    }
  }, [data]);

  const scanForOpportunities = () => {
    setIsScanning(true);
    sendMessage({
      type: 'scan_cross_chain',
      token: selectedToken,
      amount,
    });
  };

  const executeRoute = (route: CrossChainRoute) => {
    sendMessage({
      type: 'execute_cross_chain',
      routeId: route.id,
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Scanner Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Cross-Chain Arbitrage Scanner</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Token</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="ETH">ETH</option>
              <option value="SOL">SOL</option>
              <option value="BNB">BNB</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
              min="100"
              step="100"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={scanForOpportunities}
              disabled={isScanning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {isScanning ? '🔄 Scanning...' : '🔍 Scan Opportunities'}
            </button>
          </div>
        </div>

        {/* Chain Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {Object.entries(CHAINS).map(([key, chain]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <h4 className="text-white font-medium text-sm">{chain.name}</h4>
              <p className="text-gray-400 text-xs mt-1">
                Gas: ${chain.gasPrice} • {chain.nativeToken}: ${chain.nativeTokenPrice}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Arbitrage Routes */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Available Routes {routes.length > 0 && `(${routes.length})`}
        </h3>
        
        {routes.length === 0 ? (
          <p className="text-gray-400">No cross-chain arbitrage opportunities found. Try scanning.</p>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <div key={route.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium">
                      {CHAINS[route.sourceChain]?.name} → {CHAINS[route.destinationChain]?.name}
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">
                      {route.token} • Amount: {route.amount}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-green-400 font-bold text-lg">
                      +${route.profit.toFixed(2)}
                    </p>
                    <p className="text-green-400 text-sm">
                      {route.profitPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Bridge Path */}
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-gray-400 text-sm">Path:</span>
                  {route.bridges.map((bridge, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span className="text-gray-500">→</span>}
                      <span className="bg-gray-600 px-2 py-1 rounded text-white text-sm">
                        {bridge.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Route Details */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-gray-400 text-xs">Total Fees</p>
                    <p className="text-white text-sm">${route.totalFee.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Est. Time</p>
                    <p className="text-white text-sm">{formatTime(route.estimatedTime)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Net Profit</p>
                    <p className="text-green-400 text-sm font-medium">
                      ${(route.profit - route.totalFee).toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => executeRoute(route)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition-colors"
                >
                  Execute Route
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Cross-Chain Transactions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Active Cross-Chain Transactions</h3>
        <p className="text-gray-400">No active cross-chain transactions</p>
      </div>
    </div>
  );
}
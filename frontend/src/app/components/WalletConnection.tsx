'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface Wallet {
  address: string;
  walletType: string;
  balance: number;
  tokens: Record<string, TokenBalance>;
  connected: boolean;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  value_usd: number;
}

export default function WalletConnection() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendMessage } = useWebSocket();

  const connectPhantom = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { solana } = window as any;
      
      if (!solana?.isPhantom) {
        throw new Error('Phantom wallet not found. Please install Phantom.');
      }

      const response = await solana.connect();
      const address = response.publicKey.toString();

      // Send connection request to backend
      sendMessage({
        type: 'wallet_connect',
        wallet_type: 'Phantom',
        address,
      });

      // Mock wallet data for now
      setWallet({
        address,
        walletType: 'Phantom',
        balance: 10.5,
        tokens: {
          USDC: { symbol: 'USDC', balance: 1000, value_usd: 1000 },
          USDT: { symbol: 'USDT', balance: 500, value_usd: 500 },
        },
        connected: true,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectMetaMask = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { ethereum } = window as any;
      
      if (!ethereum?.isMetaMask) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // Send connection request to backend
      sendMessage({
        type: 'wallet_connect',
        wallet_type: 'MetaMask',
        address,
      });

      // Mock wallet data for now
      setWallet({
        address,
        walletType: 'MetaMask',
        balance: 0.5,
        tokens: {
          USDC: { symbol: 'USDC', balance: 2000, value_usd: 2000 },
          WETH: { symbol: 'WETH', balance: 0.5, value_usd: 1700 },
        },
        connected: true,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (wallet) {
      sendMessage({
        type: 'wallet_disconnect',
        address: wallet.address,
      });
    }
    setWallet(null);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (wallet?.connected) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold">Wallet Connected</h3>
          <button
            onClick={disconnect}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Disconnect
          </button>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Address:</span>
            <span className="text-white font-mono">{formatAddress(wallet.address)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Type:</span>
            <span className="text-white">{wallet.walletType}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Balance:</span>
            <span className="text-white">
              {wallet.walletType === 'Phantom' ? 'SOL' : 'ETH'} {wallet.balance.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="text-gray-400 text-sm mb-2">Token Balances</h4>
          {Object.entries(wallet.tokens).map(([symbol, token]) => (
            <div key={symbol} className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">{symbol}:</span>
              <span className="text-white">
                {token.balance.toFixed(2)} (${token.value_usd.toFixed(2)})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Connect Wallet</h3>
      
      {error && (
        <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-3">
        <button
          onClick={connectPhantom}
          disabled={isConnecting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 40 40" fill="currentColor">
            <path d="M20 40C8.954 40 0 31.046 0 20S8.954 0 20 0s20 8.954 20 20-8.954 20-20 20z"/>
          </svg>
          <span>{isConnecting ? 'Connecting...' : 'Connect Phantom'}</span>
        </button>
        
        <button
          onClick={connectMetaMask}
          disabled={isConnecting}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 40 40" fill="currentColor">
            <path d="M35.9 16.1L20 3.2 4.1 16.1l6.2 4.9-1.1 8.2 5.6 2.8v4.7l5.2 3.1 5.2-3.1V32l5.6-2.8-1.1-8.2 6.2-4.9z"/>
          </svg>
          <span>{isConnecting ? 'Connecting...' : 'Connect MetaMask'}</span>
        </button>
      </div>
      
      <p className="text-gray-400 text-xs mt-4 text-center">
        Connect your wallet to start trading
      </p>
    </div>
  );
}
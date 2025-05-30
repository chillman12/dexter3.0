'use client';

import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
  entry_type: string;
  exchange: string;
  timestamp: number;
}

interface MarketDepthData {
  pair: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  mid_price: number;
  total_bid_volume: number;
  total_ask_volume: number;
  timestamp: number;
}

interface MarketDepthChartProps {
  pair?: string;
}

const MarketDepthChart: React.FC<MarketDepthChartProps> = ({ pair = 'SOL/USDC' }) => {
  const [marketDepth, setMarketDepth] = useState<MarketDepthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketDepth = async () => {
      try {
        setLoading(true);
        // Use mock data since the simplified backend doesn't have market depth endpoint
        setMarketDepth(generateFallbackData(pair));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching market depth:', err);
        // Use fallback data on error
        setMarketDepth(generateFallbackData(pair));
      } finally {
        setLoading(false);
      }
    };

    fetchMarketDepth();
    const interval = setInterval(fetchMarketDepth, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [pair]);

  // Generate fallback market depth data
  const generateFallbackData = (pair: string): MarketDepthData => {
    const basePrice = pair.includes('SOL') ? 103.45 : pair.includes('ETH') ? 2245.30 : 42150.00;
    
    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: basePrice * (1 - (i + 1) * 0.001),
      size: Math.floor(Math.random() * 1000) + 100,
      total: Math.floor(Math.random() * 5000) + 500,
      entry_type: 'bid',
      exchange: 'Mock Exchange',
      timestamp: Date.now() / 1000
    }));

    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: basePrice * (1 + (i + 1) * 0.001),
      size: Math.floor(Math.random() * 1000) + 100,
      total: Math.floor(Math.random() * 5000) + 500,
      entry_type: 'ask',
      exchange: 'Mock Exchange',
      timestamp: Date.now() / 1000
    }));

    return {
      pair,
      bids,
      asks,
      spread: asks[0].price - bids[0].price,
      mid_price: (asks[0].price + bids[0].price) / 2,
      total_bid_volume: bids.reduce((sum, bid) => sum + bid.size, 0),
      total_ask_volume: asks.reduce((sum, ask) => sum + ask.size, 0),
      timestamp: Date.now() / 1000
    };
  };

  // Helper function to safely convert to number and apply toFixed
  const safeToFixed = (value: any, decimals: number = 4): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return isNaN(num) ? '0.0000' : num.toFixed(decimals);
  };

  // Helper function to safely convert to number for calculations
  const safeToNumber = (value: any): number => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return isNaN(num) ? 0 : num;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Market Depth - {pair}</h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Market Depth - {pair}</h3>
        <div className="text-red-400 text-center">Error: {error}</div>
      </div>
    );
  }

  if (!marketDepth || !marketDepth.bids || !marketDepth.asks) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Market Depth - {pair}</h3>
        <div className="text-gray-400 text-center">No market depth data available</div>
      </div>
    );
  }

  // Prepare chart data with safe array access
  const bids = (marketDepth.bids || []).slice(0, 10).reverse(); // Show top 10 bids
  const asks = (marketDepth.asks || []).slice(0, 10); // Show top 10 asks

  const labels = [
    ...bids.map(bid => safeToFixed(bid.price, 4)),
    ...asks.map(ask => safeToFixed(ask.price, 4))
  ];

  const bidData = [
    ...bids.map(bid => safeToNumber(bid.size)),
    ...new Array(asks.length).fill(0)
  ];

  const askData = [
    ...new Array(bids.length).fill(0),
    ...asks.map(ask => safeToNumber(ask.size))
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bids',
        data: bidData,
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Asks',
        data: askData,
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white',
        },
      },
      title: {
        display: true,
        text: `Market Depth - ${pair}`,
        color: 'white',
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()} tokens`;
          }
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Price',
          color: 'white',
        },
        ticks: {
          color: 'white',
          maxRotation: 45,
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Size',
          color: 'white',
        },
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Market Depth - {pair}</h3>
        <div className="text-sm text-gray-400">
          Last updated: {new Date(marketDepth.timestamp * 1000).toLocaleTimeString()}
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Mid Price</div>
          <div className="text-lg font-bold text-white">${safeToFixed(marketDepth.mid_price, 4)}</div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Spread</div>
          <div className="text-lg font-bold text-white">${safeToFixed(marketDepth.spread, 4)}</div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Total Bids</div>
          <div className="text-lg font-bold text-green-400">{safeToNumber(marketDepth.total_bid_volume).toLocaleString()}</div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Total Asks</div>
          <div className="text-lg font-bold text-red-400">{safeToNumber(marketDepth.total_ask_volume).toLocaleString()}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>

      {/* Order Book Table */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bids */}
        <div>
          <h4 className="text-lg font-semibold text-green-400 mb-2">Bids</h4>
          <div className="bg-gray-700 rounded overflow-hidden">
            <div className="grid grid-cols-3 gap-2 p-2 text-xs font-semibold text-gray-300 border-b border-gray-600">
              <div>Price</div>
              <div>Size</div>
              <div>Total</div>
            </div>
            {bids.slice(0, 5).map((bid, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 p-2 text-xs text-white border-b border-gray-600 last:border-b-0">
                <div className="text-green-400">${safeToFixed(bid.price, 4)}</div>
                <div>{safeToNumber(bid.size).toLocaleString()}</div>
                <div>{safeToNumber(bid.total).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Asks */}
        <div>
          <h4 className="text-lg font-semibold text-red-400 mb-2">Asks</h4>
          <div className="bg-gray-700 rounded overflow-hidden">
            <div className="grid grid-cols-3 gap-2 p-2 text-xs font-semibold text-gray-300 border-b border-gray-600">
              <div>Price</div>
              <div>Size</div>
              <div>Total</div>
            </div>
            {asks.slice(0, 5).map((ask, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 p-2 text-xs text-white border-b border-gray-600 last:border-b-0">
                <div className="text-red-400">${safeToFixed(ask.price, 4)}</div>
                <div>{safeToNumber(ask.size).toLocaleString()}</div>
                <div>{safeToNumber(ask.total).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDepthChart; 
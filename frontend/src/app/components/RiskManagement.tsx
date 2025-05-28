'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface RiskMetrics {
  portfolioVaR: number;
  currentDrawdown: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalRisk: number;
  riskAdjustedReturn: number;
  positions: PositionRisk[];
}

interface PositionRisk {
  symbol: string;
  positionSize: number;
  unrealizedPnL: number;
  riskAmount: number;
  var95: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface RiskSettings {
  maxPositionSize: number;
  maxPortfolioRisk: number;
  maxDailyLoss: number;
  riskPerTrade: number;
  useStopLoss: boolean;
  stopLossPercentage: number;
  useTakeProfit: boolean;
  takeProfitPercentage: number;
}

export default function RiskManagement() {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>({
    portfolioVaR: 0,
    currentDrawdown: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    totalRisk: 0,
    riskAdjustedReturn: 0,
    positions: [],
  });

  const [settings, setSettings] = useState<RiskSettings>({
    maxPositionSize: 10,
    maxPortfolioRisk: 20,
    maxDailyLoss: 5,
    riskPerTrade: 1,
    useStopLoss: true,
    stopLossPercentage: 2,
    useTakeProfit: true,
    takeProfitPercentage: 4,
  });

  const { data, sendMessage } = useWebSocket();

  useEffect(() => {
    if (data?.type === 'risk_update') {
      setRiskMetrics(data.metrics);
    }
  }, [data]);

  const updateSettings = (newSettings: Partial<RiskSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    sendMessage({
      type: 'update_risk_settings',
      settings: updated,
    });
  };

  const getRiskColor = (value: number, threshold: number) => {
    if (value < threshold * 0.5) return 'text-green-400';
    if (value < threshold * 0.8) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Risk Overview</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Portfolio VaR (95%)</p>
            <p className={`text-2xl font-bold ${getRiskColor(riskMetrics.portfolioVaR, 1000)}`}>
              ${riskMetrics.portfolioVaR.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">Current Drawdown</p>
            <p className={`text-2xl font-bold ${getRiskColor(riskMetrics.currentDrawdown, settings.maxDailyLoss)}`}>
              {riskMetrics.currentDrawdown.toFixed(2)}%
            </p>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">Sharpe Ratio</p>
            <p className={`text-2xl font-bold ${riskMetrics.sharpeRatio > 1 ? 'text-green-400' : 'text-yellow-400'}`}>
              {riskMetrics.sharpeRatio.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">Total Risk</p>
            <p className={`text-2xl font-bold ${getRiskColor(riskMetrics.totalRisk, settings.maxPortfolioRisk)}`}>
              {riskMetrics.totalRisk.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Risk Progress Bars */}
        <div className="mt-6 space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Portfolio Risk</span>
              <span className="text-white">{riskMetrics.totalRisk.toFixed(1)}% / {settings.maxPortfolioRisk}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  riskMetrics.totalRisk < settings.maxPortfolioRisk * 0.8
                    ? 'bg-green-500'
                    : riskMetrics.totalRisk < settings.maxPortfolioRisk
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((riskMetrics.totalRisk / settings.maxPortfolioRisk) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Daily Drawdown</span>
              <span className="text-white">{riskMetrics.currentDrawdown.toFixed(1)}% / {settings.maxDailyLoss}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  riskMetrics.currentDrawdown < settings.maxDailyLoss * 0.8
                    ? 'bg-green-500'
                    : riskMetrics.currentDrawdown < settings.maxDailyLoss
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((riskMetrics.currentDrawdown / settings.maxDailyLoss) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Risk Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Risk Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Max Position Size (%)
            </label>
            <input
              type="range"
              min="1"
              max="25"
              value={settings.maxPositionSize}
              onChange={(e) => updateSettings({ maxPositionSize: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">1%</span>
              <span className="text-white font-medium">{settings.maxPositionSize}%</span>
              <span className="text-gray-500">25%</span>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Max Portfolio Risk (%)
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.maxPortfolioRisk}
              onChange={(e) => updateSettings({ maxPortfolioRisk: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">5%</span>
              <span className="text-white font-medium">{settings.maxPortfolioRisk}%</span>
              <span className="text-gray-500">50%</span>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Max Daily Loss (%)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxDailyLoss}
              onChange={(e) => updateSettings({ maxDailyLoss: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">1%</span>
              <span className="text-white font-medium">{settings.maxDailyLoss}%</span>
              <span className="text-gray-500">10%</span>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Risk Per Trade (%)
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.riskPerTrade}
              onChange={(e) => updateSettings({ riskPerTrade: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">0.1%</span>
              <span className="text-white font-medium">{settings.riskPerTrade}%</span>
              <span className="text-gray-500">5%</span>
            </div>
          </div>
        </div>

        {/* Stop Loss & Take Profit Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-gray-400 text-sm">Use Stop Loss</label>
              <button
                onClick={() => updateSettings({ useStopLoss: !settings.useStopLoss })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.useStopLoss ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.useStopLoss ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {settings.useStopLoss && (
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={settings.stopLossPercentage}
                  onChange={(e) => updateSettings({ stopLossPercentage: Number(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-gray-400 text-sm">Use Take Profit</label>
              <button
                onClick={() => updateSettings({ useTakeProfit: !settings.useTakeProfit })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.useTakeProfit ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.useTakeProfit ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {settings.useTakeProfit && (
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={settings.takeProfitPercentage}
                  onChange={(e) => updateSettings({ takeProfitPercentage: Number(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Position Risk Analysis */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Position Risk Analysis</h3>
        
        {riskMetrics.positions.length === 0 ? (
          <p className="text-gray-400">No open positions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Size</th>
                  <th className="pb-2">P&L</th>
                  <th className="pb-2">Risk</th>
                  <th className="pb-2">VaR (95%)</th>
                  <th className="pb-2">Stop Loss</th>
                  <th className="pb-2">Take Profit</th>
                </tr>
              </thead>
              <tbody>
                {riskMetrics.positions.map((position, index) => (
                  <tr key={index} className="border-t border-gray-700">
                    <td className="py-2 text-white">{position.symbol}</td>
                    <td className="py-2 text-white">${position.positionSize.toFixed(2)}</td>
                    <td className={`py-2 ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                    </td>
                    <td className="py-2 text-yellow-400">${position.riskAmount.toFixed(2)}</td>
                    <td className="py-2 text-orange-400">${position.var95.toFixed(2)}</td>
                    <td className="py-2 text-red-400">
                      {position.stopLoss ? `$${position.stopLoss.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2 text-green-400">
                      {position.takeProfit ? `$${position.takeProfit.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
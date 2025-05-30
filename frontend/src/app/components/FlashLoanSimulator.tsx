'use client'

import { useState } from 'react'

interface FlashLoanSimulationResult {
  id: string
  amount: number
  token: string
  profit_loss: number
  gas_cost: number
  net_profit: number
  execution_path: string[]
  risk_level: string
  loan_fee: number
  success_probability: number
}

export default function FlashLoanSimulator() {
  const [amount, setAmount] = useState<string>('10000')
  const [token, setToken] = useState<string>('USDC')
  const [strategy, setStrategy] = useState<string>('simple_arbitrage')
  const [isSimulating, setIsSimulating] = useState(false)
  const [result, setResult] = useState<FlashLoanSimulationResult | null>(null)

  const tokens = ['USDC', 'ETH', 'SOL', 'BTC', 'DAI']
  const strategies = [
    { id: 'simple_arbitrage', name: 'Simple DEX Arbitrage', risk: 'Low' },
    { id: 'triangular_arbitrage', name: 'Triangular Arbitrage', risk: 'Medium' },
    { id: 'liquidation_arbitrage', name: 'Liquidation Arbitrage', risk: 'High' },
  ]

  const handleSimulate = async () => {
    setIsSimulating(true)
    
    try {
      const response = await fetch('http://localhost:3001/api/v1/simulate-flashloan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          token,
          strategy,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        console.error('Simulation failed')
      }
    } catch (error) {
      console.error('Error simulating flash loan:', error)
    } finally {
      setIsSimulating(false)
    }
  }

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? '+' : ''
    return `${sign}$${profit.toFixed(2)}`
  }

  const getProfitColor = (profit: number) => {
    return profit >= 0 ? 'text-green-400' : 'text-red-400'
  }

  return (
    <div className="dexter-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          ⚡ Flash Loan Simulator
        </h3>
        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
          SIMULATION
        </span>
      </div>

      {/* Input Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Loan Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="10000"
            />
            <span className="absolute right-3 top-2 text-gray-400">USD</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token
          </label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            {tokens.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Strategy
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.risk} Risk)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSimulate}
          disabled={isSimulating || !amount}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            isSimulating || !amount
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          {isSimulating ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="spinner"></div>
              <span>Simulating...</span>
            </div>
          ) : (
            'Simulate Flash Loan'
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Simulation Results</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-400">Net Profit</p>
              <p className={`text-lg font-bold ${getProfitColor(result.net_profit)}`}>
                {formatProfit(result.net_profit)}
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-400">Success Rate</p>
              <p className="text-lg font-bold text-blue-400">
                {(result.success_probability * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Loan Fee:</span>
              <span className="text-white font-mono">${result.loan_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Gas Cost:</span>
              <span className="text-white font-mono">${result.gas_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Risk Level:</span>
              <span className={`font-mono ${
                result.risk_level === 'Low' ? 'text-green-400' :
                result.risk_level === 'Medium' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {result.risk_level}
              </span>
            </div>
          </div>

          {/* Execution Path */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Execution Path:</p>
            <div className="space-y-1">
              {result.execution_path.map((step, index) => (
                <div key={index} className="text-xs bg-gray-700 rounded px-2 py-1">
                  {index + 1}. {step}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
              Execute
            </button>
            <button className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h5 className="text-sm font-medium text-blue-400 mb-2">💡 Quick Tips</h5>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Start with smaller amounts to test strategies</li>
          <li>• Monitor gas prices for optimal execution</li>
          <li>• Consider slippage in high-volatility markets</li>
          <li>• Use MEV protection for large transactions</li>
        </ul>
      </div>
    </div>
  )
}
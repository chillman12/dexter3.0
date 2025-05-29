# 📁 DEXTER Project Structure Guide

This guide explains the organization of the DEXTER v3.3 codebase and where to find specific functionality.

## 🏗️ Directory Overview

```
dester/
├── backend/           # Rust backend server
├── frontend/          # Next.js frontend application
├── docs/              # All documentation
├── README.md          # Main project README
├── LICENSE            # MIT License
└── PROJECT_STRUCTURE.md  # This file
```

## 📂 Backend Structure (`/backend`)

### Core Directory: `/backend/src/`

#### 🔧 Core Services
- **`main.rs`** - Entry point, server initialization
- **`dashboard_api.rs`** - REST API endpoints
- **`ws_server.rs`** - WebSocket server for real-time data
- **`websocket_feeds.rs`** - WebSocket data streaming logic

#### 💹 Trading & Arbitrage
- **`arbitrage_engine.rs`** - Core arbitrage detection with SIMD optimization
- **`trade_executor.rs`** - Trade execution logic
- **`trade_execution.rs`** - Order management and execution
- **`universal_price_aggregator.rs`** - Unified price fetching from all exchanges

#### 🌐 Exchange Integrations
- **`external_apis.rs`** - CEX integrations (Binance, Coinbase, etc.)
- **`dex_connectors.rs`** - DEX integrations (Jupiter, Raydium, etc.)
- **`market_data.rs`** - Market data aggregation and processing

#### 💎 DeFi Features
- **`liquidity_pool.rs`** - Advanced liquidity pool management
- **`smart_contracts.rs`** - Solana smart contract integration
- **`flash_loan_simulator.rs`** - Flash loan strategy simulation
- **`cross_chain.rs`** - Cross-chain arbitrage support

#### 🛡️ Risk & Security
- **`risk_management.rs`** - Risk assessment and limits
- **`mev_protection.rs`** - MEV protection engine
- **`wallet_manager.rs`** - Multi-wallet management

#### 📊 Analytics & ML
- **`ml_models.rs`** - Machine learning price predictions
- **`historical_data.rs`** - Historical data management

## 🎨 Frontend Structure (`/frontend`)

### Core Directory: `/frontend/src/app/`

#### 📑 Pages
- **`page.tsx`** - Main dashboard page
- **`layout.tsx`** - App layout wrapper
- **`globals.css`** - Global styles

#### 🧩 Components (`/components`)
- **`TradingDashboard.tsx`** - Main trading interface
- **`ArbitrageOpportunities.tsx`** - Live arbitrage display
- **`LivePriceFeed.tsx`** - Real-time price updates
- **`WalletConnection.tsx`** - Wallet connection UI
- **`CrossChainArbitrage.tsx`** - Cross-chain trading interface
- **`FlashLoanSimulator.tsx`** - Flash loan simulation UI
- **`MarketDepthChart.tsx`** - Order book visualization
- **`MevProtectionMonitor.tsx`** - MEV threat monitoring
- **`PlatformStats.tsx`** - Platform statistics
- **`RiskManagement.tsx`** - Risk controls UI
- **`ConnectionStatus.tsx`** - WebSocket connection status

#### 🪝 Hooks (`/hooks`)
- **`useWebSocket.ts`** - WebSocket connection management

## 📚 Documentation (`/docs`)

### 📁 Documentation Categories

#### `/docs/api/` - API Documentation
- API integration guides
- Exchange status reports
- Performance analysis
- Implementation guides

#### `/docs/guides/` - User Guides
- Wallet trading integration
- Getting started guides

#### `/docs/deployment/` - Deployment
- Production deployment guide
- Configuration options

#### `/docs/architecture/` - Architecture (planned)
- System design documents
- Data flow diagrams

#### `/docs/development/` - Development
- Changelog
- Update summaries
- Contributing guidelines (planned)

## 🔍 Where to Find Key Features

### 💱 Arbitrage Detection
- **Algorithm**: `backend/src/arbitrage_engine.rs`
- **API Endpoint**: `backend/src/dashboard_api.rs` → `/api/v1/arbitrage-opportunities`
- **Frontend Display**: `frontend/src/app/components/ArbitrageOpportunities.tsx`

### 📊 Live Price Data
- **Aggregator**: `backend/src/universal_price_aggregator.rs`
- **CEX Data**: `backend/src/external_apis.rs`
- **DEX Data**: `backend/src/dex_connectors.rs`
- **WebSocket Stream**: `backend/src/websocket_feeds.rs`
- **Frontend Display**: `frontend/src/app/components/LivePriceFeed.tsx`

### 💼 Wallet Management
- **Backend Logic**: `backend/src/wallet_manager.rs`
- **Frontend UI**: `frontend/src/app/components/WalletConnection.tsx`
- **Integration Guide**: `docs/guides/WALLET_TRADING_INTEGRATION.md`

### 🛡️ MEV Protection
- **Detection Engine**: `backend/src/mev_protection.rs`
- **Frontend Monitor**: `frontend/src/app/components/MevProtectionMonitor.tsx`

### 💎 Liquidity Pools
- **Management**: `backend/src/liquidity_pool.rs`
- **Smart Contracts**: `backend/src/smart_contracts.rs`

### 🤖 Machine Learning
- **Models**: `backend/src/ml_models.rs`
- **Training Data**: `backend/src/historical_data.rs`

## 🚀 Quick Navigation Tips

1. **To add a new exchange**:
   - CEX: Edit `backend/src/external_apis.rs`
   - DEX: Edit `backend/src/dex_connectors.rs`

2. **To modify arbitrage logic**:
   - Edit `backend/src/arbitrage_engine.rs`

3. **To add new API endpoints**:
   - Edit `backend/src/dashboard_api.rs`

4. **To update the UI**:
   - Components in `frontend/src/app/components/`

5. **To change WebSocket data**:
   - Edit `backend/src/websocket_feeds.rs`

## 🔧 Configuration Files

- **Backend Config**: `backend/Cargo.toml` - Rust dependencies
- **Frontend Config**: `frontend/package.json` - Node dependencies
- **Frontend Build**: `frontend/next.config.js` - Next.js configuration
- **Styles**: `frontend/tailwind.config.js` - Tailwind CSS configuration

## 📝 Important Notes

1. **All price data** flows through `universal_price_aggregator.rs`
2. **WebSocket** runs on port 3002 (separate from REST API on 3001)
3. **No API keys required** for basic price data from all exchanges
4. **SIMD optimizations** are in `arbitrage_engine.rs` and `smart_contracts.rs`
5. **Lock-free structures** (DashMap) used in MEV protection and price aggregation

---

*Last updated: December 19, 2024*
# 🔥 DEXTER v3.1.0 - API Integration Guide

## 🚀 Overview

DEXTER v3.1.0 is now fully equipped with real-time price feeds from multiple sources. This guide will help you set up API keys and understand the data flow.

## 📊 Live Data Sources

### 1. **CoinGecko API (No Key Required)**
- **Endpoint**: `https://api.coingecko.com/api/v3/`
- **Rate Limit**: 10-50 requests/minute (free tier)
- **Data**: BTC, ETH, SOL prices in USD
- **Implementation**: `fetch_coingecko_prices()`

### 2. **Binance API (No Key Required for Public Data)**
- **Endpoint**: `https://api.binance.com/api/v3/`
- **Rate Limit**: 1200 requests/minute
- **Data**: Real-time spot prices
- **Implementation**: `fetch_binance_prices()`

### 3. **Jupiter API (Solana DEX)**
- **Endpoint**: `https://quote-api.jup.ag/v6/`
- **Rate Limit**: 10 requests/second
- **Data**: SOL DEX prices and swap quotes
- **Implementation**: `fetch_jupiter_prices()`

### 4. **DEX Screener API**
- **Endpoint**: `https://api.dexscreener.com/latest/`
- **Rate Limit**: 300 requests/minute
- **Data**: Multi-chain DEX pair data
- **Implementation**: `fetch_dexscreener_prices()`

### 5. **GeckoTerminal API**
- **Endpoint**: `https://api.geckoterminal.com/api/v2/`
- **Rate Limit**: 30 requests/minute
- **Data**: DEX pool analytics
- **Implementation**: `get_geckoterminal_pool()`

### 6. **Bitquery GraphQL (API Key Required)**
- **Endpoint**: `https://graphql.bitquery.io`
- **Rate Limit**: Based on subscription
- **Data**: Historical blockchain data
- **Setup**: Set `BITQUERY_API_KEY` in `.env`

## 🔑 API Key Setup

### Required API Keys
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your keys:
BITQUERY_API_KEY=your_bitquery_api_key_here
```

### Optional API Keys (for higher limits)
```bash
# Optional - for production use
BINANCE_API_KEY=your_binance_key
COINBASE_API_KEY=your_coinbase_key
COINGECKO_API_KEY=your_coingecko_pro_key
```

## 📡 Real-Time Price Flow

### Price Aggregation Process
1. **Concurrent Fetching**: All APIs are called in parallel
2. **Timeout Protection**: 10-second timeout for each API
3. **Fallback Mechanism**: If APIs fail, uses recent cached prices
4. **Price Averaging**: Multiple sources are averaged for accuracy

### Current Implementation
```rust
// From external_apis.rs
pub async fn get_real_time_prices(&self) -> Result<HashMap<String, f64>> {
    // Fetch from 4 sources concurrently
    let (coingecko, binance, jupiter, dexscreener) = tokio::join!(
        self.fetch_coingecko_prices(),
        self.fetch_binance_prices(),
        self.fetch_jupiter_prices(),
        self.fetch_dexscreener_prices()
    );
    
    // Average prices from all sources
    // Returns: BTC/USDC, ETH/USDC, SOL/USDC with confidence scores
}
```

## 🏗️ Architecture

### Data Flow
```
External APIs → ExternalApiClient → Price Aggregation → WebSocket Broadcast
                                  ↓
                              Arbitrage Engine
                                  ↓
                              Trade Executor
```

### Key Components
- **ExternalApiClient**: Manages all API connections
- **WebSocketFeedManager**: Streams real-time data
- **DexAggregator**: Combines DEX liquidity
- **TradeExecutor**: Executes arbitrage trades

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
cargo build --release
```

### 2. Set Up Environment
```bash
# Create .env file
cp .env.example .env

# Add your Bitquery API key (minimum requirement)
echo "BITQUERY_API_KEY=your_key_here" >> .env
```

### 3. Run the Platform
```bash
# Start backend
cargo run

# In another terminal, start frontend
cd ../frontend
npm install
npm run dev
```

### 4. Verify Live Data
```bash
# Check health
curl http://localhost:3001/health

# Get live prices
curl http://localhost:3001/api/v1/market-depth/SOL/USDC

# See arbitrage opportunities
curl http://localhost:3001/api/v1/arbitrage-opportunities
```

## 📈 Available Endpoints

### REST API (Port 3001)
- `GET /health` - System health check
- `GET /api/v1/market-depth/{pair}` - Live market depth
- `GET /api/v1/arbitrage-opportunities` - Current opportunities
- `GET /api/v1/platform-stats` - Platform statistics

### WebSocket (Port 3002)
- Real-time price updates
- Arbitrage opportunity alerts
- MEV detection events
- Trade execution updates

## 🔧 Configuration

### Update Intervals
- **Price Scanning**: Every 10 seconds
- **Arbitrage Detection**: Every 2 seconds
- **WebSocket Broadcast**: Every 500ms

### Rate Limiting
The system automatically handles rate limits:
- Jupiter: 100ms delay between requests
- GeckoTerminal: 2s delay between requests
- DEX Screener: 200ms delay between requests
- Bitquery: 2s delay between requests

## 🛡️ Security Considerations

### API Key Management
- Never commit `.env` files
- Use environment variables only
- Rotate keys regularly
- Monitor API usage

### Trading Safety
- Set position size limits
- Configure stop-loss levels
- Monitor gas prices
- Use test wallets first

## 📊 Data Quality

### Price Confidence Scores
- 4 sources: 95% confidence
- 3 sources: 90% confidence
- 2 sources: 80% confidence
- 1 source: 60% confidence
- Fallback: 10% confidence

### Arbitrage Confidence
- Jupiter direct: 85%
- Cross-DEX: 75%
- DEX Screener: 70%
- Bitquery historical: 80%

## 🚨 Troubleshooting

### Common Issues
1. **No prices showing**
   - Check internet connection
   - Verify API endpoints are accessible
   - Check logs for API errors

2. **Arbitrage opportunities not updating**
   - Ensure WebSocket is connected
   - Check browser console for errors
   - Verify backend is running

3. **API rate limits**
   - Reduce scan frequency
   - Add API keys for higher limits
   - Implement caching

### Debug Commands
```bash
# Check API connectivity
curl -I https://api.coingecko.com/api/v3/ping
curl -I https://api.binance.com/api/v3/time
curl -I https://quote-api.jup.ag/v6/quote

# View logs
tail -f logs/dexter.log

# Test WebSocket
wscat -c ws://localhost:3002
```

## 🎯 Next Steps

1. **Production Setup**
   - Get premium API keys
   - Set up monitoring
   - Configure alerts
   - Enable trade execution

2. **Advanced Features**
   - Add more token pairs
   - Implement custom strategies
   - Enable cross-chain arbitrage
   - Set up automated trading

3. **Performance Optimization**
   - Enable Redis caching
   - Use dedicated RPC nodes
   - Optimize API call batching
   - Implement failover endpoints

---

**Need Help?**
- GitHub Issues: [Report bugs or request features]
- Documentation: Check `/docs` folder
- Logs: Enable debug logging with `RUST_LOG=debug`

**Happy Trading! 🚀**
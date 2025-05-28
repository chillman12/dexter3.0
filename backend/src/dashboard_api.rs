// Dashboard API Server - Provides REST endpoints for the DEX dashboard frontend
// Bridges the Next.js dashboard with the Rust arbitrage engine

use std::collections::HashMap;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use rust_decimal::{Decimal, prelude::{FromStr, ToPrimitive, FromPrimitive}};
use tokio::sync::{RwLock, Mutex};
use warp::{Filter, Reply, reply::json};
use warp::http::StatusCode;
use anyhow::Result;
use log::{info, warn};
use crate::external_apis::ExternalApiClient;
use chrono;
use rand;

// Dashboard API Data Structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardArbitrageOpportunity {
    pub id: String,
    pub path: Vec<String>,
    pub profit_percentage: f64,
    pub required_capital: Decimal,
    pub estimated_profit: Decimal,
    pub timestamp: u64,
    pub risk_level: String,
    pub exchanges: Vec<String>,
    pub liquidity_score: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashLoanSimulation {
    pub id: String,
    pub amount: Decimal,
    pub token: String,
    pub profit_loss: Decimal,
    pub gas_cost: Decimal,
    pub net_profit: Decimal,
    pub execution_path: Vec<String>,
    pub risk_level: String,
    pub loan_fee: Decimal,
    pub success_probability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookEntry {
    pub price: Decimal,
    pub size: Decimal,
    pub total: Decimal,
    pub entry_type: String, // "bid" or "ask"
    pub exchange: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDepthData {
    pub pair: String,
    pub bids: Vec<OrderBookEntry>,
    pub asks: Vec<OrderBookEntry>,
    pub spread: Decimal,
    pub mid_price: Decimal,
    pub total_bid_volume: Decimal,
    pub total_ask_volume: Decimal,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevThreat {
    pub id: String,
    pub threat_type: String, // "Frontrunning", "Sandwiching", "Backrunning"
    pub risk: String, // "High", "Medium", "Low"
    pub description: String,
    pub mitigation: String,
    pub timestamp: u64,
    pub transaction_hash: Option<String>,
    pub gas_price_impact: Option<Decimal>,
    pub affected_tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalIndicator {
    pub name: String,
    pub value: f64,
    pub signal: String, // "buy", "sell", "neutral"
    pub confidence: f64,
    pub timeframe: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStats {
    pub total_volume_24h: Decimal,
    pub active_pairs: u32,
    pub total_trades_1h: u32,
    pub opportunities_found: u32,
    pub success_rate: f64,
    pub total_profit: Decimal,
    pub active_strategies: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStatsResponse {
    pub total_volume_24h: f64,
    pub active_pairs: u32,
    pub total_trades_1h: u32,
    pub opportunities_found: u32,
    pub success_rate: f64,
    pub total_profit: f64,
    pub active_strategies: u32,
}

// Request/Response structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashLoanRequest {
    pub amount: Decimal,
    pub token: String,
    pub strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletConnectRequest {
    pub address: String,
    pub network: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteTradeRequest {
    pub opportunity_id: String,
    pub amount: Option<Decimal>,
    pub max_slippage: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeExecutionResponse {
    pub id: String,
    pub status: String,
    pub profit: f64,
    pub execution_time_ms: u64,
    pub gas_cost: f64,
    pub slippage: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioResponse {
    pub total_value_usd: f64,
    pub available_balance: f64,
    pub locked_balance: f64,
    pub daily_pnl: f64,
    pub total_pnl: f64,
    pub win_rate: f64,
    pub active_trades: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionMetricsResponse {
    pub total_trades: u64,
    pub successful_trades: u64,
    pub win_rate: f64,
    pub total_profit: f64,
    pub average_execution_time: f64,
    pub sharpe_ratio: f64,
}

// Dashboard API Server
pub struct DashboardApiServer {
    arbitrage_opportunities: Arc<RwLock<Vec<DashboardArbitrageOpportunity>>>,
    flash_loan_simulations: Arc<RwLock<HashMap<String, FlashLoanSimulation>>>,
    market_depth: Arc<RwLock<HashMap<String, MarketDepthData>>>,
    mev_threats: Arc<RwLock<Vec<MevThreat>>>,
    technical_indicators: Arc<RwLock<HashMap<String, Vec<TechnicalIndicator>>>>,
    platform_stats: Arc<Mutex<PlatformStats>>,
    external_api_client: Arc<ExternalApiClient>,
    port: u16,
}

impl DashboardApiServer {
    pub fn new(port: u16, external_api_client: Arc<ExternalApiClient>) -> Self {
        Self {
            arbitrage_opportunities: Arc::new(RwLock::new(Vec::new())),
            flash_loan_simulations: Arc::new(RwLock::new(HashMap::new())),
            market_depth: Arc::new(RwLock::new(HashMap::new())),
            mev_threats: Arc::new(RwLock::new(Vec::new())),
            technical_indicators: Arc::new(RwLock::new(HashMap::new())),
            platform_stats: Arc::new(Mutex::new(PlatformStats {
                total_volume_24h: Decimal::ZERO,
                active_pairs: 0,
                total_trades_1h: 0,
                opportunities_found: 0,
                success_rate: 0.0,
                total_profit: Decimal::ZERO,
                active_strategies: 0,
            })),
            external_api_client,
            port,
        }
    }

    pub async fn start(self: Arc<Self>) -> Result<()> {
        info!("🌐 Starting Dashboard API server on port {}", self.port);

        // Clone references for the routes
        let opportunities = self.arbitrage_opportunities.clone();
        let simulations = self.flash_loan_simulations.clone();
        let depth_market = self.market_depth.clone();
        let depth_pairs = self.market_depth.clone(); // Additional clone for pairs endpoint
        let threats = self.mev_threats.clone();
        let indicators = self.technical_indicators.clone();
        let stats = self.platform_stats.clone();

        // CORS headers
        let cors = warp::cors()
            .allow_any_origin()
            .allow_headers(vec!["content-type"])
            .allow_methods(vec!["GET", "POST", "PUT", "DELETE"]);

        // API Routes
        let api = warp::path("api").and(warp::path("v1"));

        // GET /api/v1/opportunities - Get arbitrage opportunities
        let opportunities_route = api
            .and(warp::path("opportunities"))
            .and(warp::get())
            .and(warp::any().map(move || opportunities.clone()))
            .and_then(get_arbitrage_opportunities);

        // POST /api/v1/simulate-flashloan - Simulate flash loan
        let simulate_flashloan_route = api
            .and(warp::path("simulate-flashloan"))
            .and(warp::post())
            .and(warp::body::json())
            .and(warp::any().map(move || simulations.clone()))
            .and_then(simulate_flash_loan);

        // GET /api/v1/market-depth/{base}/{quote} - Get market depth for pair
        let market_depth_route = api
            .and(warp::path!("market-depth" / String / String))
            .and(warp::get())
            .and(warp::any().map(move || depth_market.clone()))
            .and_then(get_market_depth_by_parts);

        // GET /api/v1/market-depth-pairs - Debug endpoint to list all pairs
        let market_depth_pairs_route = api
            .and(warp::path("market-depth"))
            .and(warp::get())
            .and(warp::any().map(move || depth_pairs.clone()))
            .and_then(list_market_depth_pairs);

        // GET /api/v1/mev-threats - Get MEV threats
        let mev_threats_route = api
            .and(warp::path("mev-threats"))
            .and(warp::get())
            .and(warp::any().map(move || threats.clone()))
            .and_then(get_mev_threats);

        // GET /api/v1/indicators/{pair} - Get technical indicators
        let indicators_route = api
            .and(warp::path!("technical-indicators" / String))
            .and(warp::get())
            .and(warp::any().map(move || indicators.clone()))
            .and_then(get_technical_indicators);

        // GET /api/v1/platform-stats - Platform statistics
        let stats_route = api
            .and(warp::path("platform-stats"))
            .and(warp::get())
            .and(warp::any().map(move || stats.clone()))
            .and_then(get_platform_stats);

        // Health check
        let health_route = warp::path("health")
            .and(warp::get())
            .map(|| warp::reply::with_status("OK", StatusCode::OK));

        // Combine all routes
        let routes = opportunities_route
            .or(simulate_flashloan_route)
            .or(market_depth_route)
            .or(market_depth_pairs_route)
            .or(mev_threats_route)
            .or(indicators_route)
            .or(stats_route)
            .or(health_route)
            .with(cors);

        // Start data generation tasks
        tokio::spawn(self.clone().generate_mock_data_loop());

        // Generate initial data immediately
        let initial_server = self.clone();
        tokio::spawn(async move {
            initial_server.update_market_depth().await;
            initial_server.update_platform_stats().await;
            initial_server.generate_arbitrage_opportunity().await;
        });

        // Start the server
        warp::serve(routes)
            .run(([127, 0, 0, 1], self.port))
            .await;

        Ok(())
    }

    async fn generate_mock_data_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3));
        let mut external_api_counter = 0;
        
        loop {
            interval.tick().await;
            
            // Generate arbitrage opportunities
            self.generate_arbitrage_opportunity().await;
            
            // Update market depth with external API data every 5th iteration (15 seconds)
            external_api_counter += 1;
            if external_api_counter >= 5 {
                external_api_counter = 0;
                info!("🌐 Dashboard API: Updating market depth with real-time prices...");
                self.update_market_depth().await;
            }
            
            // Generate MEV threats occasionally
            if rand::random::<f64>() < 0.3 {
                self.generate_mev_threat().await;
            }
            
            // Update technical indicators
            self.update_technical_indicators().await;
            
            // Update platform stats
            self.update_platform_stats().await;
        }
    }

    async fn generate_arbitrage_opportunity(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC", "BTC/USDC"];
        let exchanges = vec!["Jupiter", "Raydium", "Orca", "Binance"];
        
        let pair = pairs[rand::random::<usize>() % pairs.len()];
        let exchange1 = exchanges[rand::random::<usize>() % exchanges.len()];
        let mut exchange2 = exchanges[rand::random::<usize>() % exchanges.len()];
        
        // Ensure different exchanges
        while exchange2 == exchange1 {
            exchange2 = exchanges[rand::random::<usize>() % exchanges.len()];
        }

        let profit_percentage = rand::random::<f64>() * 2.0 + 0.1; // 0.1% to 2.1%
        let required_capital = Decimal::from(rand::random::<u32>() % 10000 + 1000);
        
        let opportunity = DashboardArbitrageOpportunity {
            id: format!("arb_{}", chrono::Utc::now().timestamp_millis()),
            path: vec![pair.to_string()],
            profit_percentage,
            required_capital,
            estimated_profit: required_capital * Decimal::from_f64(profit_percentage / 100.0).unwrap_or_default(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            risk_level: if profit_percentage > 1.5 { "Low".to_string() } 
                       else if profit_percentage > 0.8 { "Medium".to_string() } 
                       else { "High".to_string() },
            exchanges: vec![exchange1.to_string(), exchange2.to_string()],
            liquidity_score: rand::random::<f64>(),
            confidence: rand::random::<f64>() * 0.4 + 0.6, // 60-100%
        };

        let mut opportunities = self.arbitrage_opportunities.write().await;
        opportunities.push(opportunity);
        
        // Keep only last 10 opportunities
        if opportunities.len() > 10 {
            let drain_count = opportunities.len() - 10;
            opportunities.drain(0..drain_count);
        }
    }

    async fn update_market_depth(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC", "BTC/USDC"];
        
        info!("🔄 Dashboard API: Starting market depth update with external API integration...");
        
        // 🔥 GET REAL-TIME PRICES FROM EXTERNAL APIs WITH TIMEOUT 🔥
        let real_time_prices = match tokio::time::timeout(
            tokio::time::Duration::from_secs(10), // 10 second timeout
            self.external_api_client.get_real_time_prices()
        ).await {
            Ok(Ok(prices)) => {
                info!("✅ Dashboard API: Successfully fetched real-time prices from external APIs");
                info!("📊 Dashboard API: Received {} price entries", prices.len());
                for (pair, price) in &prices {
                    info!("💰 Dashboard API: {} = ${:.2}", pair, price);
                }
                prices
            }
            Ok(Err(e)) => {
                warn!("⚠️ Dashboard API: Failed to fetch real-time prices: {}", e);
                // Fallback to current market prices if APIs fail
                let mut fallback_prices = HashMap::new();
                fallback_prices.insert("SOL/USDC".to_string(), 171.12); // Current market price
                fallback_prices.insert("ETH/USDC".to_string(), 3400.00); // Updated to current market price
                fallback_prices.insert("BTC/USDC".to_string(), 95000.00); // Updated to current market price
                fallback_prices
            }
            Err(_) => {
                warn!("⚠️ Dashboard API: External API call timed out after 10 seconds");
                info!("🔄 Dashboard API: Using fallback prices due to timeout...");
                // Fallback to current market prices if APIs timeout
                let mut fallback_prices = HashMap::new();
                fallback_prices.insert("SOL/USDC".to_string(), 171.12); // Current market price
                fallback_prices.insert("ETH/USDC".to_string(), 3400.00); // Updated to current market price
                fallback_prices.insert("BTC/USDC".to_string(), 95000.00); // Updated to current market price
                fallback_prices
            }
        };
        
        for pair in &pairs {
            let base_price = match *pair {
                "SOL/USDC" => {
                    // Try to get real-time SOL price, fallback to current market price
                    real_time_prices.get("SOL/USDC_AVERAGE")
                        .or_else(|| real_time_prices.get("SOL/USDC"))
                        .or_else(|| real_time_prices.get("SOL/USDC_RAYDIUM"))
                        .or_else(|| real_time_prices.get("SOL/USDC_DEXSCREENER"))
                        .copied()
                        .unwrap_or(171.12) // Updated to current market price
                }
                "ETH/USDC" => real_time_prices.get("ETH/USDC").copied().unwrap_or(3400.00),
                "BTC/USDC" => real_time_prices.get("BTC/USDC").copied().unwrap_or(95000.00),
                _ => 100.0, // Default fallback
            };
            
            let base_price = Decimal::from_f64(base_price).unwrap_or_else(|| {
                match *pair {
                    "SOL/USDC" => Decimal::from_str("171.12").unwrap(),
                    "ETH/USDC" => Decimal::from_str("3400.00").unwrap(),
                    "BTC/USDC" => Decimal::from_str("95000.00").unwrap(),
                    _ => Decimal::from_str("100.0").unwrap(),
                }
            });
            
            info!("💰 Dashboard API: Updated {} price to ${:.2}", pair, base_price);

            let mut bids = Vec::new();
            let mut asks = Vec::new();

            // Generate bids (lower prices)
            for i in 0..5 {
                let price = base_price * (Decimal::ONE - Decimal::from(i) * Decimal::from_str("0.001").unwrap());
                let size = Decimal::from(rand::random::<u32>() % 1000 + 100);
                
                bids.push(OrderBookEntry {
                    price,
                    size,
                    total: size, // Simplified total
                    entry_type: "bid".to_string(),
                    exchange: "Mock Exchange".to_string(),
                    timestamp: chrono::Utc::now().timestamp() as u64,
                });
            }

            // Generate asks (higher prices)
            for i in 0..5 {
                let price = base_price * (Decimal::ONE + Decimal::from(i + 1) * Decimal::from_str("0.001").unwrap());
                let size = Decimal::from(rand::random::<u32>() % 1000 + 100);
                
                asks.push(OrderBookEntry {
                    price,
                    size,
                    total: size, // Simplified total
                    entry_type: "ask".to_string(),
                    exchange: "Mock Exchange".to_string(),
                    timestamp: chrono::Utc::now().timestamp() as u64,
                });
            }

            let spread = asks[0].price - bids[0].price;
            let mid_price = (asks[0].price + bids[0].price) / Decimal::from(2);

            let depth_data = MarketDepthData {
                pair: pair.to_string(),
                bids,
                asks,
                spread,
                mid_price,
                total_bid_volume: Decimal::from(1000),
                total_ask_volume: Decimal::from(1000),
                timestamp: chrono::Utc::now().timestamp() as u64,
            };

            let mut market_depth = self.market_depth.write().await;
            market_depth.insert(pair.to_string(), depth_data);
        }
    }

    async fn generate_mev_threat(&self) {
        let threat_types = vec!["Frontrunning", "Sandwiching", "Backrunning"];
        let risk_levels = vec!["High", "Medium", "Low"];
        
        let threat_type = threat_types[rand::random::<usize>() % threat_types.len()];
        let risk_level = risk_levels[rand::random::<usize>() % risk_levels.len()];

        let threat = MevThreat {
            id: format!("mev_{}", chrono::Utc::now().timestamp_millis()),
            threat_type: threat_type.to_string(),
            risk: risk_level.to_string(),
            description: format!("{} attack detected", threat_type),
            mitigation: "Private mempool routing applied".to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            transaction_hash: Some(format!("0x{:x}", rand::random::<u64>())),
            gas_price_impact: Some(Decimal::from(15)),
            affected_tokens: vec!["SOL".to_string(), "USDC".to_string()],
        };

        let mut threats = self.mev_threats.write().await;
        threats.push(threat);
        
        // Keep only last 5 threats
        if threats.len() > 5 {
            let drain_count = threats.len() - 5;
            threats.drain(0..drain_count);
        }
    }

    async fn update_technical_indicators(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC", "BTC/USDC"];
        
        for pair in pairs {
            let indicators = vec![
                TechnicalIndicator {
                    name: "RSI".to_string(),
                    value: rand::random::<f64>() * 100.0,
                    signal: if rand::random::<f64>() > 0.5 { "buy" } else { "sell" }.to_string(),
                    confidence: rand::random::<f64>(),
                    timeframe: "1H".to_string(),
                },
                TechnicalIndicator {
                    name: "MACD".to_string(),
                    value: (rand::random::<f64>() - 0.5) * 10.0,
                    signal: "neutral".to_string(),
                    confidence: rand::random::<f64>(),
                    timeframe: "1H".to_string(),
                },
            ];

            let mut technical_indicators = self.technical_indicators.write().await;
            technical_indicators.insert(pair.to_string(), indicators);
        }
    }

    async fn update_platform_stats(&self) {
        let opportunities = self.arbitrage_opportunities.read().await;
        let opportunities_count = opportunities.len() as u32;
        
        // Generate realistic mock stats
        let base_volume = 12500000.0 + (rand::random::<f64>() - 0.5) * 2000000.0;
        let base_profit = 75000.0 + (rand::random::<f64>() - 0.5) * 15000.0;
        
        let mut stats = self.platform_stats.lock().await;
        stats.total_volume_24h = Decimal::from_f64(base_volume).unwrap_or_default();
        stats.active_pairs = 15 + (rand::random::<u32>() % 5);
        stats.total_trades_1h = 1200 + (rand::random::<u32>() % 200);
        stats.opportunities_found = opportunities_count;
        stats.success_rate = 85.0 + (rand::random::<f64>() - 0.5) * 10.0;
        stats.total_profit = Decimal::from_f64(base_profit).unwrap_or_default();
        stats.active_strategies = 4;
    }
}

impl Clone for DashboardApiServer {
    fn clone(&self) -> Self {
        Self {
            arbitrage_opportunities: self.arbitrage_opportunities.clone(),
            flash_loan_simulations: self.flash_loan_simulations.clone(),
            market_depth: self.market_depth.clone(),
            mev_threats: self.mev_threats.clone(),
            technical_indicators: self.technical_indicators.clone(),
            platform_stats: self.platform_stats.clone(),
            external_api_client: self.external_api_client.clone(),
            port: self.port,
        }
    }
}

// Handler functions
async fn get_arbitrage_opportunities(
    opportunities: Arc<RwLock<Vec<DashboardArbitrageOpportunity>>>,
) -> Result<impl Reply, warp::Rejection> {
    let opportunities = opportunities.read().await;
    Ok(warp::reply::json(&*opportunities))
}

async fn simulate_flash_loan(
    request: FlashLoanRequest,
    simulations: Arc<RwLock<HashMap<String, FlashLoanSimulation>>>,
) -> Result<impl Reply, warp::Rejection> {
    let simulation = FlashLoanSimulation {
        id: format!("sim_{}", chrono::Utc::now().timestamp()),
        amount: request.amount,
        token: request.token,
        profit_loss: Decimal::from(250),
        gas_cost: Decimal::from(50),
        net_profit: Decimal::from(200),
        execution_path: vec!["Buy on DEX A".to_string(), "Sell on DEX B".to_string()],
        risk_level: "Medium".to_string(),
        loan_fee: request.amount * Decimal::from_str("0.0009").unwrap(),
        success_probability: 0.75,
    };

    let mut simulations = simulations.write().await;
    simulations.insert(simulation.id.clone(), simulation.clone());

    Ok(warp::reply::json(&simulation))
}

async fn get_market_depth_by_parts(
    base: String,
    quote: String,
    depth: Arc<RwLock<HashMap<String, MarketDepthData>>>,
) -> Result<impl Reply, warp::Rejection> {
    let pair = format!("{}/{}", base, quote);
    let depth = depth.read().await;
    
    // Debug logging
    println!("🔍 Requested pair: '{}'", pair);
    println!("🔍 Available pairs: {:?}", depth.keys().collect::<Vec<_>>());
    
    match depth.get(&pair) {
        Some(data) => Ok(warp::reply::json(data)),
        None => Ok(warp::reply::json(&serde_json::json!({"error": "Pair not found"}))),
    }
}

// Debug endpoint to list all pairs
async fn list_market_depth_pairs(
    depth: Arc<RwLock<HashMap<String, MarketDepthData>>>,
) -> Result<impl Reply, warp::Rejection> {
    let depth = depth.read().await;
    let pairs: Vec<String> = depth.keys().cloned().collect();
    Ok(warp::reply::json(&serde_json::json!({"pairs": pairs})))
}

async fn get_mev_threats(
    threats: Arc<RwLock<Vec<MevThreat>>>,
) -> Result<impl Reply, warp::Rejection> {
    let threats = threats.read().await;
    Ok(warp::reply::json(&*threats))
}

async fn get_technical_indicators(
    pair: String,
    indicators: Arc<RwLock<HashMap<String, Vec<TechnicalIndicator>>>>,
) -> Result<impl Reply, warp::Rejection> {
    let indicators = indicators.read().await;
    match indicators.get(&pair) {
        Some(data) => Ok(warp::reply::json(data)),
        None => Ok(warp::reply::json(&Vec::<TechnicalIndicator>::new())),
    }
}

async fn get_platform_stats(
    stats: Arc<Mutex<PlatformStats>>,
) -> Result<impl Reply, warp::Rejection> {
    let stats = stats.lock().await;
    Ok(warp::reply::json(&PlatformStatsResponse {
        total_volume_24h: stats.total_volume_24h.to_f64().unwrap(),
        active_pairs: stats.active_pairs,
        total_trades_1h: stats.total_trades_1h,
        opportunities_found: stats.opportunities_found,
        success_rate: stats.success_rate,
        total_profit: stats.total_profit.to_f64().unwrap(),
        active_strategies: stats.active_strategies,
    }))
}
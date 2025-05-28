// Dashboard API Server - Provides REST endpoints for the DEX dashboard frontend
// Bridges the Next.js dashboard with the Rust arbitrage engine

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use rust_decimal::Decimal;
use log::{info, warn, error, debug};
use warp::{Filter, Reply, http::StatusCode};

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

// Dashboard API Server
pub struct DashboardApiServer {
    arbitrage_opportunities: Arc<RwLock<Vec<DashboardArbitrageOpportunity>>>,
    flash_loan_simulations: Arc<RwLock<HashMap<String, FlashLoanSimulation>>>,
    market_depth: Arc<RwLock<HashMap<String, MarketDepthData>>>,
    mev_threats: Arc<RwLock<Vec<MevThreat>>>,
    technical_indicators: Arc<RwLock<HashMap<String, Vec<TechnicalIndicator>>>>,
    platform_stats: Arc<Mutex<PlatformStats>>,
    port: u16,
}

impl DashboardApiServer {
    pub fn new(port: u16) -> Self {
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
            port,
        }
    }

    pub async fn start(self: Arc<Self>) -> Result<()> {
        info!("🌐 Starting Dashboard API server on port {}", self.port);

        // Clone references for the routes
        let opportunities = self.arbitrage_opportunities.clone();
        let simulations = self.flash_loan_simulations.clone();
        let depth = self.market_depth.clone();
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

        // GET /api/v1/market-depth/{pair} - Get market depth for pair
        let market_depth_route = api
            .and(warp::path("market-depth"))
            .and(warp::path::param::<String>())
            .and(warp::get())
            .and(warp::any().map(move || depth.clone()))
            .and_then(get_market_depth);

        // GET /api/v1/mev-threats - Get MEV threats
        let mev_threats_route = api
            .and(warp::path("mev-threats"))
            .and(warp::get())
            .and(warp::any().map(move || threats.clone()))
            .and_then(get_mev_threats);

        // GET /api/v1/indicators/{pair} - Get technical indicators
        let indicators_route = api
            .and(warp::path("indicators"))
            .and(warp::path::param::<String>())
            .and(warp::get())
            .and(warp::any().map(move || indicators.clone()))
            .and_then(get_technical_indicators);

        // GET /api/v1/stats - Get platform statistics
        let stats_route = api
            .and(warp::path("stats"))
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
            .or(mev_threats_route)
            .or(indicators_route)
            .or(stats_route)
            .or(health_route)
            .with(cors);

        // Start data generation tasks
        tokio::spawn(self.clone().generate_mock_data_loop());

        // Start the server
        warp::serve(routes)
            .run(([127, 0, 0, 1], self.port))
            .await;

        Ok(())
    }

    async fn generate_mock_data_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3));
        
        loop {
            interval.tick().await;
            
            // Generate arbitrage opportunities
            self.generate_arbitrage_opportunity().await;
            
            // Generate market depth data
            self.update_market_depth().await;
            
            // Generate MEV threats occasionally
            if rand::random::<f64>() < 0.3 {
                self.generate_mev_threat().await;
            }
            
            // Update technical indicators
            self.update_technical_indicators().await;
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
            opportunities.drain(0..opportunities.len() - 10);
        }
    }

    async fn update_market_depth(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC", "BTC/USDC"];
        
        for pair in pairs {
            let base_price = match pair {
                "SOL/USDC" => Decimal::from_str("103.45").unwrap(),
                "ETH/USDC" => Decimal::from_str("2245.30").unwrap(),
                "BTC/USDC" => Decimal::from_str("42150.00").unwrap(),
                _ => Decimal::from_str("100.00").unwrap(),
            };

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
            threats.drain(0..threats.len() - 5);
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

async fn get_market_depth(
    pair: String,
    depth: Arc<RwLock<HashMap<String, MarketDepthData>>>,
) -> Result<impl Reply, warp::Rejection> {
    let depth = depth.read().await;
    match depth.get(&pair) {
        Some(data) => Ok(warp::reply::json(data)),
        None => Ok(warp::reply::json(&serde_json::json!({"error": "Pair not found"}))),
    }
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
    Ok(warp::reply::json(&*stats))
}

use rust_decimal::prelude::{FromStr, ToPrimitive, FromPrimitive};
use rand;
use chrono;
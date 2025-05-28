use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OHLCV {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeTick {
    pub price: f64,
    pub amount: f64,
    pub side: TradeSide,
    pub timestamp: i64,
    pub exchange: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradeSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSnapshot {
    pub symbol: String,
    pub bid: f64,
    pub ask: f64,
    pub last_price: f64,
    pub volume_24h: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone)]
pub struct TimeSeriesData {
    pub symbol: String,
    pub timeframe: TimeFrame,
    pub candles: VecDeque<OHLCV>,
    pub max_candles: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TimeFrame {
    M1,  // 1 minute
    M5,  // 5 minutes
    M15, // 15 minutes
    M30, // 30 minutes
    H1,  // 1 hour
    H4,  // 4 hours
    D1,  // 1 day
}

impl TimeFrame {
    pub fn to_seconds(&self) -> i64 {
        match self {
            TimeFrame::M1 => 60,
            TimeFrame::M5 => 300,
            TimeFrame::M15 => 900,
            TimeFrame::M30 => 1800,
            TimeFrame::H1 => 3600,
            TimeFrame::H4 => 14400,
            TimeFrame::D1 => 86400,
        }
    }
}

pub struct HistoricalDataStore {
    ohlcv_data: Arc<RwLock<HashMap<String, HashMap<TimeFrame, TimeSeriesData>>>>,
    tick_data: Arc<RwLock<HashMap<String, VecDeque<TradeTick>>>>,
    snapshots: Arc<RwLock<HashMap<String, VecDeque<MarketSnapshot>>>>,
    max_ticks: usize,
    max_snapshots: usize,
}

impl HistoricalDataStore {
    pub fn new() -> Self {
        Self {
            ohlcv_data: Arc::new(RwLock::new(HashMap::new())),
            tick_data: Arc::new(RwLock::new(HashMap::new())),
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            max_ticks: 100000,
            max_snapshots: 10000,
        }
    }

    pub async fn add_trade(&self, symbol: &str, trade: TradeTick) {
        // Add to tick data
        let mut ticks = self.tick_data.write().await;
        let symbol_ticks = ticks.entry(symbol.to_string()).or_insert_with(VecDeque::new);
        
        symbol_ticks.push_back(trade.clone());
        if symbol_ticks.len() > self.max_ticks {
            symbol_ticks.pop_front();
        }
        
        // Update OHLCV candles
        self.update_candles(symbol, &trade).await;
    }

    async fn update_candles(&self, symbol: &str, trade: &TradeTick) {
        let mut ohlcv_data = self.ohlcv_data.write().await;
        let symbol_data = ohlcv_data.entry(symbol.to_string()).or_insert_with(HashMap::new);
        
        for timeframe in &[TimeFrame::M1, TimeFrame::M5, TimeFrame::M15, TimeFrame::H1, TimeFrame::D1] {
            let series = symbol_data.entry(*timeframe).or_insert_with(|| {
                TimeSeriesData {
                    symbol: symbol.to_string(),
                    timeframe: *timeframe,
                    candles: VecDeque::new(),
                    max_candles: 1000,
                }
            });
            
            let candle_start = (trade.timestamp / timeframe.to_seconds()) * timeframe.to_seconds();
            
            if let Some(last_candle) = series.candles.back_mut() {
                if last_candle.timestamp == candle_start {
                    // Update existing candle
                    last_candle.high = last_candle.high.max(trade.price);
                    last_candle.low = last_candle.low.min(trade.price);
                    last_candle.close = trade.price;
                    last_candle.volume += trade.amount;
                } else {
                    // Create new candle
                    let new_candle = OHLCV {
                        open: trade.price,
                        high: trade.price,
                        low: trade.price,
                        close: trade.price,
                        volume: trade.amount,
                        timestamp: candle_start,
                    };
                    series.candles.push_back(new_candle);
                    
                    if series.candles.len() > series.max_candles {
                        series.candles.pop_front();
                    }
                }
            } else {
                // First candle
                let new_candle = OHLCV {
                    open: trade.price,
                    high: trade.price,
                    low: trade.price,
                    close: trade.price,
                    volume: trade.amount,
                    timestamp: candle_start,
                };
                series.candles.push_back(new_candle);
            }
        }
    }

    pub async fn get_candles(
        &self,
        symbol: &str,
        timeframe: TimeFrame,
        limit: usize,
    ) -> Vec<OHLCV> {
        let ohlcv_data = self.ohlcv_data.read().await;
        
        if let Some(symbol_data) = ohlcv_data.get(symbol) {
            if let Some(series) = symbol_data.get(&timeframe) {
                let candles: Vec<OHLCV> = series.candles.iter()
                    .rev()
                    .take(limit)
                    .rev()
                    .cloned()
                    .collect();
                return candles;
            }
        }
        
        Vec::new()
    }

    pub async fn add_snapshot(&self, snapshot: MarketSnapshot) {
        let mut snapshots = self.snapshots.write().await;
        let symbol_snapshots = snapshots.entry(snapshot.symbol.clone()).or_insert_with(VecDeque::new);
        
        symbol_snapshots.push_back(snapshot);
        if symbol_snapshots.len() > self.max_snapshots {
            symbol_snapshots.pop_front();
        }
    }

    pub async fn get_latest_snapshot(&self, symbol: &str) -> Option<MarketSnapshot> {
        let snapshots = self.snapshots.read().await;
        snapshots.get(symbol)?.back().cloned()
    }
}

// Backtesting Engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestConfig {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub initial_balance: f64,
    pub fee_rate: f64,
    pub slippage: f64,
    pub symbols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestResult {
    pub total_trades: usize,
    pub winning_trades: usize,
    pub losing_trades: usize,
    pub total_pnl: f64,
    pub total_fees: f64,
    pub max_drawdown: f64,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub trades: Vec<BacktestTrade>,
    pub equity_curve: Vec<(i64, f64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestTrade {
    pub entry_time: i64,
    pub exit_time: i64,
    pub symbol: String,
    pub side: TradeSide,
    pub entry_price: f64,
    pub exit_price: f64,
    pub amount: f64,
    pub pnl: f64,
    pub fee: f64,
}

pub struct BacktestEngine {
    data_store: Arc<HistoricalDataStore>,
}

impl BacktestEngine {
    pub fn new(data_store: Arc<HistoricalDataStore>) -> Self {
        Self { data_store }
    }

    pub async fn run_backtest<S: Strategy>(
        &self,
        strategy: &S,
        config: BacktestConfig,
    ) -> BacktestResult {
        let mut portfolio = Portfolio::new(config.initial_balance);
        let mut trades = Vec::new();
        let mut equity_curve = Vec::new();
        
        // Get historical data for the backtest period
        let start_ts = config.start_time.timestamp();
        let end_ts = config.end_time.timestamp();
        
        // Simulate market by iterating through historical data
        for symbol in &config.symbols {
            let candles = self.data_store.get_candles(symbol, TimeFrame::M5, 10000).await;
            
            for candle in candles {
                if candle.timestamp < start_ts || candle.timestamp > end_ts {
                    continue;
                }
                
                // Update market data
                let market_data = MarketData {
                    symbol: symbol.clone(),
                    price: candle.close,
                    volume: candle.volume,
                    timestamp: candle.timestamp,
                };
                
                // Get strategy signals
                let signals = strategy.generate_signals(&market_data, &portfolio);
                
                // Execute trades based on signals
                for signal in signals {
                    if let Some(trade) = self.execute_backtest_trade(
                        &mut portfolio,
                        &signal,
                        &market_data,
                        config.fee_rate,
                        config.slippage,
                    ) {
                        trades.push(trade);
                    }
                }
                
                // Record equity
                equity_curve.push((candle.timestamp, portfolio.total_value(candle.close)));
            }
        }
        
        // Calculate performance metrics
        self.calculate_backtest_metrics(trades, equity_curve, config.initial_balance)
    }

    fn execute_backtest_trade(
        &self,
        portfolio: &mut Portfolio,
        signal: &TradeSignal,
        market_data: &MarketData,
        fee_rate: f64,
        slippage: f64,
    ) -> Option<BacktestTrade> {
        let execution_price = match signal.side {
            TradeSide::Buy => market_data.price * (1.0 + slippage),
            TradeSide::Sell => market_data.price * (1.0 - slippage),
        };
        
        let fee = signal.amount * execution_price * fee_rate;
        
        match signal.side {
            TradeSide::Buy => {
                let cost = signal.amount * execution_price + fee;
                if portfolio.cash >= cost {
                    portfolio.cash -= cost;
                    portfolio.positions.insert(
                        market_data.symbol.clone(),
                        Position {
                            amount: signal.amount,
                            entry_price: execution_price,
                            entry_time: market_data.timestamp,
                        },
                    );
                    
                    return Some(BacktestTrade {
                        entry_time: market_data.timestamp,
                        exit_time: 0,
                        symbol: market_data.symbol.clone(),
                        side: signal.side.clone(),
                        entry_price: execution_price,
                        exit_price: 0.0,
                        amount: signal.amount,
                        pnl: 0.0,
                        fee,
                    });
                }
            },
            TradeSide::Sell => {
                if let Some(position) = portfolio.positions.remove(&market_data.symbol) {
                    let proceeds = position.amount * execution_price - fee;
                    portfolio.cash += proceeds;
                    
                    let pnl = (execution_price - position.entry_price) * position.amount - fee;
                    
                    return Some(BacktestTrade {
                        entry_time: position.entry_time,
                        exit_time: market_data.timestamp,
                        symbol: market_data.symbol.clone(),
                        side: signal.side.clone(),
                        entry_price: position.entry_price,
                        exit_price: execution_price,
                        amount: position.amount,
                        pnl,
                        fee,
                    });
                }
            },
        }
        
        None
    }

    fn calculate_backtest_metrics(
        &self,
        trades: Vec<BacktestTrade>,
        equity_curve: Vec<(i64, f64)>,
        initial_balance: f64,
    ) -> BacktestResult {
        let total_trades = trades.len();
        let winning_trades = trades.iter().filter(|t| t.pnl > 0.0).count();
        let losing_trades = trades.iter().filter(|t| t.pnl <= 0.0).count();
        let total_pnl: f64 = trades.iter().map(|t| t.pnl).sum();
        let total_fees: f64 = trades.iter().map(|t| t.fee).sum();
        
        let win_rate = if total_trades > 0 {
            winning_trades as f64 / total_trades as f64
        } else {
            0.0
        };
        
        let gross_profit: f64 = trades.iter().filter(|t| t.pnl > 0.0).map(|t| t.pnl).sum();
        let gross_loss: f64 = trades.iter().filter(|t| t.pnl <= 0.0).map(|t| t.pnl.abs()).sum();
        let profit_factor = if gross_loss > 0.0 {
            gross_profit / gross_loss
        } else {
            f64::INFINITY
        };
        
        // Calculate max drawdown
        let mut max_drawdown = 0.0;
        let mut peak = initial_balance;
        for (_, equity) in &equity_curve {
            if *equity > peak {
                peak = *equity;
            }
            let drawdown = (peak - equity) / peak;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
        }
        
        // Calculate Sharpe ratio (simplified)
        let returns: Vec<f64> = equity_curve.windows(2)
            .map(|w| (w[1].1 - w[0].1) / w[0].1)
            .collect();
        
        let avg_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let std_dev = (returns.iter().map(|r| (r - avg_return).powi(2)).sum::<f64>() / returns.len() as f64).sqrt();
        let sharpe_ratio = if std_dev > 0.0 {
            (avg_return / std_dev) * (252.0_f64).sqrt() // Annualized
        } else {
            0.0
        };
        
        BacktestResult {
            total_trades,
            winning_trades,
            losing_trades,
            total_pnl,
            total_fees,
            max_drawdown,
            sharpe_ratio,
            win_rate,
            profit_factor,
            trades,
            equity_curve,
        }
    }
}

// Strategy trait for backtesting
pub trait Strategy: Send + Sync {
    fn generate_signals(&self, market_data: &MarketData, portfolio: &Portfolio) -> Vec<TradeSignal>;
}

#[derive(Debug, Clone)]
pub struct MarketData {
    pub symbol: String,
    pub price: f64,
    pub volume: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone)]
pub struct TradeSignal {
    pub symbol: String,
    pub side: TradeSide,
    pub amount: f64,
    pub signal_type: SignalType,
}

#[derive(Debug, Clone)]
pub enum SignalType {
    Entry,
    Exit,
    StopLoss,
    TakeProfit,
}

#[derive(Debug, Clone)]
pub struct Portfolio {
    pub cash: f64,
    pub positions: HashMap<String, Position>,
}

#[derive(Debug, Clone)]
pub struct Position {
    pub amount: f64,
    pub entry_price: f64,
    pub entry_time: i64,
}

impl Portfolio {
    pub fn new(initial_cash: f64) -> Self {
        Self {
            cash: initial_cash,
            positions: HashMap::new(),
        }
    }

    pub fn total_value(&self, current_price: f64) -> f64 {
        let position_value: f64 = self.positions.values()
            .map(|p| p.amount * current_price)
            .sum();
        self.cash + position_value
    }
}
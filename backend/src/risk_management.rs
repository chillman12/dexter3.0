use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskProfile {
    pub max_position_size: f64,
    pub max_portfolio_risk: f64,
    pub max_daily_loss: f64,
    pub max_leverage: f64,
    pub stop_loss_percentage: f64,
    pub take_profit_percentage: f64,
    pub max_correlated_positions: usize,
    pub risk_per_trade: f64,
}

impl Default for RiskProfile {
    fn default() -> Self {
        Self {
            max_position_size: 0.1,      // 10% of portfolio
            max_portfolio_risk: 0.2,     // 20% total risk
            max_daily_loss: 0.05,        // 5% daily loss limit
            max_leverage: 3.0,           // 3x leverage
            stop_loss_percentage: 0.02,  // 2% stop loss
            take_profit_percentage: 0.04, // 4% take profit
            max_correlated_positions: 3,
            risk_per_trade: 0.01,        // 1% risk per trade
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionRisk {
    pub symbol: String,
    pub position_size: f64,
    pub entry_price: f64,
    pub current_price: f64,
    pub unrealized_pnl: f64,
    pub risk_amount: f64,
    pub var_95: f64,  // Value at Risk at 95% confidence
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub correlation_group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioRisk {
    pub total_value: f64,
    pub total_risk: f64,
    pub var_95: f64,
    pub cvar_95: f64, // Conditional VaR
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub max_drawdown: f64,
    pub current_drawdown: f64,
    pub daily_pnl: f64,
    pub risk_adjusted_return: f64,
    pub positions: Vec<PositionRisk>,
}

pub struct RiskManager {
    risk_profile: Arc<RwLock<RiskProfile>>,
    position_risks: Arc<RwLock<HashMap<String, PositionRisk>>>,
    portfolio_history: Arc<RwLock<Vec<(u64, f64)>>>, // (timestamp, value)
    daily_pnl_history: Arc<RwLock<Vec<(u64, f64)>>>,
    correlation_matrix: Arc<RwLock<HashMap<(String, String), f64>>>,
}

impl RiskManager {
    pub fn new(risk_profile: RiskProfile) -> Self {
        Self {
            risk_profile: Arc::new(RwLock::new(risk_profile)),
            position_risks: Arc::new(RwLock::new(HashMap::new())),
            portfolio_history: Arc::new(RwLock::new(Vec::new())),
            daily_pnl_history: Arc::new(RwLock::new(Vec::new())),
            correlation_matrix: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn validate_order(
        &self,
        symbol: &str,
        order_size: f64,
        order_value: f64,
        portfolio_value: f64,
    ) -> Result<(), String> {
        let profile = self.risk_profile.read().await;
        let positions = self.position_risks.read().await;
        
        // Check position size limit
        let position_percentage = order_value / portfolio_value;
        if position_percentage > profile.max_position_size {
            return Err(format!(
                "Position size {:.2}% exceeds maximum {:.2}%",
                position_percentage * 100.0,
                profile.max_position_size * 100.0
            ));
        }
        
        // Check total portfolio risk
        let current_risk: f64 = positions.values().map(|p| p.risk_amount).sum();
        let new_risk = order_value * profile.stop_loss_percentage;
        let total_risk = (current_risk + new_risk) / portfolio_value;
        
        if total_risk > profile.max_portfolio_risk {
            return Err(format!(
                "Total portfolio risk {:.2}% would exceed maximum {:.2}%",
                total_risk * 100.0,
                profile.max_portfolio_risk * 100.0
            ));
        }
        
        // Check daily loss limit
        let daily_pnl = self.calculate_daily_pnl().await;
        if daily_pnl < -profile.max_daily_loss * portfolio_value {
            return Err("Daily loss limit reached".to_string());
        }
        
        // Check correlated positions
        let correlation_group = self.get_correlation_group(symbol).await;
        if let Some(group) = correlation_group {
            let correlated_count = positions.values()
                .filter(|p| p.correlation_group.as_ref() == Some(&group))
                .count();
            
            if correlated_count >= profile.max_correlated_positions {
                return Err(format!(
                    "Maximum {} correlated positions already open",
                    profile.max_correlated_positions
                ));
            }
        }
        
        Ok(())
    }

    pub async fn calculate_position_size(
        &self,
        symbol: &str,
        entry_price: f64,
        stop_loss: f64,
        portfolio_value: f64,
    ) -> f64 {
        let profile = self.risk_profile.read().await;
        
        // Kelly Criterion adjusted position sizing
        let risk_amount = portfolio_value * profile.risk_per_trade;
        let price_risk = (entry_price - stop_loss).abs() / entry_price;
        
        let position_value = risk_amount / price_risk;
        let max_position_value = portfolio_value * profile.max_position_size;
        
        position_value.min(max_position_value)
    }

    pub async fn add_position(
        &self,
        symbol: String,
        position_size: f64,
        entry_price: f64,
        stop_loss: Option<f64>,
        take_profit: Option<f64>,
    ) {
        let profile = self.risk_profile.read().await;
        let risk_amount = position_size * entry_price * profile.stop_loss_percentage;
        let var_95 = self.calculate_var(symbol.clone(), position_size, entry_price).await;
        
        let position_risk = PositionRisk {
            symbol: symbol.clone(),
            position_size,
            entry_price,
            current_price: entry_price,
            unrealized_pnl: 0.0,
            risk_amount,
            var_95,
            stop_loss,
            take_profit,
            correlation_group: self.get_correlation_group(&symbol).await,
        };
        
        let mut positions = self.position_risks.write().await;
        positions.insert(symbol, position_risk);
    }

    pub async fn update_position_price(&self, symbol: &str, current_price: f64) {
        let mut positions = self.position_risks.write().await;
        
        if let Some(position) = positions.get_mut(symbol) {
            position.current_price = current_price;
            position.unrealized_pnl = (current_price - position.entry_price) * position.position_size;
            position.var_95 = self.calculate_var(symbol.to_string(), position.position_size, current_price).await;
        }
    }

    pub async fn check_stop_loss(&self, symbol: &str) -> bool {
        let positions = self.position_risks.read().await;
        
        if let Some(position) = positions.get(symbol) {
            if let Some(stop_loss) = position.stop_loss {
                return position.current_price <= stop_loss;
            }
        }
        
        false
    }

    pub async fn check_take_profit(&self, symbol: &str) -> bool {
        let positions = self.position_risks.read().await;
        
        if let Some(position) = positions.get(symbol) {
            if let Some(take_profit) = position.take_profit {
                return position.current_price >= take_profit;
            }
        }
        
        false
    }

    pub async fn calculate_portfolio_risk(&self, portfolio_value: f64) -> PortfolioRisk {
        let positions = self.position_risks.read().await;
        let position_list: Vec<PositionRisk> = positions.values().cloned().collect();
        
        let total_risk: f64 = position_list.iter().map(|p| p.risk_amount).sum();
        let var_95 = self.calculate_portfolio_var(&position_list).await;
        let cvar_95 = var_95 * 1.2; // Simplified CVaR calculation
        
        let (sharpe_ratio, sortino_ratio) = self.calculate_risk_ratios().await;
        let (max_drawdown, current_drawdown) = self.calculate_drawdowns(portfolio_value).await;
        let daily_pnl = self.calculate_daily_pnl().await;
        let risk_adjusted_return = daily_pnl / (var_95 + 0.0001);
        
        PortfolioRisk {
            total_value: portfolio_value,
            total_risk,
            var_95,
            cvar_95,
            sharpe_ratio,
            sortino_ratio,
            max_drawdown,
            current_drawdown,
            daily_pnl,
            risk_adjusted_return,
            positions: position_list,
        }
    }

    async fn calculate_var(&self, symbol: String, position_size: f64, current_price: f64) -> f64 {
        // Simplified VaR calculation using historical volatility
        let volatility = 0.02; // 2% daily volatility placeholder
        let confidence_level = 1.645; // 95% confidence
        
        position_size * current_price * volatility * confidence_level
    }

    async fn calculate_portfolio_var(&self, positions: &[PositionRisk]) -> f64 {
        // Simplified portfolio VaR considering correlations
        let correlations = self.correlation_matrix.read().await;
        let mut portfolio_var = 0.0;
        
        for i in 0..positions.len() {
            for j in 0..positions.len() {
                let correlation = if i == j {
                    1.0
                } else {
                    correlations.get(&(positions[i].symbol.clone(), positions[j].symbol.clone()))
                        .copied()
                        .unwrap_or(0.3) // Default correlation
                };
                
                portfolio_var += positions[i].var_95 * positions[j].var_95 * correlation;
            }
        }
        
        portfolio_var.sqrt()
    }

    async fn calculate_risk_ratios(&self) -> (f64, f64) {
        let history = self.daily_pnl_history.read().await;
        
        if history.len() < 30 {
            return (0.0, 0.0);
        }
        
        let returns: Vec<f64> = history.iter().map(|(_, pnl)| *pnl).collect();
        let avg_return = returns.iter().sum::<f64>() / returns.len() as f64;
        
        // Standard deviation
        let variance = returns.iter()
            .map(|r| (r - avg_return).powi(2))
            .sum::<f64>() / returns.len() as f64;
        let std_dev = variance.sqrt();
        
        // Downside deviation
        let downside_returns: Vec<f64> = returns.iter()
            .filter(|&&r| r < 0.0)
            .copied()
            .collect();
        
        let downside_variance = if !downside_returns.is_empty() {
            downside_returns.iter()
                .map(|r| r.powi(2))
                .sum::<f64>() / downside_returns.len() as f64
        } else {
            0.0
        };
        let downside_dev = downside_variance.sqrt();
        
        let sharpe_ratio = if std_dev > 0.0 {
            (avg_return / std_dev) * (252.0_f64).sqrt() // Annualized
        } else {
            0.0
        };
        
        let sortino_ratio = if downside_dev > 0.0 {
            (avg_return / downside_dev) * (252.0_f64).sqrt() // Annualized
        } else {
            0.0
        };
        
        (sharpe_ratio, sortino_ratio)
    }

    async fn calculate_drawdowns(&self, current_value: f64) -> (f64, f64) {
        let history = self.portfolio_history.read().await;
        
        if history.is_empty() {
            return (0.0, 0.0);
        }
        
        let mut max_drawdown = 0.0;
        let mut peak = history[0].1;
        let mut current_peak = peak;
        
        for (_, value) in history.iter() {
            if *value > peak {
                peak = *value;
            }
            if *value > current_peak {
                current_peak = *value;
            }
            
            let drawdown = (peak - value) / peak;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
        }
        
        let current_drawdown = (current_peak - current_value) / current_peak;
        
        (max_drawdown, current_drawdown.max(0.0))
    }

    async fn calculate_daily_pnl(&self) -> f64 {
        let history = self.daily_pnl_history.read().await;
        let today = chrono::Utc::now().timestamp() as u64;
        let day_start = today - (today % 86400);
        
        history.iter()
            .filter(|(timestamp, _)| *timestamp >= day_start)
            .map(|(_, pnl)| *pnl)
            .sum()
    }

    async fn get_correlation_group(&self, symbol: &str) -> Option<String> {
        // Group correlated assets
        if symbol.contains("BTC") || symbol.contains("ETH") {
            Some("CRYPTO_MAJOR".to_string())
        } else if symbol.contains("SOL") || symbol.contains("AVAX") {
            Some("CRYPTO_ALT".to_string())
        } else {
            None
        }
    }

    pub async fn update_portfolio_value(&self, value: f64) {
        let mut history = self.portfolio_history.write().await;
        let timestamp = chrono::Utc::now().timestamp() as u64;
        
        history.push((timestamp, value));
        
        // Keep last 30 days
        let cutoff = timestamp - (30 * 86400);
        history.retain(|(ts, _)| *ts > cutoff);
    }

    pub async fn record_daily_pnl(&self, pnl: f64) {
        let mut history = self.daily_pnl_history.write().await;
        let timestamp = chrono::Utc::now().timestamp() as u64;
        
        history.push((timestamp, pnl));
        
        // Keep last 90 days
        let cutoff = timestamp - (90 * 86400);
        history.retain(|(ts, _)| *ts > cutoff);
    }
}

// Position sizing strategies
pub struct PositionSizer {
    risk_manager: Arc<RiskManager>,
}

impl PositionSizer {
    pub fn new(risk_manager: Arc<RiskManager>) -> Self {
        Self { risk_manager }
    }

    pub async fn kelly_criterion(
        &self,
        win_probability: f64,
        win_loss_ratio: f64,
        portfolio_value: f64,
    ) -> f64 {
        let q = 1.0 - win_probability;
        let kelly_percentage = (win_probability * win_loss_ratio - q) / win_loss_ratio;
        
        // Apply Kelly fraction (usually 0.25 to be conservative)
        let adjusted_kelly = kelly_percentage * 0.25;
        
        portfolio_value * adjusted_kelly.max(0.0).min(0.1) // Cap at 10%
    }

    pub async fn fixed_fractional(
        &self,
        risk_percentage: f64,
        stop_loss_distance: f64,
        portfolio_value: f64,
    ) -> f64 {
        let risk_amount = portfolio_value * risk_percentage;
        risk_amount / stop_loss_distance
    }

    pub async fn volatility_based(
        &self,
        target_volatility: f64,
        asset_volatility: f64,
        portfolio_value: f64,
    ) -> f64 {
        let volatility_ratio = target_volatility / asset_volatility;
        portfolio_value * volatility_ratio.min(0.2) // Cap at 20%
    }
}

// Stop loss and take profit strategies
pub struct ExitStrategyManager {
    risk_manager: Arc<RiskManager>,
}

impl ExitStrategyManager {
    pub fn new(risk_manager: Arc<RiskManager>) -> Self {
        Self { risk_manager }
    }

    pub fn calculate_atr_stop_loss(&self, atr: f64, multiplier: f64, entry_price: f64, is_long: bool) -> f64 {
        if is_long {
            entry_price - (atr * multiplier)
        } else {
            entry_price + (atr * multiplier)
        }
    }

    pub fn calculate_percentage_stop_loss(&self, percentage: f64, entry_price: f64, is_long: bool) -> f64 {
        if is_long {
            entry_price * (1.0 - percentage)
        } else {
            entry_price * (1.0 + percentage)
        }
    }

    pub fn calculate_risk_reward_take_profit(
        &self,
        entry_price: f64,
        stop_loss: f64,
        risk_reward_ratio: f64,
        is_long: bool,
    ) -> f64 {
        let risk = (entry_price - stop_loss).abs();
        
        if is_long {
            entry_price + (risk * risk_reward_ratio)
        } else {
            entry_price - (risk * risk_reward_ratio)
        }
    }

    pub fn trailing_stop_loss(
        &self,
        current_price: f64,
        highest_price: f64,
        trail_percentage: f64,
        is_long: bool,
    ) -> f64 {
        if is_long {
            highest_price * (1.0 - trail_percentage)
        } else {
            current_price * (1.0 + trail_percentage)
        }
    }
}
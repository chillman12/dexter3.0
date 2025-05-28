use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricePrediction {
    pub symbol: String,
    pub current_price: f64,
    pub predicted_price: f64,
    pub confidence: f64,
    pub timeframe: String,
    pub direction: PriceDirection,
    pub features_used: Vec<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PriceDirection {
    Up,
    Down,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MEVDetection {
    pub transaction_hash: String,
    pub attack_type: MEVAttackType,
    pub probability: f64,
    pub victim_address: Option<String>,
    pub attacker_address: Option<String>,
    pub estimated_profit: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MEVAttackType {
    Sandwich,
    Frontrun,
    Backrun,
    JITLiquidity,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingSignal {
    pub symbol: String,
    pub action: SignalAction,
    pub strength: f64,
    pub entry_price: f64,
    pub stop_loss: f64,
    pub take_profit: f64,
    pub risk_reward_ratio: f64,
    pub timeframe: String,
    pub indicators: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SignalAction {
    StrongBuy,
    Buy,
    Hold,
    Sell,
    StrongSell,
}

// Feature extraction for ML models
pub struct FeatureExtractor {
    technical_indicators: Arc<TechnicalIndicators>,
}

impl FeatureExtractor {
    pub fn new() -> Self {
        Self {
            technical_indicators: Arc::new(TechnicalIndicators::new()),
        }
    }

    pub async fn extract_price_features(
        &self,
        candles: &[crate::historical_data::OHLCV],
    ) -> HashMap<String, f64> {
        let mut features = HashMap::new();
        
        if candles.len() < 50 {
            return features;
        }
        
        // Price-based features
        let prices: Vec<f64> = candles.iter().map(|c| c.close).collect();
        let volumes: Vec<f64> = candles.iter().map(|c| c.volume).collect();
        
        // Moving averages
        features.insert("sma_10".to_string(), self.technical_indicators.sma(&prices, 10));
        features.insert("sma_20".to_string(), self.technical_indicators.sma(&prices, 20));
        features.insert("sma_50".to_string(), self.technical_indicators.sma(&prices, 50));
        
        // RSI
        features.insert("rsi_14".to_string(), self.technical_indicators.rsi(&prices, 14));
        
        // MACD
        let (macd, signal, histogram) = self.technical_indicators.macd(&prices, 12, 26, 9);
        features.insert("macd".to_string(), macd);
        features.insert("macd_signal".to_string(), signal);
        features.insert("macd_histogram".to_string(), histogram);
        
        // Bollinger Bands
        let (upper, middle, lower) = self.technical_indicators.bollinger_bands(&prices, 20, 2.0);
        features.insert("bb_upper".to_string(), upper);
        features.insert("bb_middle".to_string(), middle);
        features.insert("bb_lower".to_string(), lower);
        
        // Volume features
        features.insert("volume_sma_10".to_string(), self.technical_indicators.sma(&volumes, 10));
        features.insert("volume_ratio".to_string(), volumes.last().unwrap() / self.technical_indicators.sma(&volumes, 10));
        
        // Price momentum
        let momentum = (prices.last().unwrap() - prices[prices.len() - 10]) / prices[prices.len() - 10];
        features.insert("momentum_10".to_string(), momentum);
        
        // Volatility
        features.insert("volatility".to_string(), self.calculate_volatility(&prices));
        
        features
    }

    pub async fn extract_mev_features(
        &self,
        tx: &TransactionData,
        mempool: &[TransactionData],
    ) -> HashMap<String, f64> {
        let mut features = HashMap::new();
        
        // Transaction features
        features.insert("gas_price".to_string(), tx.gas_price);
        features.insert("value".to_string(), tx.value);
        features.insert("nonce".to_string(), tx.nonce as f64);
        
        // Mempool features
        let similar_txs: Vec<&TransactionData> = mempool.iter()
            .filter(|t| t.to == tx.to && (t.timestamp - tx.timestamp).abs() < 5000)
            .collect();
        
        features.insert("similar_tx_count".to_string(), similar_txs.len() as f64);
        
        if !similar_txs.is_empty() {
            let avg_gas: f64 = similar_txs.iter().map(|t| t.gas_price).sum::<f64>() / similar_txs.len() as f64;
            features.insert("gas_price_ratio".to_string(), tx.gas_price / avg_gas);
        }
        
        // Timing features
        features.insert("block_position".to_string(), tx.block_position as f64);
        features.insert("time_since_block".to_string(), tx.time_since_block as f64);
        
        features
    }

    fn calculate_volatility(&self, prices: &[f64]) -> f64 {
        let returns: Vec<f64> = prices.windows(2)
            .map(|w| (w[1] - w[0]) / w[0])
            .collect();
        
        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
        variance.sqrt()
    }
}

// Technical indicators implementation
pub struct TechnicalIndicators;

impl TechnicalIndicators {
    pub fn new() -> Self {
        Self
    }

    pub fn sma(&self, data: &[f64], period: usize) -> f64 {
        if data.len() < period {
            return 0.0;
        }
        let sum: f64 = data[data.len() - period..].iter().sum();
        sum / period as f64
    }

    pub fn ema(&self, data: &[f64], period: usize) -> f64 {
        if data.is_empty() {
            return 0.0;
        }
        
        let multiplier = 2.0 / (period as f64 + 1.0);
        let mut ema = data[0];
        
        for i in 1..data.len() {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        ema
    }

    pub fn rsi(&self, prices: &[f64], period: usize) -> f64 {
        if prices.len() < period + 1 {
            return 50.0;
        }
        
        let mut gains = 0.0;
        let mut losses = 0.0;
        
        for i in prices.len() - period..prices.len() {
            let change = prices[i] - prices[i - 1];
            if change > 0.0 {
                gains += change;
            } else {
                losses += change.abs();
            }
        }
        
        let avg_gain = gains / period as f64;
        let avg_loss = losses / period as f64;
        
        if avg_loss == 0.0 {
            return 100.0;
        }
        
        let rs = avg_gain / avg_loss;
        100.0 - (100.0 / (1.0 + rs))
    }

    pub fn macd(&self, prices: &[f64], fast: usize, slow: usize, signal: usize) -> (f64, f64, f64) {
        let ema_fast = self.ema(prices, fast);
        let ema_slow = self.ema(prices, slow);
        let macd_line = ema_fast - ema_slow;
        
        // Simplified signal line calculation
        let signal_line = macd_line * 0.9; // Placeholder
        let histogram = macd_line - signal_line;
        
        (macd_line, signal_line, histogram)
    }

    pub fn bollinger_bands(&self, prices: &[f64], period: usize, std_dev: f64) -> (f64, f64, f64) {
        let sma = self.sma(prices, period);
        
        let variance = prices[prices.len() - period..]
            .iter()
            .map(|p| (p - sma).powi(2))
            .sum::<f64>() / period as f64;
        let std = variance.sqrt();
        
        let upper = sma + (std_dev * std);
        let lower = sma - (std_dev * std);
        
        (upper, sma, lower)
    }
}

// ML Models
pub struct PricePredictionModel {
    features: Arc<FeatureExtractor>,
    model_weights: HashMap<String, f64>,
}

impl PricePredictionModel {
    pub fn new() -> Self {
        let mut model_weights = HashMap::new();
        // Placeholder weights - in production, these would be loaded from a trained model
        model_weights.insert("sma_10".to_string(), 0.15);
        model_weights.insert("sma_20".to_string(), 0.10);
        model_weights.insert("rsi_14".to_string(), 0.20);
        model_weights.insert("macd".to_string(), 0.25);
        model_weights.insert("volume_ratio".to_string(), 0.15);
        model_weights.insert("momentum_10".to_string(), 0.15);
        
        Self {
            features: Arc::new(FeatureExtractor::new()),
            model_weights,
        }
    }

    pub async fn predict(
        &self,
        symbol: &str,
        candles: &[crate::historical_data::OHLCV],
        timeframe: &str,
    ) -> PricePrediction {
        let features = self.features.extract_price_features(candles).await;
        let current_price = candles.last().map(|c| c.close).unwrap_or(0.0);
        
        // Simple linear prediction model (placeholder)
        let mut score = 0.0;
        for (feature, value) in &features {
            if let Some(weight) = self.model_weights.get(feature) {
                score += value * weight;
            }
        }
        
        // Normalize score to price prediction
        let price_change_pct = (score - 50.0) / 100.0 * 0.02; // Max 2% change
        let predicted_price = current_price * (1.0 + price_change_pct);
        
        let direction = if price_change_pct > 0.001 {
            PriceDirection::Up
        } else if price_change_pct < -0.001 {
            PriceDirection::Down
        } else {
            PriceDirection::Neutral
        };
        
        let confidence = 0.5 + (score - 50.0).abs() / 100.0;
        
        PricePrediction {
            symbol: symbol.to_string(),
            current_price,
            predicted_price,
            confidence,
            timeframe: timeframe.to_string(),
            direction,
            features_used: features.keys().cloned().collect(),
            timestamp: chrono::Utc::now().timestamp() as u64,
        }
    }
}

pub struct MEVDetectionModel {
    features: Arc<FeatureExtractor>,
    threshold: f64,
}

impl MEVDetectionModel {
    pub fn new() -> Self {
        Self {
            features: Arc::new(FeatureExtractor::new()),
            threshold: 0.7,
        }
    }

    pub async fn detect_mev(
        &self,
        tx: &TransactionData,
        mempool: &[TransactionData],
    ) -> Option<MEVDetection> {
        let features = self.features.extract_mev_features(tx, mempool).await;
        
        // Simple rule-based detection (placeholder for ML model)
        let mut mev_score = 0.0;
        
        // High gas price relative to others
        if let Some(gas_ratio) = features.get("gas_price_ratio") {
            if *gas_ratio > 1.5 {
                mev_score += 0.3;
            }
        }
        
        // Multiple similar transactions
        if let Some(similar_count) = features.get("similar_tx_count") {
            if *similar_count > 2.0 {
                mev_score += 0.4;
            }
        }
        
        // Position in block
        if let Some(position) = features.get("block_position") {
            if *position < 5.0 {
                mev_score += 0.3;
            }
        }
        
        if mev_score > self.threshold {
            let attack_type = if features.get("similar_tx_count").unwrap_or(&0.0) > &2.0 {
                MEVAttackType::Sandwich
            } else if features.get("block_position").unwrap_or(&100.0) < &3.0 {
                MEVAttackType::Frontrun
            } else {
                MEVAttackType::Unknown
            };
            
            Some(MEVDetection {
                transaction_hash: tx.hash.clone(),
                attack_type,
                probability: mev_score,
                victim_address: None,
                attacker_address: None,
                estimated_profit: tx.value * 0.01, // Placeholder
                timestamp: chrono::Utc::now().timestamp() as u64,
            })
        } else {
            None
        }
    }
}

pub struct TradingSignalGenerator {
    price_model: Arc<PricePredictionModel>,
    indicators: Arc<TechnicalIndicators>,
}

impl TradingSignalGenerator {
    pub fn new() -> Self {
        Self {
            price_model: Arc::new(PricePredictionModel::new()),
            indicators: Arc::new(TechnicalIndicators::new()),
        }
    }

    pub async fn generate_signal(
        &self,
        symbol: &str,
        candles: &[crate::historical_data::OHLCV],
        timeframe: &str,
    ) -> Option<TradingSignal> {
        if candles.len() < 50 {
            return None;
        }
        
        let prediction = self.price_model.predict(symbol, candles, timeframe).await;
        let prices: Vec<f64> = candles.iter().map(|c| c.close).collect();
        
        // Calculate indicators
        let mut indicators = HashMap::new();
        indicators.insert("rsi".to_string(), self.indicators.rsi(&prices, 14));
        indicators.insert("sma_20".to_string(), self.indicators.sma(&prices, 20));
        indicators.insert("sma_50".to_string(), self.indicators.sma(&prices, 50));
        
        let current_price = prices.last().unwrap();
        let rsi = indicators.get("rsi").unwrap();
        let sma_20 = indicators.get("sma_20").unwrap();
        let sma_50 = indicators.get("sma_50").unwrap();
        
        // Generate signal based on multiple factors
        let action = if *rsi < 30.0 && current_price < sma_20 && prediction.direction == PriceDirection::Up {
            SignalAction::StrongBuy
        } else if *rsi < 40.0 && prediction.direction == PriceDirection::Up {
            SignalAction::Buy
        } else if *rsi > 70.0 && current_price > sma_20 && prediction.direction == PriceDirection::Down {
            SignalAction::StrongSell
        } else if *rsi > 60.0 && prediction.direction == PriceDirection::Down {
            SignalAction::Sell
        } else {
            SignalAction::Hold
        };
        
        let strength = match action {
            SignalAction::StrongBuy | SignalAction::StrongSell => 0.9,
            SignalAction::Buy | SignalAction::Sell => 0.7,
            SignalAction::Hold => 0.5,
        };
        
        let stop_loss = match action {
            SignalAction::Buy | SignalAction::StrongBuy => current_price * 0.98,
            SignalAction::Sell | SignalAction::StrongSell => current_price * 1.02,
            SignalAction::Hold => current_price,
        };
        
        let take_profit = match action {
            SignalAction::Buy | SignalAction::StrongBuy => current_price * 1.03,
            SignalAction::Sell | SignalAction::StrongSell => current_price * 0.97,
            SignalAction::Hold => current_price,
        };
        
        let risk_reward_ratio = (take_profit - current_price).abs() / (current_price - stop_loss).abs();
        
        Some(TradingSignal {
            symbol: symbol.to_string(),
            action,
            strength,
            entry_price: *current_price,
            stop_loss,
            take_profit,
            risk_reward_ratio,
            timeframe: timeframe.to_string(),
            indicators,
        })
    }
}

// Helper structures
#[derive(Debug, Clone)]
pub struct TransactionData {
    pub hash: String,
    pub from: String,
    pub to: String,
    pub value: f64,
    pub gas_price: f64,
    pub nonce: u64,
    pub timestamp: u64,
    pub block_position: u32,
    pub time_since_block: u64,
}
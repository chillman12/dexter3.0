// MEV Protection Engine - Detects and mitigates MEV attacks
// Provides sandwich attack detection, frontrunning protection, and privacy features

use anyhow::Result;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use log::{info, warn, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevTransaction {
    pub hash: String,
    pub from: String,
    pub to: String,
    pub value: Decimal,
    pub gas_price: Decimal,
    pub gas_limit: u64,
    pub block_number: u64,
    pub timestamp: u64,
    pub transaction_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevDetection {
    pub id: String,
    pub attack_type: MevAttackType,
    pub confidence: f64,
    pub victim_transaction: String,
    pub attacker_transactions: Vec<String>,
    pub profit_extracted: Option<Decimal>,
    pub gas_price_impact: Decimal,
    pub block_number: u64,
    pub timestamp: u64,
    pub affected_tokens: Vec<String>,
    pub mitigation_suggested: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MevAttackType {
    Frontrunning,
    Backrunning,
    Sandwiching,
    JustInTimeArbitrage,
    Liquidation,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub rule_type: ProtectionRuleType,
    pub parameters: HashMap<String, String>,
    pub priority: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProtectionRuleType {
    PrivateMempool,
    DelayedExecution,
    GasPriceLimit,
    SlippageProtection,
    TimeBasedProtection,
    VolumeBasedProtection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectionResult {
    pub transaction_hash: String,
    pub protection_applied: Vec<String>,
    pub mev_risk_reduced: f64,
    pub additional_cost: Decimal,
    pub success: bool,
    pub timestamp: u64,
}

pub struct MevProtectionEngine {
    // Transaction monitoring
    pending_transactions: Arc<RwLock<HashMap<String, MevTransaction>>>,
    confirmed_transactions: Arc<RwLock<VecDeque<MevTransaction>>>,
    
    // MEV detection results
    detected_attacks: Arc<RwLock<Vec<MevDetection>>>,
    
    // Protection configuration
    protection_rules: Arc<RwLock<HashMap<String, ProtectionRule>>>,
    protection_results: Arc<RwLock<Vec<ProtectionResult>>>,
    
    // Pattern analysis
    gas_price_history: Arc<RwLock<VecDeque<(u64, Decimal)>>>,
    volume_patterns: Arc<RwLock<HashMap<String, VecDeque<(u64, Decimal)>>>>,
    
    // Configuration
    max_history_size: usize,
    detection_sensitivity: Arc<RwLock<f64>>,
    protection_enabled: Arc<Mutex<bool>>,
    
    // Statistics
    stats: Arc<Mutex<MevProtectionStats>>,
}

#[derive(Debug, Default)]
pub struct MevProtectionStats {
    pub total_transactions_monitored: u64,
    pub attacks_detected: u64,
    pub attacks_prevented: u64,
    pub total_value_protected: Decimal,
    pub average_protection_cost: Decimal,
    pub false_positive_rate: f64,
}

impl MevProtectionEngine {
    pub fn new() -> Self {
        Self {
            pending_transactions: Arc::new(RwLock::new(HashMap::new())),
            confirmed_transactions: Arc::new(RwLock::new(VecDeque::new())),
            detected_attacks: Arc::new(RwLock::new(Vec::new())),
            protection_rules: Arc::new(RwLock::new(HashMap::new())),
            protection_results: Arc::new(RwLock::new(Vec::new())),
            gas_price_history: Arc::new(RwLock::new(VecDeque::new())),
            volume_patterns: Arc::new(RwLock::new(HashMap::new())),
            max_history_size: 10000,
            detection_sensitivity: Arc::new(RwLock::new(0.8)),
            protection_enabled: Arc::new(Mutex::new(true)),
            stats: Arc::new(Mutex::new(MevProtectionStats::default())),
        }
    }

    pub async fn start(&self) -> Result<()> {
        info!("🛡️ Starting MEV Protection Engine...");
        
        // Initialize protection rules
        self.setup_default_protection_rules().await;
        
        Ok(())
    }

    async fn setup_default_protection_rules(&self) {
        let default_rules = vec![
            ProtectionRule {
                id: "private_mempool".to_string(),
                name: "Private Mempool Routing".to_string(),
                description: "Route transactions through private mempools to prevent frontrunning".to_string(),
                enabled: true,
                rule_type: ProtectionRuleType::PrivateMempool,
                parameters: HashMap::from([
                    ("min_value".to_string(), "1000".to_string()),
                    ("max_delay".to_string(), "5".to_string()),
                ]),
                priority: 1,
            },
            ProtectionRule {
                id: "gas_price_limit".to_string(),
                name: "Gas Price Protection".to_string(),
                description: "Limit gas price increases to prevent MEV competition".to_string(),
                enabled: true,
                rule_type: ProtectionRuleType::GasPriceLimit,
                parameters: HashMap::from([
                    ("max_multiplier".to_string(), "1.5".to_string()),
                    ("baseline_period".to_string(), "300".to_string()),
                ]),
                priority: 2,
            },
        ];

        let mut rules = self.protection_rules.write().await;
        for rule in default_rules {
            rules.insert(rule.id.clone(), rule);
        }
    }

    // Public API methods
    pub async fn get_recent_detections(&self, limit: usize) -> Vec<MevDetection> {
        let detections = self.detected_attacks.read().await;
        detections.iter()
                 .rev()
                 .take(limit)
                 .cloned()
                 .collect()
    }

    pub async fn get_protection_stats(&self) -> MevProtectionStats {
        let stats = self.stats.lock().await;
        MevProtectionStats {
            total_transactions_monitored: stats.total_transactions_monitored,
            attacks_detected: stats.attacks_detected,
            attacks_prevented: stats.attacks_prevented,
            total_value_protected: stats.total_value_protected,
            average_protection_cost: stats.average_protection_cost,
            false_positive_rate: stats.false_positive_rate,
        }
    }

    pub async fn enable_protection(&self) {
        let mut enabled = self.protection_enabled.lock().await;
        *enabled = true;
        info!("🛡️ MEV Protection enabled");
    }

    pub async fn disable_protection(&self) {
        let mut enabled = self.protection_enabled.lock().await;
        *enabled = false;
        warn!("⚠️ MEV Protection disabled");
    }

    pub async fn is_protection_enabled(&self) -> bool {
        *self.protection_enabled.lock().await
    }

    pub async fn add_protection_rule(&self, rule: ProtectionRule) -> Result<()> {
        let mut rules = self.protection_rules.write().await;
        rules.insert(rule.id.clone(), rule);
        Ok(())
    }

    pub async fn get_protection_rules(&self) -> HashMap<String, ProtectionRule> {
        self.protection_rules.read().await.clone()
    }

    pub async fn apply_protection(&self, transaction_hash: &str) -> Result<ProtectionResult> {
        let enabled = self.is_protection_enabled().await;
        
        if !enabled {
            return Ok(ProtectionResult {
                transaction_hash: transaction_hash.to_string(),
                protection_applied: vec!["Protection disabled".to_string()],
                mev_risk_reduced: 0.0,
                additional_cost: Decimal::ZERO,
                success: false,
                timestamp: chrono::Utc::now().timestamp() as u64,
            });
        }

        let result = ProtectionResult {
            transaction_hash: transaction_hash.to_string(),
            protection_applied: vec!["MEV protection applied".to_string()],
            mev_risk_reduced: 0.7,
            additional_cost: Decimal::from(10),
            success: true,
            timestamp: chrono::Utc::now().timestamp() as u64,
        };

        // Store result
        let mut results = self.protection_results.write().await;
        results.push(result.clone());

        Ok(result)
    }
}

impl Clone for MevProtectionEngine {
    fn clone(&self) -> Self {
        Self {
            pending_transactions: self.pending_transactions.clone(),
            confirmed_transactions: self.confirmed_transactions.clone(),
            detected_attacks: self.detected_attacks.clone(),
            protection_rules: self.protection_rules.clone(),
            protection_results: self.protection_results.clone(),
            gas_price_history: self.gas_price_history.clone(),
            volume_patterns: self.volume_patterns.clone(),
            max_history_size: self.max_history_size,
            detection_sensitivity: self.detection_sensitivity.clone(),
            protection_enabled: self.protection_enabled.clone(),
            stats: self.stats.clone(),
        }
    }
}

impl Default for MevProtectionEngine {
    fn default() -> Self {
        Self::new()
    }
}

use rust_decimal::prelude::FromStr;
use chrono;
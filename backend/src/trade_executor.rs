use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

use crate::dex_connectors::{DexAggregator, ArbitrageRoute};
use crate::wallet_manager::{WalletManager, TransactionType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeOrder {
    pub id: String,
    pub wallet: String,
    pub order_type: OrderType,
    pub side: OrderSide,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: f64,
    pub amount_out_min: f64,
    pub slippage: f64,
    pub status: OrderStatus,
    pub dex: Option<String>,
    pub route: Option<Vec<String>>,
    pub gas_price: Option<f64>,
    pub deadline: u64,
    pub created_at: u64,
    pub executed_at: Option<u64>,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    TakeProfit,
    TrailingStop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
    Swap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Submitted,
    PartiallyFilled,
    Filled,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub order_id: String,
    pub tx_hash: String,
    pub amount_in: f64,
    pub amount_out: f64,
    pub gas_used: f64,
    pub execution_price: f64,
    pub slippage: f64,
    pub profit_loss: f64,
}

pub struct TradeExecutor {
    orders: Arc<RwLock<HashMap<String, TradeOrder>>>,
    dex_aggregator: Arc<DexAggregator>,
    wallet_manager: Arc<WalletManager>,
    execution_history: Arc<RwLock<Vec<ExecutionResult>>>,
}

impl TradeExecutor {
    pub fn new(
        dex_aggregator: Arc<DexAggregator>,
        wallet_manager: Arc<WalletManager>,
    ) -> Self {
        Self {
            orders: Arc::new(RwLock::new(HashMap::new())),
            dex_aggregator,
            wallet_manager,
            execution_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn create_order(&self, order: TradeOrder) -> Result<String, String> {
        // Validate order
        self.validate_order(&order).await?;
        
        let order_id = order.id.clone();
        let mut orders = self.orders.write().await;
        orders.insert(order_id.clone(), order);
        
        Ok(order_id)
    }

    async fn validate_order(&self, order: &TradeOrder) -> Result<(), String> {
        // Check wallet connection
        if let Some(wallet) = self.wallet_manager.get_wallet(&order.wallet).await {
            if !wallet.connected {
                return Err("Wallet not connected".to_string());
            }
            
            // Check balance
            if order.side == OrderSide::Swap || order.side == OrderSide::Sell {
                let token_balance = wallet.tokens.get(&order.token_in)
                    .map(|t| t.balance)
                    .unwrap_or(0.0);
                    
                if token_balance < order.amount_in {
                    return Err(format!("Insufficient {} balance", order.token_in));
                }
            }
        } else {
            return Err("Wallet not found".to_string());
        }
        
        // Validate slippage
        if order.slippage > 50.0 {
            return Err("Slippage too high (max 50%)".to_string());
        }
        
        Ok(())
    }

    pub async fn execute_order(&self, order_id: &str) -> Result<ExecutionResult, String> {
        let mut orders = self.orders.write().await;
        let order = orders.get_mut(order_id)
            .ok_or("Order not found")?;
        
        // Update order status
        order.status = OrderStatus::Submitted;
        
        // Get best execution route
        let (best_dex, quote) = self.get_best_execution_route(
            &order.token_in,
            &order.token_out,
            order.amount_in
        ).await?;
        
        // Check slippage
        let expected_out = order.amount_out_min;
        let actual_slippage = ((expected_out - quote) / expected_out).abs() * 100.0;
        
        if actual_slippage > order.slippage {
            order.status = OrderStatus::Failed;
            order.error = Some(format!("Slippage too high: {:.2}%", actual_slippage));
            return Err("Slippage tolerance exceeded".to_string());
        }
        
        // Create transaction
        let tx = self.wallet_manager.create_transaction(
            order.wallet.clone(),
            TransactionType::Swap,
            order.amount_in,
            order.token_in.clone(),
            serde_json::json!({
                "token_out": order.token_out.clone(),
                "amount_out": quote,
                "dex": best_dex.clone(),
            })
        ).await?;
        
        // Execute swap on DEX
        if let Some(connector) = self.dex_aggregator.connectors.get(&best_dex) {
            match connector.execute_swap(
                &order.token_in,
                &order.token_out,
                order.amount_in,
                order.slippage
            ).await {
                Ok(tx_hash) => {
                    order.status = OrderStatus::Filled;
                    order.executed_at = Some(chrono::Utc::now().timestamp() as u64);
                    order.tx_hash = Some(tx_hash.clone());
                    order.dex = Some(best_dex);
                    
                    let result = ExecutionResult {
                        order_id: order_id.to_string(),
                        tx_hash,
                        amount_in: order.amount_in,
                        amount_out: quote,
                        gas_used: 0.000005,
                        execution_price: quote / order.amount_in,
                        slippage: actual_slippage,
                        profit_loss: quote - expected_out,
                    };
                    
                    // Update wallet balances
                    self.wallet_manager.update_wallet_balances(&order.wallet).await?;
                    
                    // Store execution history
                    let mut history = self.execution_history.write().await;
                    history.push(result.clone());
                    
                    Ok(result)
                },
                Err(e) => {
                    order.status = OrderStatus::Failed;
                    order.error = Some(e.to_string());
                    Err(e.to_string())
                }
            }
        } else {
            Err("DEX connector not found".to_string())
        }
    }

    async fn get_best_execution_route(
        &self,
        token_in: &str,
        token_out: &str,
        amount: f64
    ) -> Result<(String, f64), String> {
        let mut best_quote = 0.0;
        let mut best_dex = String::new();
        
        for (dex_name, connector) in &self.dex_aggregator.connectors {
            if let Ok(quote) = connector.get_swap_quote(token_in, token_out, amount).await {
                if quote > best_quote {
                    best_quote = quote;
                    best_dex = dex_name.clone();
                }
            }
        }
        
        if best_quote > 0.0 {
            Ok((best_dex, best_quote))
        } else {
            Err("No valid quotes found".to_string())
        }
    }

    pub async fn execute_arbitrage(&self, route: &ArbitrageRoute, wallet: &str) -> Result<ExecutionResult, String> {
        // Validate wallet has sufficient balance
        let wallet_data = self.wallet_manager.get_wallet(wallet).await
            .ok_or("Wallet not found")?;
        
        // Execute each hop in the arbitrage route
        let mut current_amount = route.input_amount;
        let mut tx_hashes = Vec::new();
        
        for (i, pool) in route.path.iter().enumerate() {
            let order = TradeOrder {
                id: format!("{}_{}", route.id, i),
                wallet: wallet.to_string(),
                order_type: OrderType::Market,
                side: OrderSide::Swap,
                token_in: if i == 0 { route.input_token.clone() } else { pool.token_a.clone() },
                token_out: pool.token_b.clone(),
                amount_in: current_amount,
                amount_out_min: current_amount * 0.95, // 5% slippage tolerance
                slippage: 5.0,
                status: OrderStatus::Pending,
                dex: Some(pool.dex.clone()),
                route: Some(route.path.iter().map(|p| p.dex.clone()).collect()),
                gas_price: None,
                deadline: chrono::Utc::now().timestamp() as u64 + 300, // 5 minutes
                created_at: chrono::Utc::now().timestamp() as u64,
                executed_at: None,
                tx_hash: None,
                error: None,
            };
            
            let order_id = self.create_order(order).await?;
            let result = self.execute_order(&order_id).await?;
            
            current_amount = result.amount_out;
            tx_hashes.push(result.tx_hash);
        }
        
        // Calculate final profit
        let profit = current_amount - route.input_amount;
        let gas_total = route.gas_cost;
        let net_profit = profit - gas_total;
        
        Ok(ExecutionResult {
            order_id: route.id.clone(),
            tx_hash: tx_hashes.join(","),
            amount_in: route.input_amount,
            amount_out: current_amount,
            gas_used: gas_total,
            execution_price: current_amount / route.input_amount,
            slippage: 0.0,
            profit_loss: net_profit,
        })
    }

    pub async fn cancel_order(&self, order_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write().await;
        
        if let Some(order) = orders.get_mut(order_id) {
            match order.status {
                OrderStatus::Pending | OrderStatus::Submitted => {
                    order.status = OrderStatus::Cancelled;
                    Ok(())
                },
                _ => Err("Order cannot be cancelled".to_string())
            }
        } else {
            Err("Order not found".to_string())
        }
    }

    pub async fn get_order(&self, order_id: &str) -> Option<TradeOrder> {
        let orders = self.orders.read().await;
        orders.get(order_id).cloned()
    }

    pub async fn get_wallet_orders(&self, wallet: &str) -> Vec<TradeOrder> {
        let orders = self.orders.read().await;
        orders.values()
            .filter(|o| o.wallet == wallet)
            .cloned()
            .collect()
    }

    pub async fn get_execution_history(&self, wallet: Option<&str>) -> Vec<ExecutionResult> {
        let history = self.execution_history.read().await;
        
        if let Some(wallet_addr) = wallet {
            let orders = self.orders.read().await;
            history.iter()
                .filter(|h| {
                    orders.get(&h.order_id)
                        .map(|o| o.wallet == wallet_addr)
                        .unwrap_or(false)
                })
                .cloned()
                .collect()
        } else {
            history.clone()
        }
    }
}

// Smart Order Router for optimal execution
pub struct SmartOrderRouter {
    executor: Arc<TradeExecutor>,
    routing_config: RoutingConfig,
}

#[derive(Debug, Clone)]
pub struct RoutingConfig {
    pub max_splits: usize,
    pub min_split_size: f64,
    pub price_impact_threshold: f64,
}

impl SmartOrderRouter {
    pub fn new(executor: Arc<TradeExecutor>) -> Self {
        Self {
            executor,
            routing_config: RoutingConfig {
                max_splits: 5,
                min_split_size: 10.0,
                price_impact_threshold: 1.0,
            },
        }
    }

    pub async fn route_order(&self, order: &TradeOrder) -> Result<Vec<TradeOrder>, String> {
        // Calculate optimal order splitting based on liquidity
        let splits = self.calculate_order_splits(order).await?;
        
        // Create sub-orders for each split
        let mut sub_orders = Vec::new();
        for (i, split) in splits.iter().enumerate() {
            let mut sub_order = order.clone();
            sub_order.id = format!("{}_{}", order.id, i);
            sub_order.amount_in = split.amount;
            sub_order.amount_out_min = split.expected_out;
            sub_order.dex = Some(split.dex.clone());
            
            sub_orders.push(sub_order);
        }
        
        Ok(sub_orders)
    }

    async fn calculate_order_splits(&self, order: &TradeOrder) -> Result<Vec<OrderSplit>, String> {
        // Placeholder for order splitting logic
        // Would analyze liquidity across DEXs and calculate optimal splits
        Ok(vec![
            OrderSplit {
                dex: "Jupiter".to_string(),
                amount: order.amount_in * 0.5,
                expected_out: order.amount_out_min * 0.5,
            },
            OrderSplit {
                dex: "Raydium".to_string(),
                amount: order.amount_in * 0.3,
                expected_out: order.amount_out_min * 0.3,
            },
            OrderSplit {
                dex: "Orca".to_string(),
                amount: order.amount_in * 0.2,
                expected_out: order.amount_out_min * 0.2,
            },
        ])
    }
}

#[derive(Debug, Clone)]
struct OrderSplit {
    dex: String,
    amount: f64,
    expected_out: f64,
}
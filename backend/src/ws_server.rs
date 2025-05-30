// WebSocket Server Module - Handles real-time data streaming to dashboard
// Provides live feeds for prices, opportunities, MEV threats, and market data

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use log::{info, warn, error, debug};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub data: serde_json::Value,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivePriceUpdate {
    pub pair: String,
    pub price: Decimal,
    pub change_24h: f64,
    pub volume_24h: Decimal,
    pub exchange: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveOpportunityUpdate {
    pub id: String,
    pub pair: String,
    pub profit_percentage: f64,
    pub estimated_profit: Decimal,
    pub exchanges: Vec<String>,
    pub risk_level: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveMevAlert {
    pub id: String,
    pub threat_type: String,
    pub risk_level: String,
    pub description: String,
    pub affected_tokens: Vec<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionRequest {
    pub action: String, // "subscribe" | "unsubscribe"
    pub channels: Vec<String>, // ["prices", "opportunities", "mev", "depth"]
    pub pairs: Option<Vec<String>>, // Optional filter for specific pairs
}

pub struct WebSocketServer {
    port: u16,
    active_connections: Arc<RwLock<HashMap<String, ClientConnection>>>,
    
    // Broadcasters from main platform
    price_receiver: broadcast::Receiver<crate::PriceInfo>,
    opportunity_receiver: broadcast::Receiver<crate::ArbitrageOpportunity>,
    
    // Internal broadcasters for WebSocket clients
    price_broadcaster: broadcast::Sender<LivePriceUpdate>,
    opportunity_broadcaster: broadcast::Sender<LiveOpportunityUpdate>,
    mev_broadcaster: broadcast::Sender<LiveMevAlert>,
    depth_broadcaster: broadcast::Sender<serde_json::Value>,
    
    // Universal price aggregator broadcaster
    universal_price_aggregator: Option<Arc<crate::universal_price_aggregator::UniversalPriceAggregator>>,
    price_broadcaster_universal: Option<Arc<crate::universal_price_aggregator::PriceBroadcaster>>,
}

#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub id: String,
    pub subscriptions: Vec<String>,
    pub connected_at: u64,
    pub last_ping: u64,
}

impl WebSocketServer {
    pub fn new(
        port: u16,
        price_receiver: broadcast::Receiver<crate::PriceInfo>,
        opportunity_receiver: broadcast::Receiver<crate::ArbitrageOpportunity>,
    ) -> Self {
        let (price_tx, _) = broadcast::channel(1000);
        let (opp_tx, _) = broadcast::channel(1000);
        let (mev_tx, _) = broadcast::channel(1000);
        let (depth_tx, _) = broadcast::channel(1000);

        Self {
            port,
            active_connections: Arc::new(RwLock::new(HashMap::new())),
            price_receiver,
            opportunity_receiver,
            price_broadcaster: price_tx,
            opportunity_broadcaster: opp_tx,
            mev_broadcaster: mev_tx,
            depth_broadcaster: depth_tx,
            universal_price_aggregator: None,
            price_broadcaster_universal: None,
        }
    }
    
    pub fn set_universal_price_aggregator(&mut self, aggregator: Arc<crate::universal_price_aggregator::UniversalPriceAggregator>, broadcaster: Arc<crate::universal_price_aggregator::PriceBroadcaster>) {
        self.universal_price_aggregator = Some(aggregator);
        self.price_broadcaster_universal = Some(broadcaster);
    }

    pub async fn start(self: Arc<Self>) -> Result<()> {
        info!("🔌 Starting WebSocket server on port {}", self.port);

        // Start data forwarding loops
        tokio::spawn(self.clone().price_forwarding_loop());
        tokio::spawn(self.clone().opportunity_forwarding_loop());
        tokio::spawn(self.clone().generate_live_data_loop());
        tokio::spawn(self.clone().universal_price_broadcasting_loop());

        // Start WebSocket server
        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", self.port)).await?;
        info!("✅ WebSocket server listening on ws://127.0.0.1:{}", self.port);

        while let Ok((stream, addr)) = listener.accept().await {
            let server = self.clone();
            tokio::spawn(async move {
                if let Err(e) = server.handle_connection(stream, addr.to_string()).await {
                    error!("WebSocket connection error: {}", e);
                }
            });
        }

        Ok(())
    }

    async fn handle_connection(
        &self,
        stream: tokio::net::TcpStream,
        addr: String,
    ) -> Result<()> {
        let ws_stream = accept_async(stream).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        let client_id = format!("client_{}_{}", addr, chrono::Utc::now().timestamp_millis());
        info!("🔗 New WebSocket connection: {}", client_id);

        // Register client
        let client = ClientConnection {
            id: client_id.clone(),
            subscriptions: Vec::new(),
            connected_at: chrono::Utc::now().timestamp() as u64,
            last_ping: chrono::Utc::now().timestamp() as u64,
        };

        {
            let mut connections = self.active_connections.write().await;
            connections.insert(client_id.clone(), client);
        }

        // Subscribe to all broadcasts for this client
        let mut price_rx = self.price_broadcaster.subscribe();
        let mut opp_rx = self.opportunity_broadcaster.subscribe();
        let mut mev_rx = self.mev_broadcaster.subscribe();
        let mut depth_rx = self.depth_broadcaster.subscribe();

        // Handle incoming messages from client
        let client_id_clone = client_id.clone();
        let connections_clone = self.active_connections.clone();
        let client_handler = tokio::spawn(async move {
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(sub_req) = serde_json::from_str::<SubscriptionRequest>(&text) {
                            debug!("📝 Subscription request from {}: {:?}", client_id_clone, sub_req);
                            
                            // Update client subscriptions
                            let mut connections = connections_clone.write().await;
                            if let Some(client) = connections.get_mut(&client_id_clone) {
                                if sub_req.action == "subscribe" {
                                    for channel in &sub_req.channels {
                                        if !client.subscriptions.contains(channel) {
                                            client.subscriptions.push(channel.clone());
                                        }
                                    }
                                } else if sub_req.action == "unsubscribe" {
                                    client.subscriptions.retain(|c| !sub_req.channels.contains(c));
                                }
                            }
                        }
                    }
                    Ok(Message::Ping(ping)) => {
                        // Handle ping - client is alive
                        let mut connections = connections_clone.write().await;
                        if let Some(client) = connections.get_mut(&client_id_clone) {
                            client.last_ping = chrono::Utc::now().timestamp() as u64;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("🔌 Client {} disconnected", client_id_clone);
                        break;
                    }
                    Err(e) => {
                        warn!("WebSocket message error from {}: {}", client_id_clone, e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Handle outgoing messages to client
        let client_id_clone2 = client_id.clone();
        let connections_clone2 = self.active_connections.clone();
        let message_forwarder = tokio::spawn(async move {
            loop {
                tokio::select! {
                    Ok(price_update) = price_rx.recv() => {
                        if Self::client_subscribed_to(&connections_clone2, &client_id_clone2, "prices").await {
                            let msg = WebSocketMessage {
                                message_type: "price_update".to_string(),
                                data: serde_json::to_value(&price_update).unwrap_or_default(),
                                timestamp: chrono::Utc::now().timestamp() as u64,
                            };
                            
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if ws_sender.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                    Ok(opp_update) = opp_rx.recv() => {
                        if Self::client_subscribed_to(&connections_clone2, &client_id_clone2, "opportunities").await {
                            let msg = WebSocketMessage {
                                message_type: "opportunity_update".to_string(),
                                data: serde_json::to_value(&opp_update).unwrap_or_default(),
                                timestamp: chrono::Utc::now().timestamp() as u64,
                            };
                            
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if ws_sender.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                    Ok(mev_alert) = mev_rx.recv() => {
                        if Self::client_subscribed_to(&connections_clone2, &client_id_clone2, "mev").await {
                            let msg = WebSocketMessage {
                                message_type: "mev_alert".to_string(),
                                data: serde_json::to_value(&mev_alert).unwrap_or_default(),
                                timestamp: chrono::Utc::now().timestamp() as u64,
                            };
                            
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if ws_sender.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                    Ok(depth_update) = depth_rx.recv() => {
                        if Self::client_subscribed_to(&connections_clone2, &client_id_clone2, "depth").await {
                            let msg = WebSocketMessage {
                                message_type: "market_depth".to_string(),
                                data: depth_update,
                                timestamp: chrono::Utc::now().timestamp() as u64,
                            };
                            
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if ws_sender.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        });

        // Wait for either handler to complete
        tokio::select! {
            _ = client_handler => {},
            _ = message_forwarder => {},
        }

        // Cleanup
        {
            let mut connections = self.active_connections.write().await;
            connections.remove(&client_id);
        }

        info!("🔌 Client {} connection closed", client_id);
        Ok(())
    }

    async fn client_subscribed_to(
        connections: &Arc<RwLock<HashMap<String, ClientConnection>>>,
        client_id: &str,
        channel: &str,
    ) -> bool {
        let connections = connections.read().await;
        connections
            .get(client_id)
            .map(|client| client.subscriptions.contains(&channel.to_string()))
            .unwrap_or(false)
    }

    async fn price_forwarding_loop(self: Arc<Self>) {
        let mut receiver = self.price_receiver.resubscribe();
        
        loop {
            if let Ok(price_info) = receiver.recv().await {
                let live_update = LivePriceUpdate {
                    pair: price_info.pair,
                    price: price_info.price,
                    change_24h: rand::random::<f64>() * 10.0 - 5.0, // ±5%
                    volume_24h: price_info.volume_24h.unwrap_or_default(),
                    exchange: price_info.exchange,
                    timestamp: price_info.timestamp,
                };

                let _ = self.price_broadcaster.send(live_update);
            }
        }
    }

    async fn opportunity_forwarding_loop(self: Arc<Self>) {
        let mut receiver = self.opportunity_receiver.resubscribe();
        
        loop {
            if let Ok(opportunity) = receiver.recv().await {
                let live_update = LiveOpportunityUpdate {
                    id: opportunity.id,
                    pair: opportunity.token_pair,
                    profit_percentage: opportunity.profit_percentage.to_string().parse().unwrap_or(0.0),
                    estimated_profit: opportunity.estimated_profit_usd,
                    exchanges: vec![opportunity.buy_exchange, opportunity.sell_exchange],
                    risk_level: if opportunity.risk_score < 0.3 { "Low" } 
                              else if opportunity.risk_score < 0.7 { "Medium" } 
                              else { "High" }.to_string(),
                    timestamp: opportunity.timestamp,
                };

                let _ = self.opportunity_broadcaster.send(live_update);
            }
        }
    }

    async fn generate_live_data_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(1000)); // 1 second updates
        
        loop {
            interval.tick().await;

            // Generate live price updates
            self.generate_live_prices().await;
            
            // Generate MEV alerts occasionally
            if rand::random::<f64>() < 0.1 { // 10% chance every second
                self.generate_mev_alert().await;
            }

            // Generate market depth updates
            self.generate_market_depth_update().await;
        }
    }

    async fn generate_live_prices(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC", "BTC/USDC", "ORCA/USDC", "RAY/USDC"];
        
        for pair in pairs {
            let base_price = match pair {
                "SOL/USDC" => 171.12,
                "ETH/USDC" => 3400.00,
                "BTC/USDC" => 95000.00,
                "ORCA/USDC" => 1.85,
                "RAY/USDC" => 2.45,
                _ => 100.0,
            };

            // Add small random fluctuation
            let fluctuation = (rand::random::<f64>() - 0.5) * 0.02; // ±1%
            let current_price = base_price * (1.0 + fluctuation);

            let live_update = LivePriceUpdate {
                pair: pair.to_string(),
                price: Decimal::from_f64(current_price).unwrap_or_default(),
                change_24h: rand::random::<f64>() * 10.0 - 5.0,
                volume_24h: Decimal::from(rand::random::<u32>() % 1000000 + 100000),
                exchange: "Live Feed".to_string(),
                timestamp: chrono::Utc::now().timestamp() as u64,
            };

            let _ = self.price_broadcaster.send(live_update);
        }
    }

    async fn generate_mev_alert(&self) {
        let threat_types = vec!["Frontrunning", "Sandwiching", "JIT Arbitrage"];
        let risk_levels = vec!["High", "Medium", "Low"];
        let tokens = vec!["SOL", "ETH", "USDC", "RAY", "ORCA"];

        let threat_type = threat_types[rand::random::<usize>() % threat_types.len()];
        let risk_level = risk_levels[rand::random::<usize>() % risk_levels.len()];

        let alert = LiveMevAlert {
            id: format!("mev_{}", chrono::Utc::now().timestamp_millis()),
            threat_type: threat_type.to_string(),
            risk_level: risk_level.to_string(),
            description: format!("{} attack detected - {} risk", threat_type, risk_level),
            affected_tokens: vec![
                tokens[rand::random::<usize>() % tokens.len()].to_string(),
                tokens[rand::random::<usize>() % tokens.len()].to_string(),
            ],
            timestamp: chrono::Utc::now().timestamp() as u64,
        };

        let _ = self.mev_broadcaster.send(alert);
    }

    async fn generate_market_depth_update(&self) {
        let pairs = vec!["SOL/USDC", "ETH/USDC"];
        
        for pair in pairs {
            let depth_data = serde_json::json!({
                "pair": pair,
                "bids": [
                    {"price": 103.45, "size": 1000, "total": 1000},
                    {"price": 103.44, "size": 850, "total": 1850},
                    {"price": 103.43, "size": 750, "total": 2600}
                ],
                "asks": [
                    {"price": 103.46, "size": 900, "total": 900},
                    {"price": 103.47, "size": 800, "total": 1700},
                    {"price": 103.48, "size": 700, "total": 2400}
                ],
                "timestamp": chrono::Utc::now().timestamp()
            });

            let _ = self.depth_broadcaster.send(depth_data);
        }
    }

    pub async fn get_connection_stats(&self) -> HashMap<String, serde_json::Value> {
        let connections = self.active_connections.read().await;
        let mut stats = HashMap::new();
        
        stats.insert("total_connections".to_string(), 
                     serde_json::Value::Number(serde_json::Number::from(connections.len())));
        
        let mut subscription_counts = HashMap::new();
        for client in connections.values() {
            for subscription in &client.subscriptions {
                *subscription_counts.entry(subscription.clone()).or_insert(0) += 1;
            }
        }
        
        stats.insert("subscriptions".to_string(), 
                     serde_json::to_value(subscription_counts).unwrap_or_default());

        stats
    }
    
    async fn universal_price_broadcasting_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2)); // Send every 2 seconds
        
        loop {
            interval.tick().await;
            
            // Broadcast universal price data if available
            if let (Some(broadcaster), Some(aggregator)) = (&self.price_broadcaster_universal, &self.universal_price_aggregator) {
                // Get price data
                if let Ok(price_data) = broadcaster.broadcast_prices().await {
                    let msg = WebSocketMessage {
                        message_type: "price_update".to_string(),
                        data: price_data,
                        timestamp: chrono::Utc::now().timestamp() as u64,
                    };
                    
                    // Send to all connected clients subscribed to prices
                    let connections = self.active_connections.read().await;
                    for (client_id, client) in connections.iter() {
                        if client.subscriptions.contains(&"prices".to_string()) {
                            // Send via depth broadcaster as it accepts serde_json::Value
                            let _ = self.depth_broadcaster.send(msg.data.clone());
                        }
                    }
                }
                
                // Get arbitrage opportunities
                if let Ok(opp_data) = broadcaster.broadcast_opportunities().await {
                    let msg = WebSocketMessage {
                        message_type: "arbitrage_update".to_string(),
                        data: opp_data,
                        timestamp: chrono::Utc::now().timestamp() as u64,
                    };
                    
                    // Send to all connected clients subscribed to opportunities
                    let connections = self.active_connections.read().await;
                    for (client_id, client) in connections.iter() {
                        if client.subscriptions.contains(&"opportunities".to_string()) {
                            let _ = self.depth_broadcaster.send(msg.data.clone());
                        }
                    }
                }
            }
        }
    }
}

use rand;
use chrono;
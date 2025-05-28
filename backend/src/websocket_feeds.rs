use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use std::collections::HashMap;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceFeed {
    pub symbol: String,
    pub price: f64,
    pub volume_24h: f64,
    pub change_24h: f64,
    pub high_24h: f64,
    pub low_24h: f64,
    pub timestamp: u64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookUpdate {
    pub symbol: String,
    pub bids: Vec<(f64, f64)>, // (price, amount)
    pub asks: Vec<(f64, f64)>, // (price, amount)
    pub timestamp: u64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeUpdate {
    pub symbol: String,
    pub price: f64,
    pub amount: f64,
    pub side: String, // "buy" or "sell"
    pub timestamp: u64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    Subscribe { channels: Vec<String> },
    Unsubscribe { channels: Vec<String> },
    PriceFeed(PriceFeed),
    OrderBook(OrderBookUpdate),
    Trade(TradeUpdate),
    ArbitrageOpportunity(crate::dex_connectors::ArbitrageRoute),
    Heartbeat { timestamp: u64 },
    Error { message: String },
}

pub struct WebSocketFeedManager {
    price_feeds: Arc<RwLock<HashMap<String, PriceFeed>>>,
    order_books: Arc<RwLock<HashMap<String, OrderBookUpdate>>>,
    trade_feeds: Arc<RwLock<HashMap<String, Vec<TradeUpdate>>>>,
    broadcast_tx: broadcast::Sender<WebSocketMessage>,
    subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>, // client_id -> channels
}

impl WebSocketFeedManager {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(1000);
        
        Self {
            price_feeds: Arc::new(RwLock::new(HashMap::new())),
            order_books: Arc::new(RwLock::new(HashMap::new())),
            trade_feeds: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start_feed_aggregation(&self) {
        // Start price feed aggregation
        let price_feeds = self.price_feeds.clone();
        let broadcast_tx = self.broadcast_tx.clone();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_millis(500)); // Update every 500ms
            
            loop {
                interval.tick().await;
                
                // Simulate real-time price updates
                let updates = vec![
                    PriceFeed {
                        symbol: "SOL/USDC".to_string(),
                        price: 171.12 + (rand::random::<f64>() - 0.5) * 2.0,
                        volume_24h: 1500000.0,
                        change_24h: 2.5,
                        high_24h: 175.0,
                        low_24h: 168.0,
                        timestamp: chrono::Utc::now().timestamp() as u64,
                        source: "Aggregate".to_string(),
                    },
                    PriceFeed {
                        symbol: "BTC/USDC".to_string(),
                        price: 95000.0 + (rand::random::<f64>() - 0.5) * 500.0,
                        volume_24h: 50000000.0,
                        change_24h: 1.2,
                        high_24h: 96000.0,
                        low_24h: 94000.0,
                        timestamp: chrono::Utc::now().timestamp() as u64,
                        source: "Aggregate".to_string(),
                    },
                    PriceFeed {
                        symbol: "ETH/USDC".to_string(),
                        price: 3400.0 + (rand::random::<f64>() - 0.5) * 50.0,
                        volume_24h: 25000000.0,
                        change_24h: 3.1,
                        high_24h: 3450.0,
                        low_24h: 3350.0,
                        timestamp: chrono::Utc::now().timestamp() as u64,
                        source: "Aggregate".to_string(),
                    },
                ];
                
                let mut feeds = price_feeds.write().await;
                for update in updates {
                    feeds.insert(update.symbol.clone(), update.clone());
                    let _ = broadcast_tx.send(WebSocketMessage::PriceFeed(update));
                }
            }
        });
        
        // Start order book aggregation
        let order_books = self.order_books.clone();
        let broadcast_tx = self.broadcast_tx.clone();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            
            loop {
                interval.tick().await;
                
                // Simulate order book updates
                let update = OrderBookUpdate {
                    symbol: "SOL/USDC".to_string(),
                    bids: vec![
                        (171.10, 100.0),
                        (171.08, 250.0),
                        (171.05, 500.0),
                        (171.02, 1000.0),
                        (171.00, 2000.0),
                    ],
                    asks: vec![
                        (171.12, 100.0),
                        (171.14, 250.0),
                        (171.17, 500.0),
                        (171.20, 1000.0),
                        (171.22, 2000.0),
                    ],
                    timestamp: chrono::Utc::now().timestamp() as u64,
                    source: "Aggregate".to_string(),
                };
                
                let mut books = order_books.write().await;
                books.insert(update.symbol.clone(), update.clone());
                let _ = broadcast_tx.send(WebSocketMessage::OrderBook(update));
            }
        });
    }

    pub async fn handle_client_connection(&self, stream: tokio::net::TcpStream, client_id: String) {
        let ws_stream = accept_async(stream).await.expect("Failed to accept WebSocket");
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        // Subscribe to broadcast channel
        let mut broadcast_rx = self.broadcast_tx.subscribe();
        
        // Send initial data
        let price_feeds = self.price_feeds.read().await;
        for (_, feed) in price_feeds.iter() {
            let msg = serde_json::to_string(&WebSocketMessage::PriceFeed(feed.clone())).unwrap();
            let _ = ws_sender.send(Message::Text(msg)).await;
        }
        
        // Handle incoming messages
        let subscriptions = self.subscriptions.clone();
        let client_id_clone = client_id.clone();
        
        tokio::spawn(async move {
            while let Some(msg) = ws_receiver.next().await {
                if let Ok(msg) = msg {
                    match msg {
                        Message::Text(text) => {
                            if let Ok(ws_msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                                match ws_msg {
                                    WebSocketMessage::Subscribe { channels } => {
                                        let mut subs = subscriptions.write().await;
                                        subs.insert(client_id_clone.clone(), channels);
                                    },
                                    WebSocketMessage::Unsubscribe { channels } => {
                                        let mut subs = subscriptions.write().await;
                                        if let Some(client_channels) = subs.get_mut(&client_id_clone) {
                                            client_channels.retain(|c| !channels.contains(c));
                                        }
                                    },
                                    _ => {}
                                }
                            }
                        },
                        Message::Close(_) => break,
                        _ => {}
                    }
                }
            }
            
            // Clean up on disconnect
            let mut subs = subscriptions.write().await;
            subs.remove(&client_id_clone);
        });
        
        // Send broadcasts to client
        tokio::spawn(async move {
            while let Ok(msg) = broadcast_rx.recv().await {
                let text = serde_json::to_string(&msg).unwrap();
                if ws_sender.send(Message::Text(text)).await.is_err() {
                    break;
                }
            }
        });
    }

    pub async fn get_current_price(&self, symbol: &str) -> Option<f64> {
        let feeds = self.price_feeds.read().await;
        feeds.get(symbol).map(|f| f.price)
    }

    pub async fn get_order_book(&self, symbol: &str) -> Option<OrderBookUpdate> {
        let books = self.order_books.read().await;
        books.get(symbol).cloned()
    }

    pub fn broadcast_arbitrage_opportunity(&self, opportunity: crate::dex_connectors::ArbitrageRoute) {
        let _ = self.broadcast_tx.send(WebSocketMessage::ArbitrageOpportunity(opportunity));
    }
}

// External WebSocket client for connecting to DEX feeds
pub struct DexWebSocketClient {
    url: String,
    feed_manager: Arc<WebSocketFeedManager>,
}

impl DexWebSocketClient {
    pub fn new(url: String, feed_manager: Arc<WebSocketFeedManager>) -> Self {
        Self { url, feed_manager }
    }

    pub async fn connect_jupiter(&self) {
        // Placeholder for Jupiter WebSocket connection
        // Will be implemented with actual WebSocket URL
        tokio::spawn(async move {
            // Connect to Jupiter WebSocket
            // Parse messages and forward to feed_manager
        });
    }

    pub async fn connect_raydium(&self) {
        // Placeholder for Raydium WebSocket connection
        tokio::spawn(async move {
            // Connect to Raydium WebSocket
            // Parse messages and forward to feed_manager
        });
    }

    pub async fn connect_serum(&self) {
        // Placeholder for Serum WebSocket connection
        tokio::spawn(async move {
            // Connect to Serum WebSocket
            // Parse messages and forward to feed_manager
        });
    }
}

// Price aggregator that combines multiple sources
pub struct PriceAggregator {
    sources: HashMap<String, Arc<dyn PriceSource + Send + Sync>>,
}

#[async_trait::async_trait]
trait PriceSource {
    async fn get_price(&self, symbol: &str) -> Option<f64>;
    fn get_name(&self) -> &str;
}

impl PriceAggregator {
    pub fn new() -> Self {
        Self {
            sources: HashMap::new(),
        }
    }

    pub async fn get_aggregated_price(&self, symbol: &str) -> Option<f64> {
        let mut prices = Vec::new();
        
        for (_, source) in &self.sources {
            if let Some(price) = source.get_price(symbol).await {
                prices.push(price);
            }
        }
        
        if prices.is_empty() {
            None
        } else {
            // Return median price
            prices.sort_by(|a, b| a.partial_cmp(b).unwrap());
            Some(prices[prices.len() / 2])
        }
    }
}
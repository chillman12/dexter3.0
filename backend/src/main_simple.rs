// Simplified DEXTER v3.0 - Running without Solana dependencies
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::Filter;
use log::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::init();
    
    info!("Starting DEXTER v3.0 Backend (Simplified Mode)");
    
    // REST API on port 3001
    let rest_routes = warp::path("api")
        .and(warp::path("health"))
        .and(warp::get())
        .map(|| warp::reply::json(&serde_json::json!({
            "status": "healthy",
            "version": "3.0.0",
            "mode": "simplified"
        })));
    
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Authorization"]);
    
    let rest_routes = rest_routes.with(cors);
    
    // Start REST API server
    let rest_addr: SocketAddr = "0.0.0.0:3001".parse()?;
    let rest_server = warp::serve(rest_routes);
    
    info!("REST API Server listening on port 3001");
    
    // Start WebSocket server on port 3002 in parallel
    tokio::spawn(async move {
        let ws_route = warp::path("ws")
            .and(warp::ws())
            .map(|ws: warp::ws::Ws| {
                ws.on_upgrade(move |websocket| async move {
                    info!("WebSocket client connected");
                    // Simple echo server for now
                    use futures_util::StreamExt;
                    use futures_util::SinkExt;
                    
                    let (mut tx, mut rx) = websocket.split();
                    
                    while let Some(result) = rx.next().await {
                        match result {
                            Ok(msg) => {
                                if msg.is_text() {
                                    let text = msg.to_str().unwrap();
                                    info!("Received: {}", text);
                                    
                                    // Send a mock response
                                    let response = serde_json::json!({
                                        "type": "price_update",
                                        "data": {
                                            "symbol": "BTC/USD",
                                            "price": 50000.0,
                                            "timestamp": chrono::Utc::now().to_rfc3339()
                                        }
                                    });
                                    
                                    if let Err(e) = tx.send(warp::ws::Message::text(response.to_string())).await {
                                        eprintln!("Error sending message: {}", e);
                                        break;
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("WebSocket error: {}", e);
                                break;
                            }
                        }
                    }
                })
            });
        
        let ws_addr: SocketAddr = "0.0.0.0:3002".parse().unwrap();
        info!("WebSocket Server listening on port 3002");
        warp::serve(ws_route).run(ws_addr).await;
    });
    
    // Run the REST server
    rest_server.run(rest_addr).await;
    
    Ok(())
}
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromStr, ToPrimitive, FromPrimitive};
use anyhow::{Result, anyhow};
use log::{info, warn, error};
use chrono;

// ============================================================================
// JUPITER API INTEGRATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupiterQuoteResponse {
    #[serde(rename = "inputMint")]
    pub input_mint: String,
    #[serde(rename = "inAmount")]
    pub in_amount: String,
    #[serde(rename = "outputMint")]
    pub output_mint: String,
    #[serde(rename = "outAmount")]
    pub out_amount: String,
    #[serde(rename = "otherAmountThreshold")]
    pub other_amount_threshold: String,
    #[serde(rename = "swapMode")]
    pub swap_mode: String,
    #[serde(rename = "slippageBps")]
    pub slippage_bps: u32,
    #[serde(rename = "platformFee")]
    pub platform_fee: Option<JupiterPlatformFee>,
    #[serde(rename = "priceImpactPct")]
    pub price_impact_pct: String,
    #[serde(rename = "routePlan")]
    pub route_plan: Vec<JupiterRoutePlan>,
    #[serde(rename = "contextSlot")]
    pub context_slot: u64,
    #[serde(rename = "timeTaken")]
    pub time_taken: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupiterPlatformFee {
    pub amount: String,
    pub feeBps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupiterRoutePlan {
    #[serde(rename = "swapInfo")]
    pub swap_info: JupiterSwapInfo,
    pub percent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupiterSwapInfo {
    #[serde(rename = "ammKey")]
    pub amm_key: String,
    pub label: String,
    #[serde(rename = "inputMint")]
    pub input_mint: String,
    #[serde(rename = "outputMint")]
    pub output_mint: String,
    #[serde(rename = "inAmount")]
    pub in_amount: String,
    #[serde(rename = "outAmount")]
    pub out_amount: String,
    #[serde(rename = "feeAmount")]
    pub fee_amount: String,
    #[serde(rename = "feeMint")]
    pub fee_mint: String,
}

// ============================================================================
// GECKOTERMINAL API INTEGRATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalResponse {
    pub data: GeckoTerminalData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalData {
    pub id: String,
    #[serde(rename = "type")]
    pub data_type: String,
    pub attributes: GeckoTerminalAttributes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalAttributes {
    pub name: String,
    pub address: String,
    #[serde(rename = "base_token_price_usd")]
    pub base_token_price_usd: String,
    #[serde(rename = "quote_token_price_usd")]
    pub quote_token_price_usd: String,
    #[serde(rename = "base_token_price_native_currency")]
    pub base_token_price_native_currency: String,
    #[serde(rename = "quote_token_price_native_currency")]
    pub quote_token_price_native_currency: String,
    #[serde(rename = "pool_created_at")]
    pub pool_created_at: String,
    #[serde(rename = "fdv_usd")]
    pub fdv_usd: String,
    #[serde(rename = "market_cap_usd")]
    pub market_cap_usd: Option<String>,
    #[serde(rename = "price_change_percentage")]
    pub price_change_percentage: GeckoTerminalPriceChange,
    #[serde(rename = "transactions")]
    pub transactions: GeckoTerminalTransactions,
    #[serde(rename = "volume_usd")]
    pub volume_usd: GeckoTerminalVolume,
    #[serde(rename = "reserve_in_usd")]
    pub reserve_in_usd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalPriceChange {
    #[serde(rename = "m5")]
    pub m5: String,
    #[serde(rename = "h1")]
    pub h1: String,
    #[serde(rename = "h6")]
    pub h6: String,
    #[serde(rename = "h24")]
    pub h24: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalTransactions {
    #[serde(rename = "m5")]
    pub m5: GeckoTerminalTransactionCount,
    #[serde(rename = "h1")]
    pub h1: GeckoTerminalTransactionCount,
    #[serde(rename = "h6")]
    pub h6: GeckoTerminalTransactionCount,
    #[serde(rename = "h24")]
    pub h24: GeckoTerminalTransactionCount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalTransactionCount {
    pub buys: u32,
    pub sells: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeckoTerminalVolume {
    #[serde(rename = "m5")]
    pub m5: String,
    #[serde(rename = "h1")]
    pub h1: String,
    #[serde(rename = "h6")]
    pub h6: String,
    #[serde(rename = "h24")]
    pub h24: String,
}

// ============================================================================
// DEX SCREENER API INTEGRATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerResponse {
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    pub pairs: Vec<DexScreenerPair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerPair {
    #[serde(rename = "chainId")]
    pub chain_id: String,
    #[serde(rename = "dexId")]
    pub dex_id: String,
    pub url: String,
    #[serde(rename = "pairAddress")]
    pub pair_address: String,
    #[serde(rename = "baseToken")]
    pub base_token: DexScreenerToken,
    #[serde(rename = "quoteToken")]
    pub quote_token: DexScreenerToken,
    #[serde(rename = "priceNative")]
    pub price_native: String,
    #[serde(rename = "priceUsd")]
    pub price_usd: Option<String>,
    pub txns: DexScreenerTransactions,
    pub volume: DexScreenerVolume,
    #[serde(rename = "priceChange")]
    pub price_change: DexScreenerPriceChange,
    pub liquidity: Option<DexScreenerLiquidity>,
    #[serde(rename = "fdv")]
    pub fdv: Option<f64>,
    #[serde(rename = "marketCap")]
    pub market_cap: Option<f64>,
    #[serde(rename = "pairCreatedAt")]
    pub pair_created_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerToken {
    pub address: String,
    pub name: String,
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerTransactions {
    #[serde(rename = "m5")]
    pub m5: DexScreenerTransactionData,
    #[serde(rename = "h1")]
    pub h1: DexScreenerTransactionData,
    #[serde(rename = "h6")]
    pub h6: DexScreenerTransactionData,
    #[serde(rename = "h24")]
    pub h24: DexScreenerTransactionData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerTransactionData {
    pub buys: u32,
    pub sells: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerVolume {
    #[serde(rename = "h24")]
    pub h24: f64,
    #[serde(rename = "h6")]
    pub h6: f64,
    #[serde(rename = "h1")]
    pub h1: f64,
    #[serde(rename = "m5")]
    pub m5: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerPriceChange {
    #[serde(rename = "m5")]
    pub m5: f64,
    #[serde(rename = "h1")]
    pub h1: f64,
    #[serde(rename = "h6")]
    pub h6: f64,
    #[serde(rename = "h24")]
    pub h24: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexScreenerLiquidity {
    pub usd: Option<f64>,
    pub base: f64,
    pub quote: f64,
}

// ============================================================================
// BITQUERY API INTEGRATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryResponse {
    pub data: BitqueryData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryData {
    pub ethereum: Option<BitqueryEthereum>,
    pub solana: Option<BitquerySolana>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryEthereum {
    #[serde(rename = "dexTrades")]
    pub dex_trades: Vec<BitqueryDexTrade>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitquerySolana {
    #[serde(rename = "dexTrades")]
    pub dex_trades: Vec<BitqueryDexTrade>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryDexTrade {
    #[serde(rename = "timeInterval")]
    pub time_interval: BitqueryTimeInterval,
    #[serde(rename = "baseCurrency")]
    pub base_currency: BitqueryCurrency,
    #[serde(rename = "quoteCurrency")]
    pub quote_currency: BitqueryCurrency,
    #[serde(rename = "tradeAmount")]
    pub trade_amount: f64,
    #[serde(rename = "trades")]
    pub trades: u32,
    #[serde(rename = "maximum_price")]
    pub maximum_price: f64,
    #[serde(rename = "minimum_price")]
    pub minimum_price: f64,
    #[serde(rename = "open_price")]
    pub open_price: f64,
    #[serde(rename = "close_price")]
    pub close_price: f64,
    #[serde(rename = "median_price")]
    pub median_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryTimeInterval {
    pub minute: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryCurrency {
    pub symbol: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitqueryRequest {
    pub query: String,
    pub variables: Option<serde_json::Value>,
}

// ============================================================================
// UNIFIED EXTERNAL API CLIENT
// ============================================================================

pub struct ExternalApiClient {
    client: Client,
    jupiter_base_url: String,
    geckoterminal_base_url: String,
    dexscreener_base_url: String,
    bitquery_base_url: String,
    bitquery_api_key: Option<String>,
}

impl ExternalApiClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            jupiter_base_url: "https://quote-api.jup.ag/v6".to_string(),
            geckoterminal_base_url: "https://api.geckoterminal.com/api/v2".to_string(),
            dexscreener_base_url: "https://api.dexscreener.com/latest".to_string(),
            bitquery_base_url: "https://graphql.bitquery.io".to_string(),
            bitquery_api_key: std::env::var("BITQUERY_API_KEY").ok(),
        }
    }

    // ========================================================================
    // JUPITER API METHODS
    // ========================================================================

    /// Get quote from Jupiter for token swap
    pub async fn get_jupiter_quote(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: Option<u32>,
    ) -> Result<JupiterQuoteResponse> {
        let slippage = slippage_bps.unwrap_or(50); // Default 0.5% slippage
        
        let url = format!(
            "{}/quote?inputMint={}&outputMint={}&amount={}&slippageBps={}",
            self.jupiter_base_url, input_mint, output_mint, amount, slippage
        );

        info!("🔍 Fetching Jupiter quote: {} -> {} (amount: {})", input_mint, output_mint, amount);

        let response = self.client
            .get(&url)
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Jupiter API error {}: {}", status, text));
        }

        let quote: JupiterQuoteResponse = response.json().await?;
        
        info!("✅ Jupiter quote received: {} {} -> {} {}", 
              quote.in_amount, input_mint, quote.out_amount, output_mint);

        Ok(quote)
    }

    /// Get multiple quotes for arbitrage detection
    pub async fn get_jupiter_arbitrage_quotes(
        &self,
        pairs: &[(&str, &str)], // (input_mint, output_mint)
        amount: u64,
    ) -> Result<HashMap<String, JupiterQuoteResponse>> {
        let mut quotes = HashMap::new();
        
        for (input_mint, output_mint) in pairs {
            match self.get_jupiter_quote(input_mint, output_mint, amount, None).await {
                Ok(quote) => {
                    let pair_key = format!("{}/{}", input_mint, output_mint);
                    quotes.insert(pair_key, quote);
                }
                Err(e) => {
                    warn!("⚠️ Failed to get Jupiter quote for {}/{}: {}", input_mint, output_mint, e);
                }
            }
            
            // Rate limiting - Jupiter allows 10 requests per second
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        Ok(quotes)
    }

    // ========================================================================
    // GECKOTERMINAL API METHODS
    // ========================================================================

    /// Get pool data from GeckoTerminal
    pub async fn get_geckoterminal_pool(
        &self,
        network: &str,
        pool_address: &str,
    ) -> Result<GeckoTerminalResponse> {
        let url = format!(
            "{}/networks/{}/pools/{}",
            self.geckoterminal_base_url, network, pool_address
        );

        info!("🔍 Fetching GeckoTerminal pool data: {}/{}", network, pool_address);

        let response = self.client
            .get(&url)
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("GeckoTerminal API error {}: {}", status, text));
        }

        let pool_data: GeckoTerminalResponse = response.json().await?;
        
        info!("✅ GeckoTerminal pool data received for: {}", pool_data.data.attributes.name);

        Ok(pool_data)
    }

    /// Get multiple pools for cross-DEX arbitrage analysis
    pub async fn get_geckoterminal_pools(
        &self,
        pools: &[(&str, &str)], // (network, pool_address)
    ) -> Result<HashMap<String, GeckoTerminalResponse>> {
        let mut pool_data = HashMap::new();
        
        for (network, pool_address) in pools {
            match self.get_geckoterminal_pool(network, pool_address).await {
                Ok(data) => {
                    let pool_key = format!("{}/{}", network, pool_address);
                    pool_data.insert(pool_key, data);
                }
                Err(e) => {
                    warn!("⚠️ Failed to get GeckoTerminal pool {}/{}: {}", network, pool_address, e);
                }
            }
            
            // Rate limiting - GeckoTerminal allows 30 requests per minute
            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
        }

        Ok(pool_data)
    }

    // ========================================================================
    // DEX SCREENER API METHODS
    // ========================================================================

    /// Get token data from DEX Screener
    pub async fn get_dexscreener_token(
        &self,
        token_address: &str,
    ) -> Result<DexScreenerResponse> {
        let url = format!("{}/dex/tokens/{}", self.dexscreener_base_url, token_address);

        info!("🔍 Fetching DEX Screener token data: {}", token_address);

        let response = self.client
            .get(&url)
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("DEX Screener API error {}: {}", status, text));
        }

        let token_data: DexScreenerResponse = response.json().await?;
        
        info!("✅ DEX Screener token data received for: {}", token_address);

        Ok(token_data)
    }

    /// Get pair data from DEX Screener
    pub async fn get_dexscreener_pair(
        &self,
        chain_id: &str,
        pair_address: &str,
    ) -> Result<DexScreenerResponse> {
        let url = format!("{}/dex/pairs/{}/{}", self.dexscreener_base_url, chain_id, pair_address);

        info!("🔍 Fetching DEX Screener pair data: {}/{}", chain_id, pair_address);

        let response = self.client
            .get(&url)
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("DEX Screener API error {}: {}", status, text));
        }

        let pair_data: DexScreenerResponse = response.json().await?;
        
        info!("✅ DEX Screener pair data received for: {}/{}", chain_id, pair_address);

        Ok(pair_data)
    }

    /// Search tokens on DEX Screener
    pub async fn search_dexscreener_tokens(
        &self,
        query: &str,
    ) -> Result<DexScreenerResponse> {
        let url = format!("{}/dex/search/?q={}", self.dexscreener_base_url, query);

        info!("🔍 Searching DEX Screener tokens: {}", query);

        let response = self.client
            .get(&url)
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("DEX Screener API error {}: {}", status, text));
        }

        let search_results: DexScreenerResponse = response.json().await?;
        
        info!("✅ DEX Screener search completed for: {}", query);

        Ok(search_results)
    }

    // ========================================================================
    // BITQUERY API METHODS
    // ========================================================================

    /// Execute GraphQL query on Bitquery
    pub async fn query_bitquery(
        &self,
        query: &str,
        variables: Option<serde_json::Value>,
    ) -> Result<BitqueryResponse> {
        let request_body = BitqueryRequest {
            query: query.to_string(),
            variables,
        };

        info!("🔍 Executing Bitquery GraphQL query");

        let mut request_builder = self.client
            .post(&self.bitquery_base_url)
            .header("Content-Type", "application/json")
            .header("User-Agent", "DEXTER-v3.0-Arbitrage-Bot")
            .json(&request_body);

        // Add API key if available
        if let Some(api_key) = &self.bitquery_api_key {
            request_builder = request_builder.header("X-API-KEY", api_key);
        }

        let response = request_builder.send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Bitquery API error {}: {}", status, text));
        }

        let query_result: BitqueryResponse = response.json().await?;
        
        info!("✅ Bitquery GraphQL query completed successfully");

        Ok(query_result)
    }

    /// Get DEX trades from Bitquery for Solana
    pub async fn get_bitquery_solana_dex_trades(
        &self,
        base_currency: &str,
        quote_currency: &str,
        limit: u32,
    ) -> Result<BitqueryResponse> {
        let query = format!(r#"
            query {{
                solana {{
                    dexTrades(
                        options: {{limit: {}, desc: "timeInterval.minute"}}
                        baseCurrency: {{is: "{}"}}
                        quoteCurrency: {{is: "{}"}}
                        time: {{since: "2024-01-01"}}
                    ) {{
                        timeInterval {{
                            minute(count: 5)
                        }}
                        baseCurrency {{
                            symbol
                            address
                        }}
                        quoteCurrency {{
                            symbol
                            address
                        }}
                        tradeAmount(in: USD)
                        trades: count
                        maximum_price: quotePrice(calculate: maximum)
                        minimum_price: quotePrice(calculate: minimum)
                        open_price: quotePrice(calculate: open)
                        close_price: quotePrice(calculate: close)
                        median_price: quotePrice(calculate: median)
                    }}
                }}
            }}
        "#, limit, base_currency, quote_currency);

        self.query_bitquery(&query, None).await
    }

    /// Get DEX trades from Bitquery for Ethereum
    pub async fn get_bitquery_ethereum_dex_trades(
        &self,
        base_currency: &str,
        quote_currency: &str,
        limit: u32,
    ) -> Result<BitqueryResponse> {
        let query = format!(r#"
            query {{
                ethereum(network: ethereum) {{
                    dexTrades(
                        options: {{limit: {}, desc: "timeInterval.minute"}}
                        baseCurrency: {{is: "{}"}}
                        quoteCurrency: {{is: "{}"}}
                        time: {{since: "2024-01-01"}}
                    ) {{
                        timeInterval {{
                            minute(count: 5)
                        }}
                        baseCurrency {{
                            symbol
                            address
                        }}
                        quoteCurrency {{
                            symbol
                            address
                        }}
                        tradeAmount(in: USD)
                        trades: count
                        maximum_price: quotePrice(calculate: maximum)
                        minimum_price: quotePrice(calculate: minimum)
                        open_price: quotePrice(calculate: open)
                        close_price: quotePrice(calculate: close)
                        median_price: quotePrice(calculate: median)
                    }}
                }}
            }}
        "#, limit, base_currency, quote_currency);

        self.query_bitquery(&query, None).await
    }

    // ========================================================================
    // ENHANCED ARBITRAGE DETECTION METHODS
    // ========================================================================

    /// Detect arbitrage opportunities using Jupiter quotes
    pub async fn detect_jupiter_arbitrage(
        &self,
        token_pairs: &[(&str, &str)],
        amount: u64,
        min_profit_threshold: f64, // Minimum profit percentage
    ) -> Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();
        
        // Get quotes for all pairs
        let quotes = self.get_jupiter_arbitrage_quotes(token_pairs, amount).await?;
        
        // Analyze for circular arbitrage opportunities
        for (pair_key, quote) in &quotes {
            let input_amount = Decimal::from_str(&quote.in_amount)?;
            let output_amount = Decimal::from_str(&quote.out_amount)?;
            
            if input_amount > Decimal::ZERO {
                let price_ratio = output_amount / input_amount;
                let profit_percentage = ((price_ratio - Decimal::ONE) * Decimal::from(100)).to_f64().unwrap_or(0.0);
                
                if profit_percentage > min_profit_threshold {
                    let opportunity = ArbitrageOpportunity {
                        id: format!("jupiter_{}", chrono::Utc::now().timestamp_millis()),
                        source: "Jupiter".to_string(),
                        pair: pair_key.clone(),
                        buy_exchange: "Jupiter".to_string(),
                        sell_exchange: "Jupiter".to_string(), // For now, same exchange
                        buy_price: input_amount,
                        sell_price: output_amount,
                        profit_percentage,
                        estimated_profit: output_amount - input_amount,
                        required_capital: input_amount,
                        confidence: 0.85, // High confidence for Jupiter
                        timestamp: chrono::Utc::now().timestamp() as u64,
                        route_info: Some(format!("Route: {:?}", quote.route_plan)),
                    };
                    
                    opportunities.push(opportunity);
                    
                    info!("🎯 Jupiter arbitrage opportunity found: {} with {:.2}% profit", 
                          pair_key, profit_percentage);
                }
            }
        }

        Ok(opportunities)
    }

    /// Enhanced arbitrage detection combining Jupiter + GeckoTerminal data
    pub async fn detect_cross_dex_arbitrage(
        &self,
        jupiter_pairs: &[(&str, &str)],
        gecko_pools: &[(&str, &str)],
        amount: u64,
        min_profit_threshold: f64,
    ) -> Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();
        
        // Get Jupiter quotes
        let jupiter_quotes = self.get_jupiter_arbitrage_quotes(jupiter_pairs, amount).await?;
        
        // Get GeckoTerminal pool data
        let gecko_data = self.get_geckoterminal_pools(gecko_pools).await?;
        
        // Cross-analyze for arbitrage opportunities
        for (jupiter_pair, jupiter_quote) in &jupiter_quotes {
            for (gecko_pool, gecko_data) in &gecko_data {
                // Compare prices and detect arbitrage
                let jupiter_price = Decimal::from_str(&jupiter_quote.out_amount)? / Decimal::from_str(&jupiter_quote.in_amount)?;
                let gecko_price = Decimal::from_str(&gecko_data.data.attributes.base_token_price_usd)?;
                
                if jupiter_price > Decimal::ZERO && gecko_price > Decimal::ZERO {
                    let price_diff_percentage = ((jupiter_price - gecko_price) / gecko_price * Decimal::from(100)).to_f64().unwrap_or(0.0);
                    
                    if price_diff_percentage.abs() > min_profit_threshold {
                        let opportunity = ArbitrageOpportunity {
                            id: format!("cross_dex_{}", chrono::Utc::now().timestamp_millis()),
                            source: "Cross-DEX".to_string(),
                            pair: jupiter_pair.clone(),
                            buy_exchange: if price_diff_percentage > 0.0 { "GeckoTerminal" } else { "Jupiter" }.to_string(),
                            sell_exchange: if price_diff_percentage > 0.0 { "Jupiter" } else { "GeckoTerminal" }.to_string(),
                            buy_price: if price_diff_percentage > 0.0 { gecko_price } else { jupiter_price },
                            sell_price: if price_diff_percentage > 0.0 { jupiter_price } else { gecko_price },
                            profit_percentage: price_diff_percentage.abs(),
                            estimated_profit: Decimal::from_str(&jupiter_quote.in_amount)? * Decimal::from_f64(price_diff_percentage.abs() / 100.0).unwrap_or_default(),
                            required_capital: Decimal::from_str(&jupiter_quote.in_amount)?,
                            confidence: 0.75, // Medium confidence for cross-DEX
                            timestamp: chrono::Utc::now().timestamp() as u64,
                            route_info: Some(format!("Jupiter: {} | Gecko: {}", jupiter_pair, gecko_pool)),
                        };
                        
                        opportunities.push(opportunity);
                        
                        info!("🎯 Cross-DEX arbitrage opportunity found: {} vs {} with {:.2}% profit", 
                              jupiter_pair, gecko_pool, price_diff_percentage.abs());
                    }
                }
            }
        }

        Ok(opportunities)
    }

    /// NEW: Enhanced arbitrage detection using DEX Screener data
    pub async fn detect_dexscreener_arbitrage(
        &self,
        token_addresses: &[&str],
        min_profit_threshold: f64,
    ) -> Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();
        
        for token_address in token_addresses {
            match self.get_dexscreener_token(token_address).await {
                Ok(token_data) => {
                    // Analyze pairs for arbitrage opportunities
                    for pair in &token_data.pairs {
                        if let Some(price_usd) = &pair.price_usd {
                            let current_price = price_usd.parse::<f64>().unwrap_or(0.0);
                            
                            // Check for significant price changes that might indicate arbitrage
                            let price_change_24h = pair.price_change.h24;
                            
                            if price_change_24h.abs() > min_profit_threshold {
                                let opportunity = ArbitrageOpportunity {
                                    id: format!("dexscreener_{}", chrono::Utc::now().timestamp_millis()),
                                    source: "DEX Screener".to_string(),
                                    pair: format!("{}/{}", pair.base_token.symbol, pair.quote_token.symbol),
                                    buy_exchange: pair.dex_id.clone(),
                                    sell_exchange: "Market".to_string(),
                                    buy_price: Decimal::from_f64(current_price).unwrap_or_default(),
                                    sell_price: Decimal::from_f64(current_price * (1.0 + price_change_24h / 100.0)).unwrap_or_default(),
                                    profit_percentage: price_change_24h.abs(),
                                    estimated_profit: Decimal::from_f64(current_price * price_change_24h.abs() / 100.0).unwrap_or_default(),
                                    required_capital: Decimal::from_f64(current_price * 1000.0).unwrap_or_default(), // Assume 1000 tokens
                                    confidence: 0.70, // Medium confidence for DEX Screener
                                    timestamp: chrono::Utc::now().timestamp() as u64,
                                    route_info: Some(format!("DEX: {} | Chain: {}", pair.dex_id, pair.chain_id)),
                                };
                                
                                opportunities.push(opportunity);
                                
                                info!("🎯 DEX Screener arbitrage opportunity found: {} with {:.2}% price change", 
                                      pair.base_token.symbol, price_change_24h.abs());
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("⚠️ Failed to get DEX Screener data for {}: {}", token_address, e);
                }
            }
            
            // Rate limiting for DEX Screener (300 requests per minute)
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        Ok(opportunities)
    }

    /// NEW: Enhanced arbitrage detection using Bitquery historical data
    pub async fn detect_bitquery_arbitrage(
        &self,
        pairs: &[(&str, &str)], // (base_currency, quote_currency)
        chain: &str, // "solana" or "ethereum"
        min_profit_threshold: f64,
    ) -> Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();
        
        for (base_currency, quote_currency) in pairs {
            let trades_result = match chain {
                "solana" => self.get_bitquery_solana_dex_trades(base_currency, quote_currency, 10).await,
                "ethereum" => self.get_bitquery_ethereum_dex_trades(base_currency, quote_currency, 10).await,
                _ => continue,
            };
            
            match trades_result {
                Ok(bitquery_data) => {
                    let trades = if chain == "solana" {
                        bitquery_data.data.solana.as_ref().map(|s| &s.dex_trades)
                    } else {
                        bitquery_data.data.ethereum.as_ref().map(|e| &e.dex_trades)
                    };
                    
                    if let Some(trades) = trades {
                        for trade in trades {
                            // Calculate price volatility for arbitrage opportunities
                            let price_volatility = ((trade.maximum_price - trade.minimum_price) / trade.median_price) * 100.0;
                            
                            if price_volatility > min_profit_threshold {
                                let opportunity = ArbitrageOpportunity {
                                    id: format!("bitquery_{}", chrono::Utc::now().timestamp_millis()),
                                    source: "Bitquery".to_string(),
                                    pair: format!("{}/{}", trade.base_currency.symbol, trade.quote_currency.symbol),
                                    buy_exchange: format!("{} DEX", chain),
                                    sell_exchange: format!("{} DEX", chain),
                                    buy_price: Decimal::from_f64(trade.minimum_price).unwrap_or_default(),
                                    sell_price: Decimal::from_f64(trade.maximum_price).unwrap_or_default(),
                                    profit_percentage: price_volatility,
                                    estimated_profit: Decimal::from_f64(trade.trade_amount * price_volatility / 100.0).unwrap_or_default(),
                                    required_capital: Decimal::from_f64(trade.trade_amount).unwrap_or_default(),
                                    confidence: 0.80, // High confidence for Bitquery historical data
                                    timestamp: chrono::Utc::now().timestamp() as u64,
                                    route_info: Some(format!("Chain: {} | Trades: {} | Volume: ${:.2}", 
                                                           chain, trade.trades, trade.trade_amount)),
                                };
                                
                                opportunities.push(opportunity);
                                
                                info!("🎯 Bitquery arbitrage opportunity found: {} with {:.2}% volatility", 
                                      trade.base_currency.symbol, price_volatility);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("⚠️ Failed to get Bitquery data for {}/{}: {}", base_currency, quote_currency, e);
                }
            }
            
            // Rate limiting for Bitquery (30 requests per minute for free tier)
            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
        }

        Ok(opportunities)
    }

    /// Get real-time price data from external APIs for price scanning
    pub async fn get_real_time_prices(&self) -> Result<HashMap<String, f64>> {
        let mut prices = HashMap::new();
        
        // Get SOL price from Jupiter API (SOL/USDC)
        match self.get_jupiter_quote(
            SolanaTokens::SOL,
            SolanaTokens::USDC,
            1_000_000_000, // 1 SOL in lamports
            Some(50), // 0.5% slippage
        ).await {
            Ok(quote) => {
                if let Ok(in_amount) = quote.in_amount.parse::<f64>() {
                    if let Ok(out_amount) = quote.out_amount.parse::<f64>() {
                        let sol_price = (out_amount / 1_000_000.0) / (in_amount / 1_000_000_000.0); // Convert from lamports/micro-USDC
                        prices.insert("SOL/USDC".to_string(), sol_price);
                        info!("🎯 Jupiter SOL price: ${:.2}", sol_price);
                    }
                }
            }
            Err(e) => {
                warn!("⚠️ Failed to get SOL price from Jupiter: {}", e);
            }
        }
        
        // Get SOL price from GeckoTerminal (Raydium pool)
        match self.get_geckoterminal_pool("solana", GeckoTerminalPools::SOLANA_SOL_USDC_RAYDIUM).await {
            Ok(response) => {
                if let Ok(price) = response.data.attributes.base_token_price_usd.parse::<f64>() {
                    prices.insert("SOL/USDC_RAYDIUM".to_string(), price);
                    info!("🎯 GeckoTerminal SOL price (Raydium): ${:.2}", price);
                }
            }
            Err(e) => {
                warn!("⚠️ Failed to get SOL price from GeckoTerminal: {}", e);
            }
        }
        
        // Get SOL price from DEX Screener
        match self.get_dexscreener_token(SolanaTokens::SOL).await {
            Ok(response) => {
                if let Some(pair) = response.pairs.first() {
                    if let Some(price_usd) = &pair.price_usd {
                        if let Ok(price) = price_usd.parse::<f64>() {
                            prices.insert("SOL/USDC_DEXSCREENER".to_string(), price);
                            info!("🎯 DEX Screener SOL price: ${:.2}", price);
                        }
                    }
                }
            }
            Err(e) => {
                warn!("⚠️ Failed to get SOL price from DEX Screener: {}", e);
            }
        }
        
        // Calculate average SOL price if we have multiple sources
        let sol_prices: Vec<f64> = prices.values().cloned().collect();
        if !sol_prices.is_empty() {
            let avg_sol_price = sol_prices.iter().sum::<f64>() / sol_prices.len() as f64;
            prices.insert("SOL/USDC_AVERAGE".to_string(), avg_sol_price);
            info!("📊 Average SOL price from {} sources: ${:.2}", sol_prices.len(), avg_sol_price);
        }
        
        // Add other token prices with realistic values based on current market
        // These could be enhanced to use real API calls as well
        prices.insert("ETH/USDC".to_string(), 3400.00);
        prices.insert("BTC/USDC".to_string(), 95000.00);
        prices.insert("RAY/USDC".to_string(), 2.45);
        prices.insert("ORCA/USDC".to_string(), 1.85);
        
        // If no external prices were fetched, add fallback SOL price
        if !prices.contains_key("SOL/USDC") && !prices.contains_key("SOL/USDC_AVERAGE") {
            prices.insert("SOL/USDC".to_string(), 171.12); // Updated to current market price
            warn!("⚠️ Using fallback SOL price: $171.12");
        }
        
        Ok(prices)
    }
}

// ============================================================================
// ARBITRAGE OPPORTUNITY STRUCTURE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOpportunity {
    pub id: String,
    pub source: String, // "Jupiter", "GeckoTerminal", "Cross-DEX"
    pub pair: String,
    pub buy_exchange: String,
    pub sell_exchange: String,
    pub buy_price: Decimal,
    pub sell_price: Decimal,
    pub profit_percentage: f64,
    pub estimated_profit: Decimal,
    pub required_capital: Decimal,
    pub confidence: f64, // 0.0 to 1.0
    pub timestamp: u64,
    pub route_info: Option<String>,
}

impl Default for ExternalApiClient {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// COMMON TOKEN ADDRESSES FOR SOLANA
// ============================================================================

pub struct SolanaTokens;

impl SolanaTokens {
    pub const SOL: &'static str = "So11111111111111111111111111111111111111112";
    pub const USDC: &'static str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    pub const USDT: &'static str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    pub const RAY: &'static str = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    pub const SRM: &'static str = "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt";
    pub const ORCA: &'static str = "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE";
}

// ============================================================================
// COMMON POOL ADDRESSES FOR GECKOTERMINAL
// ============================================================================

pub struct GeckoTerminalPools;

impl GeckoTerminalPools {
    // Solana network pools
    pub const SOLANA_SOL_USDC_RAYDIUM: &'static str = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
    pub const SOLANA_SOL_USDC_ORCA: &'static str = "EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U";
    pub const SOLANA_RAY_USDC: &'static str = "6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg";
    
    // Ethereum network pools (for future expansion)
    pub const ETHEREUM_ETH_USDC_UNISWAP_V3: &'static str = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
    pub const ETHEREUM_ETH_USDT_UNISWAP_V3: &'static str = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36";
} 
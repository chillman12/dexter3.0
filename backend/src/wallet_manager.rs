use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub address: String,
    pub wallet_type: WalletType,
    pub balance: f64,
    pub tokens: HashMap<String, TokenBalance>,
    pub connected: bool,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WalletType {
    Phantom,
    MetaMask,
    Solflare,
    WalletConnect,
    Ledger,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub symbol: String,
    pub address: String,
    pub balance: f64,
    pub decimals: u8,
    pub price_usd: f64,
    pub value_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub wallet: String,
    pub tx_type: TransactionType,
    pub status: TransactionStatus,
    pub hash: Option<String>,
    pub amount: f64,
    pub token: String,
    pub gas_fee: f64,
    pub timestamp: u64,
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionType {
    Swap,
    Transfer,
    Approve,
    Stake,
    Unstake,
    AddLiquidity,
    RemoveLiquidity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
    Cancelled,
}

pub struct WalletManager {
    wallets: Arc<RwLock<HashMap<String, Wallet>>>,
    transactions: Arc<RwLock<Vec<Transaction>>>,
}

impl WalletManager {
    pub fn new() -> Self {
        Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            transactions: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn connect_wallet(&self, wallet_type: WalletType, address: String) -> Result<Wallet, String> {
        let mut wallets = self.wallets.write().await;
        
        // Check if wallet already connected
        if wallets.contains_key(&address) {
            return Err("Wallet already connected".to_string());
        }

        // Create new wallet entry
        let wallet = Wallet {
            address: address.clone(),
            wallet_type,
            balance: 0.0,
            tokens: HashMap::new(),
            connected: true,
            last_activity: chrono::Utc::now().timestamp() as u64,
        };

        wallets.insert(address.clone(), wallet.clone());
        
        // Fetch balances asynchronously
        self.update_wallet_balances(&address).await?;
        
        Ok(wallet)
    }

    pub async fn disconnect_wallet(&self, address: &str) -> Result<(), String> {
        let mut wallets = self.wallets.write().await;
        
        if let Some(mut wallet) = wallets.get_mut(address) {
            wallet.connected = false;
            Ok(())
        } else {
            Err("Wallet not found".to_string())
        }
    }

    pub async fn get_wallet(&self, address: &str) -> Option<Wallet> {
        let wallets = self.wallets.read().await;
        wallets.get(address).cloned()
    }

    pub async fn update_wallet_balances(&self, address: &str) -> Result<(), String> {
        let mut wallets = self.wallets.write().await;
        
        if let Some(wallet) = wallets.get_mut(address) {
            // Simulate balance updates - will be replaced with actual RPC calls
            wallet.balance = 10.5; // SOL balance
            
            // Update token balances
            wallet.tokens.insert("USDC".to_string(), TokenBalance {
                symbol: "USDC".to_string(),
                address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(),
                balance: 1000.0,
                decimals: 6,
                price_usd: 1.0,
                value_usd: 1000.0,
            });
            
            wallet.tokens.insert("USDT".to_string(), TokenBalance {
                symbol: "USDT".to_string(),
                address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB".to_string(),
                balance: 500.0,
                decimals: 6,
                price_usd: 1.0,
                value_usd: 500.0,
            });
            
            wallet.last_activity = chrono::Utc::now().timestamp() as u64;
            Ok(())
        } else {
            Err("Wallet not found".to_string())
        }
    }

    pub async fn create_transaction(
        &self,
        wallet: String,
        tx_type: TransactionType,
        amount: f64,
        token: String,
        details: serde_json::Value,
    ) -> Result<Transaction, String> {
        let transaction = Transaction {
            id: uuid::Uuid::new_v4().to_string(),
            wallet,
            tx_type,
            status: TransactionStatus::Pending,
            hash: None,
            amount,
            token,
            gas_fee: 0.000005, // Estimated SOL gas fee
            timestamp: chrono::Utc::now().timestamp() as u64,
            details,
        };
        
        let mut transactions = self.transactions.write().await;
        transactions.push(transaction.clone());
        
        Ok(transaction)
    }

    pub async fn update_transaction_status(
        &self,
        tx_id: &str,
        status: TransactionStatus,
        hash: Option<String>,
    ) -> Result<(), String> {
        let mut transactions = self.transactions.write().await;
        
        if let Some(tx) = transactions.iter_mut().find(|t| t.id == tx_id) {
            tx.status = status;
            tx.hash = hash;
            Ok(())
        } else {
            Err("Transaction not found".to_string())
        }
    }

    pub async fn get_wallet_transactions(&self, wallet: &str) -> Vec<Transaction> {
        let transactions = self.transactions.read().await;
        transactions
            .iter()
            .filter(|t| t.wallet == wallet)
            .cloned()
            .collect()
    }

    pub async fn estimate_gas(&self, tx_type: &TransactionType) -> f64 {
        // Placeholder gas estimation - will be replaced with actual RPC calls
        match tx_type {
            TransactionType::Swap => 0.000005,
            TransactionType::Transfer => 0.000005,
            TransactionType::Approve => 0.000005,
            TransactionType::Stake => 0.00001,
            TransactionType::Unstake => 0.00001,
            TransactionType::AddLiquidity => 0.00002,
            TransactionType::RemoveLiquidity => 0.00002,
        }
    }

    pub async fn sign_and_send_transaction(
        &self,
        wallet: &str,
        transaction: &Transaction,
    ) -> Result<String, String> {
        // Placeholder for actual transaction signing and sending
        // This will integrate with wallet SDKs
        
        // Simulate transaction hash
        let hash = format!("0x{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
        
        self.update_transaction_status(&transaction.id, TransactionStatus::Confirmed, Some(hash.clone())).await?;
        
        Ok(hash)
    }
}

// Wallet connection message handler for WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletMessage {
    pub action: String,
    pub wallet_type: Option<WalletType>,
    pub address: Option<String>,
    pub signature: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletResponse {
    pub success: bool,
    pub wallet: Option<Wallet>,
    pub error: Option<String>,
}

// Security module for wallet operations
pub struct WalletSecurity {
    nonce_store: Arc<RwLock<HashMap<String, String>>>,
}

impl WalletSecurity {
    pub fn new() -> Self {
        Self {
            nonce_store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn generate_nonce(&self, wallet: &str) -> String {
        let nonce = uuid::Uuid::new_v4().to_string();
        let mut store = self.nonce_store.write().await;
        store.insert(wallet.to_string(), nonce.clone());
        nonce
    }

    pub async fn verify_signature(
        &self,
        wallet: &str,
        message: &str,
        signature: &str,
    ) -> Result<bool, String> {
        // Placeholder for signature verification
        // Will integrate with wallet SDKs for actual verification
        Ok(true)
    }

    pub async fn verify_nonce(&self, wallet: &str, nonce: &str) -> bool {
        let store = self.nonce_store.read().await;
        store.get(wallet).map(|n| n == nonce).unwrap_or(false)
    }
}
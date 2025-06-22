// Import Solana Web3.js - handle both browser and node environments
let Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL;

if (typeof window !== 'undefined' && window.solanaWeb3) {
    // Browser environment - use global solanaWeb3
    ({ Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3);
} else {
    // Node/webpack environment
    const solanaWeb3 = require('@solana/web3.js');
    ({ Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3);
}

class SolanaWallet {
    constructor() {
        this.connection = new Connection('https://jolyn-7h3xbe-fast-mainnet.helius-rpc.com', 'confirmed');
        this.wallet = null;
        this.publicKey = null;
        this.isConnected = false;
        
        // Game wallet addresses - will be set from server
        this.TREASURY_WALLET = null;
        this.DEV_WALLET = null;
        
        // Entry fee configuration
        this.ENTRY_FEE = 0.075; // SOL
        this.TREASURY_PERCENTAGE = 0.9; // 90%
        this.DEV_PERCENTAGE = 0.1; // 10%
    }

    // Set wallet addresses from server config
    setWalletAddresses(treasuryWallet, devWallet) {
        this.TREASURY_WALLET = treasuryWallet;
        this.DEV_WALLET = devWallet;
    }

    // Check if Phantom wallet is installed
    isPhantomInstalled() {
        const { solana } = window;
        return !!(solana && solana.isPhantom);
    }

    // Connect to wallet
    async connect() {
        try {
            if (!this.isPhantomInstalled()) {
                throw new Error('Phantom wallet is not installed!');
            }

            const { solana } = window;
            const response = await solana.connect();
            this.publicKey = response.publicKey;
            this.wallet = solana;
            this.isConnected = true;

            console.log('Connected to wallet:', this.publicKey.toString());
            return {
                success: true,
                publicKey: this.publicKey.toString()
            };
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Disconnect wallet
    async disconnect() {
        try {
            if (this.wallet) {
                await this.wallet.disconnect();
            }
            this.publicKey = null;
            this.wallet = null;
            this.isConnected = false;
            return { success: true };
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
            return { success: false, error: error.message };
        }
    }

    // Get wallet balance
    async getBalance() {
        try {
            if (!this.publicKey) {
                throw new Error('Wallet not connected');
            }

            const balance = await this.connection.getBalance(this.publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    // Process entry fee payment
    async processEntryFee() {
        try {
            if (!this.isConnected || !this.publicKey) {
                throw new Error('Wallet not connected');
            }

            if (!this.TREASURY_WALLET || !this.DEV_WALLET) {
                throw new Error('Wallet addresses not configured');
            }

            // Calculate fee distribution
            const totalLamports = Math.floor(this.ENTRY_FEE * LAMPORTS_PER_SOL);
            const treasuryAmount = Math.floor(totalLamports * this.TREASURY_PERCENTAGE);
            const devAmount = totalLamports - treasuryAmount; // Ensure no rounding loss
            
            console.log('Payment breakdown:', {
                totalSOL: this.ENTRY_FEE,
                totalLamports: totalLamports,
                treasurySOL: treasuryAmount / LAMPORTS_PER_SOL,
                devSOL: devAmount / LAMPORTS_PER_SOL
            });

            // Create transaction
            const transaction = new Transaction();

            // Add treasury transfer
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: this.publicKey,
                    toPubkey: new PublicKey(this.TREASURY_WALLET),
                    lamports: treasuryAmount,
                })
            );

            // Add dev team transfer
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: this.publicKey,
                    toPubkey: new PublicKey(this.DEV_WALLET),
                    lamports: devAmount,
                })
            );

            // Get recent blockhash
            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.publicKey;

            // Sign and send transaction
            const signed = await this.wallet.signTransaction(transaction);
            const txid = await this.connection.sendRawTransaction(signed.serialize());

            // Confirm transaction
            await this.connection.confirmTransaction(txid);

            return {
                success: true,
                transactionId: txid,
                treasuryAmount: treasuryAmount / LAMPORTS_PER_SOL,
                devAmount: devAmount / LAMPORTS_PER_SOL
            };
        } catch (error) {
            console.error('Error processing entry fee:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get current prize pool
    async getPrizePool() {
        try {
            const treasuryBalance = await this.connection.getBalance(new PublicKey(this.TREASURY_WALLET));
            return treasuryBalance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting prize pool:', error);
            return 0;
        }
    }

    // Verify payment on server side (to be called from server)
    static async verifyPayment(transactionId, expectedAmount) {
        try {
            const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
            const transaction = await connection.getTransaction(transactionId);
            
            if (!transaction) {
                return { valid: false, error: 'Transaction not found' };
            }

            // Check if transaction was successful
            if (transaction.meta.err !== null) {
                return { valid: false, error: 'Transaction failed' };
            }

            // Verify the amounts and recipients
            // This is a simplified version - in production, you'd want more thorough verification
            const postBalances = transaction.meta.postBalances;
            const preBalances = transaction.meta.preBalances;
            
            let totalTransferred = 0;
            for (let i = 0; i < postBalances.length; i++) {
                if (preBalances[i] > postBalances[i]) {
                    totalTransferred += (preBalances[i] - postBalances[i]) / LAMPORTS_PER_SOL;
                }
            }

            if (Math.abs(totalTransferred - expectedAmount) < 0.001) { // Allow small rounding differences
                return { valid: true, amount: totalTransferred };
            } else {
                return { valid: false, error: 'Invalid payment amount' };
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
            return { valid: false, error: error.message };
        }
    }
}

// Export for both CommonJS and browser
if (typeof window !== 'undefined') {
    window.SolanaWallet = SolanaWallet;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaWallet;
} 
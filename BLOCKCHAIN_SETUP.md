# Blockchain Integration Setup Guide

This guide explains how to set up and configure the Solana blockchain integration for the Agar.io clone.

## Features

- **Solana Wallet Integration**: Players must connect their Solana wallet (Phantom, Solflare, etc.) to play
- **Entry Fee System**: 0.075 SOL entry fee per game
  - 90% goes to the prize pool (treasury)
  - 10% goes to the development team
- **Prize Pool Display**: Real-time display of the current prize pool
- **Secure Payment Verification**: Server-side verification of all payments

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Wallet Addresses

1. Copy the example environment file:
```bash
cp env.example .env
```

2. Edit `.env` and add your Solana wallet addresses:
```
TREASURY_WALLET=YOUR_TREASURY_WALLET_ADDRESS_HERE
DEV_WALLET=YOUR_DEV_TEAM_WALLET_ADDRESS_HERE
```

### 3. Update Server Configuration

Make sure your server loads the environment variables. Add this to the top of `src/server/server.js`:

```javascript
require('dotenv').config();
```

### 4. Build and Run

```bash
# Development mode
npm run watch

# Production mode
npm run build
npm start
```

## How It Works

### Player Flow

1. Player visits the game website
2. Clicks "CONNECT WALLET" to connect their Solana wallet
3. Enters their player name
4. Clicks "PAY & PLAY" to pay the entry fee
5. The game processes the payment:
   - 90% (0.0675 SOL) goes to the treasury wallet
   - 10% (0.0075 SOL) goes to the dev wallet
6. Server verifies the payment on-chain
7. Player can start playing after successful verification

### Security Features

- All payment verification happens on the server side
- Transaction IDs are verified against the Solana blockchain
- Players cannot bypass payment by modifying client code
- Each player's payment status is tracked server-side

## Customization

### Changing Entry Fee

Update these values in both client and server:

**Client** (`src/client/js/solana-wallet.js`):
```javascript
this.ENTRY_FEE = 0.075; // SOL
```

**Server** (`src/server/server.js`):
```javascript
const ENTRY_FEE = 0.075; // SOL
```

### Changing Fee Distribution

Update the percentages in `src/client/js/solana-wallet.js`:
```javascript
this.TREASURY_PERCENTAGE = 0.9; // 90%
this.DEV_PERCENTAGE = 0.1; // 10%
```

## Testing on Devnet

To test on Solana devnet instead of mainnet:

1. Update the RPC endpoint in `src/client/js/solana-wallet.js`:
```javascript
this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
```

2. Update the server verification in `src/server/server.js`:
```javascript
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
```

3. Make sure your wallet is set to devnet in Phantom

## Troubleshooting

### "Phantom wallet is not installed"
- Install the Phantom browser extension from https://phantom.app/

### "Payment verification failed"
- Check that your wallet addresses are correct in the `.env` file
- Ensure you have sufficient SOL balance
- Check the browser console for detailed error messages

### Build errors with crypto modules
- Make sure all polyfill dependencies are installed
- Clear the `node_modules` folder and reinstall: `rm -rf node_modules && npm install`

## Prize Pool Distribution

The prize pool distribution to winners needs to be implemented based on your game rules. You'll need to:

1. Determine the winner(s) when a game ends
2. Create a distribution mechanism (could be manual or automated)
3. Send the prize pool to the winner's wallet address

This can be added to the server-side game logic in future updates. 
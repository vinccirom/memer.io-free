/*jslint bitwise: true, node: true */
'use strict';

require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const gameLogic = require('./game-logic');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');
const {getPosition} = require("./lib/entityUtils");

let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
let paidPlayers = {}; // Track players who have paid
let gameWon = false; // Track if game has been won
let winnerHistory = []; // Store history of winners
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

const Vector = SAT.Vector;

// Solana configuration
const TREASURY_WALLET = process.env.TREASURY_WALLET;
const DEV_WALLET = process.env.DEV_WALLET;
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
const ENTRY_FEE = 0.075; // SOL

// Validate wallet addresses
if (!TREASURY_WALLET || !DEV_WALLET) {
    console.error('[ERROR] Missing wallet addresses in environment variables!');
    console.error('Please set TREASURY_WALLET and DEV_WALLET in your .env file');
    process.exit(1);
}

app.use(express.static(__dirname + '/../client'));

// API endpoint for game configuration
app.get('/api/config', (req, res) => {
    res.json({
        treasuryWallet: TREASURY_WALLET,
        devWallet: DEV_WALLET,
        entryFee: ENTRY_FEE
    });
});

// API endpoint to get winner history
app.get('/api/winners', (req, res) => {
    res.json(winnerHistory.slice(-10)); // Return last 10 winners
});

// Process winner payout
async function processWinnerPayout(winnerWallet) {
    try {
        if (!TREASURY_PRIVATE_KEY) {
            console.error('[PAYOUT] Treasury private key not configured!');
            return { success: false, error: 'Treasury private key not configured' };
        }
        
        // Get treasury balance
        const connection = new Connection('https://jolyn-7h3xbe-fast-mainnet.helius-rpc.com', 'confirmed');
        const treasuryPubkey = new PublicKey(TREASURY_WALLET);
        const treasuryBalance = await connection.getBalance(treasuryPubkey);
        
        // Reserve some SOL for transaction fees (0.001 SOL)
        const feeReserve = 0.001 * LAMPORTS_PER_SOL;
        const payoutLamports = treasuryBalance - feeReserve;
        
        if (payoutLamports <= 0) {
            return { success: false, error: 'Insufficient treasury balance for payout' };
        }
        
        const payoutAmount = payoutLamports / LAMPORTS_PER_SOL;
        
        // Create keypair from private key
        const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
        
        // Create payout transaction
        const transaction = new Transaction();
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: treasuryPubkey,
                toPubkey: new PublicKey(winnerWallet),
                lamports: payoutLamports,
            })
        );
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasuryPubkey;
        
        // Sign and send transaction
        transaction.sign(treasuryKeypair);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
        }
        
        console.log('[PAYOUT] Winner payout successful!');
        console.log('[PAYOUT] Transaction ID:', signature);
        console.log('[PAYOUT] Amount:', payoutAmount, 'SOL');
        
        return {
            success: true,
            amount: payoutAmount,
            transactionId: signature,
            message: 'Payout transaction completed'
        };
    } catch (error) {
        console.error('[PAYOUT] Error processing payout:', error);
        return { success: false, error: error.message };
    }
}

// Handle winner
async function handleWinner(winner) {
    console.log('[GAME] Winner found:', winner.name, 'with mass:', winner.massTotal);
    
    // Find winner's wallet address
    let winnerWallet = null;
    for (const socketId in paidPlayers) {
        if (paidPlayers[socketId].playerName === winner.name) {
            winnerWallet = paidPlayers[socketId].walletAddress;
            break;
        }
    }
    
    if (!winnerWallet) {
        console.error('[GAME] Winner wallet not found!');
        return;
    }
    
    // Process payout
    const payoutResult = await processWinnerPayout(winnerWallet);
    
    // Store winner in history
    const winnerRecord = {
        name: winner.name,
        walletAddress: winnerWallet,
        mass: winner.massTotal,
        prizeAmount: payoutResult.amount || 0,
        timestamp: new Date().toISOString(),
        transactionId: payoutResult.transactionId || 'pending'
    };
    winnerHistory.push(winnerRecord);
    
    // Emit winner announcement to all players
    io.emit('gameWon', {
        winner: winner.name,
        walletAddress: winnerWallet,
        mass: winner.massTotal,
        prizeAmount: payoutResult.amount || 0,
        transactionId: payoutResult.transactionId || 'pending',
        payoutSuccess: payoutResult.success,
        payoutError: payoutResult.error || null
    });
    
    // Reset game after 2 minutes to give players time to celebrate and screenshot
    setTimeout(() => {
        resetGame();
    }, 120000); // 2 minutes
}

// Reset game
function resetGame() {
    console.log('[GAME] Resetting game...');
    
    // Clear all players
    map.players.data = [];
    
    // Reset game state
    gameWon = false;
    
    // Clear paid players
    for (const socketId in paidPlayers) {
        delete paidPlayers[socketId];
    }
    
    // Disconnect all sockets
    for (const socketId in sockets) {
        sockets[socketId].emit('gameReset');
        sockets[socketId].disconnect();
    }
    
    // Regenerate map
    map = new mapUtils.Map(config);
    
    console.log('[GAME] Game reset complete');
}

// Verify Solana payment
async function verifyPayment(transactionId, expectedAmount = ENTRY_FEE) {
    try {
        const connection = new Connection('https://jolyn-7h3xbe-fast-mainnet.helius-rpc.com', 'confirmed');
        const transaction = await connection.getTransaction(transactionId, {
            maxSupportedTransactionVersion: 0
        });
        
        if (!transaction) {
            return { valid: false, error: 'Transaction not found' };
        }

        // Check if transaction was successful
        if (transaction.meta.err !== null) {
            return { valid: false, error: 'Transaction failed' };
        }

        // Verify the amounts - simplified version
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

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    
    // Handle payment verification
    socket.on('verifyPayment', async function(data) {
        const { transactionId, playerName, walletAddress, skin } = data;
        
        console.log('[PAYMENT] Verifying payment for player:', playerName);
        
        const verification = await verifyPayment(transactionId);
        
        if (verification.valid) {
            // Store the player as paid
            paidPlayers[socket.id] = {
                walletAddress: walletAddress,
                playerName: playerName,
                transactionId: transactionId,
                skin: skin || 'none',
                paidAt: new Date()
            };
            
            console.log('[PAYMENT] Payment verified for player:', playerName);
            socket.emit('paymentVerified', { success: true });
        } else {
            console.log('[PAYMENT] Payment verification failed for player:', playerName, verification.error);
            socket.emit('paymentVerified', { success: false, error: verification.error });
        }
    });
    
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}


const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);

    socket.on('gotit', function (clientPlayerData) {
        // Check if player has paid (for non-spectators)
        if (!paidPlayers[socket.id] && socket.handshake.query.type === 'player') {
            console.log('[WARNING] Player ' + clientPlayerData.name + ' sent gotit without payment verification!');
            console.log('[DEBUG] Current paidPlayers:', Object.keys(paidPlayers));
            socket.emit('kick', 'Payment required to play. Please refresh and try again.');
            socket.disconnect();
            return;
        }
        
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
            sockets[socket.id] = socket;

            const sanitizedName = clientPlayerData.name.replace(/(<([^>]+)>)/ig, '');
            clientPlayerData.name = sanitizedName;

            currentPlayer.clientProvidedData(clientPlayerData);
            map.players.pushNew(currentPlayer);
            io.emit('playerJoin', { name: currentPlayer.name });
            console.log('Total players: ' + map.players.data.length);
        }

    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        map.players.removePlayerByID(currentPlayer.id);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
        
        // Clean up paid player record
        if (paidPlayers[socket.id]) {
            console.log('[INFO] Removing payment record for disconnected player: ' + currentPlayer.name);
            delete paidPlayers[socket.id];
        }
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: currentPlayer.name,
            message: _message.substring(0, 35)
        });

        chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
            .catch((err) => console.error("Error when attempting to log chat message", err));
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with the incorrect password: ' + password);

            socket.emit('serverMSG', 'Password incorrect, attempt logged.');

            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('kick', (data) => {
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

        var reason = '';
        var worked = false;
        for (let playerIndex in map.players.data) {
            let player = map.players.data[playerIndex];
            if (player.name === data[0] && !player.admin && !worked) {
                if (data.length > 1) {
                    for (var f = 1; f < data.length; f++) {
                        if (f === data.length) {
                            reason = reason + data[f];
                        }
                        else {
                            reason = reason + data[f] + ' ';
                        }
                    }
                }
                if (reason !== '') {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                }
                else {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name);
                }
                socket.emit('serverMSG', 'User ' + player.name + ' was kicked by ' + currentPlayer.name);
                sockets[player.id].emit('kick', reason);
                sockets[player.id].disconnect();
                map.players.removePlayerByIndex(playerIndex);
                worked = true;
            }
        }
        if (!worked) {
            socket.emit('serverMSG', 'Could not locate user or user is an admin.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        // Fire food.
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
}

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
        io.emit('playerJoin', { name: '' });
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    const isEntityInsideCircle = (point, circle) => {
        return SAT.pointInCircle(new Vector(point.x, point.y), circle);
    };

    const canEatMass = (cell, cellCircle, cellIndex, mass) => {
        if (isEntityInsideCircle(mass, cellCircle)) {
            if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num)
                return false;
            if (cell.mass > mass.mass * 1.1)
                return true;
        }

        return false;
    };

    const canEatVirus = (cell, cellCircle, virus) => {
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];

        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
};

const tickGame = () => {
    map.players.data.forEach(tickPlayer);
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            let playerGotEaten = map.players.data[gotEaten.playerIndex];
            io.emit('playerDied', { name: playerGotEaten.name }); //TODO: on client it is `playerEatenName` instead of `name`
            sockets[playerGotEaten.id].emit('RIP');
            map.players.removePlayerByIndex(gotEaten.playerIndex);
        }
    });
    
    // Check for winner (first player to reach 3000 mass)
    if (!gameWon) {
        for (let i = 0; i < map.players.data.length; i++) {
            const player = map.players.data[i];
            if (player.massTotal >= config.winnerMassThreshold) {
                gameWon = true;
                handleWinner(player);
                break;
            }
        }
    }

};

const calculateLeaderboard = () => {
    const topPlayers = map.players.getTopPlayers();

    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    } else {
        for (let i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].id !== topPlayers[i].id || leaderboard[i].mass !== topPlayers[i].mass) {
                leaderboard = topPlayers;
                leaderboardChanged = true;
                break;
            }
        }
    }
}

const gameloop = () => {
    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }

    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
};

const sendUpdates = () => {
    spectators.forEach(updateSpectator);
    map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
        if (leaderboardChanged) {
            sendLeaderboard(sockets[playerData.id]);
        }
    });

    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}
const updateSpectator = (socketID) => {
    let playerData = {
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        id: socketID,
        name: ''
    };
    sockets[socketID].emit('serverTellPlayerMove', playerData, map.players.data, map.food.data, map.massFood.data, map.viruses.data);
    if (leaderboardChanged) {
        sendLeaderboard(sockets[socketID]);
    }
}

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));

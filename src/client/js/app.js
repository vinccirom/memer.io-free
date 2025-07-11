var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

// Skin system
var selectedSkin = null;
var skinCache = new Map();
var tokenSkinCache = new Map(); // Cache for custom token skins
var currentTokenSkin = null; // Currently loaded token skin
var availableSkins = [
    { id: 'none', name: 'No Skin', path: null },
    { id: 'michi', name: '$michi', path: 'img/skins/$michi.webp' },
    { id: 'wif', name: '$wif', path: 'img/skins/$wif.webp' },
    { id: 'act', name: 'act', path: 'img/skins/act.webp' },
    { id: 'ai16z', name: 'ai16z', path: 'img/skins/ai16z.webp' },
    { id: 'bome', name: 'bome', path: 'img/skins/bome.webp' },
    { id: 'bonk', name: 'bonk', path: 'img/skins/bonk.webp' },
    { id: 'chillguy', name: 'chillguy', path: 'img/skins/chillguy.webp' },
    { id: 'daddy', name: 'daddy', path: 'img/skins/daddy.webp' },
    { id: 'fartcoin', name: 'fartcoin', path: 'img/skins/fartcoin.webp' },
    { id: 'fwog', name: 'fwog', path: 'img/skins/fwog.webp' },
    { id: 'giga', name: 'giga', path: 'img/skins/giga.webp' },
    { id: 'goat', name: 'goat', path: 'img/skins/goat.webp' },
    { id: 'melania', name: 'melania', path: 'img/skins/melania.webp' },
    { id: 'mew', name: 'mew', path: 'img/skins/mew.webp' },
    { id: 'oiiaoiia', name: 'oiiaoiia', path: 'img/skins/oiiaoiia.webp' },
    { id: 'pengu', name: 'pengu', path: 'img/skins/pengu.webp' },
    { id: 'pnut', name: 'pnut', path: 'img/skins/pnut.webp' },
    { id: 'ponke', name: 'ponke', path: 'img/skins/ponke.webp' },
    { id: 'popcat', name: 'popcat', path: 'img/skins/popcat.webp' },
    { id: 'retardio', name: 'retardio', path: 'img/skins/retardio.webp' },
    { id: 'sigma', name: 'sigma', path: 'img/skins/sigma.webp' },
    { id: 'slerf', name: 'slerf', path: 'img/skins/slerf.webp' },
    { id: 'titcoin', name: 'titcoin', path: 'img/skins/titcoin.webp' },
    { id: 'trump', name: 'trump', path: 'img/skins/trump.webp' },
    { id: 'ufd', name: 'ufd', path: 'img/skins/ufd.webp' },
    { id: 'zerebro', name: 'zerebro', path: 'img/skins/zerebro.webp' }
];

// Check if user is on mobile
function checkIfMobile() {
    const playBtn = document.getElementById('playBtn');
    
    if (global.mobile) {
        playBtn.disabled = true;
        playBtn.style.opacity = '0.5';
        playBtn.style.cursor = 'not-allowed';
        playBtn.innerHTML = '<span class="button-text">MOBILE NOT SUPPORTED</span>';
    }
}

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}


// Update player count display
async function updatePlayerCount() {
    try {
        const response = await fetch('/api/game-status');
        const gameStatus = await response.json();
        document.getElementById('playerCount').textContent = `Players: ${gameStatus.currentPlayers}/${gameStatus.maxPlayers}`;
        
        // Add warning color if getting close to full
        const playerCountEl = document.getElementById('playerCount');
        if (gameStatus.currentPlayers >= gameStatus.maxPlayers * 0.9) {
            playerCountEl.style.color = '#FF5555'; // Red when 90% full
        } else if (gameStatus.currentPlayers >= gameStatus.maxPlayers * 0.75) {
            playerCountEl.style.color = '#FFD700'; // Yellow when 75% full
        } else {
            playerCountEl.style.color = '#4CAF50'; // Green otherwise
        }
    } catch (error) {
        console.error('Error updating player count:', error);
    }
}

// Show loading overlay
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Show error message
function showError(message) {
    alert('Error: ' + message);
}

// Load winner history
async function loadWinnerHistory() {
    try {
        const response = await fetch('/api/winners');
        const winners = await response.json();
        
        const winnersList = document.getElementById('winnersList');
        
        if (winners.length === 0) {
            winnersList.innerHTML = '<div class="loading-text">No winners yet</div>';
            return;
        }
        
        winnersList.innerHTML = winners.map(winner => {
            const date = new Date(winner.timestamp).toLocaleDateString();
            
            return `
                <div class="winner-item">
                    <div class="winner-item-name">${winner.name}</div>
                    <div class="winner-item-details">
                        Winner | ${date}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading winner history:', error);
        document.getElementById('winnersList').innerHTML = '<div class="loading-text">Failed to load</div>';
    }
}


// Initialize skin system
function initializeSkins() {
    const skinGrid = document.getElementById('skinGrid');
    if (!skinGrid) return;
    
    // Clear existing content
    skinGrid.innerHTML = '';
    
    // Create skin items
    availableSkins.forEach((skin, index) => {
        const skinItem = document.createElement('div');
        skinItem.className = 'skin-item';
        skinItem.dataset.skinId = skin.id;
        
        if (skin.id === 'none') {
            skinItem.classList.add('no-skin');
            skinItem.innerHTML = 'NONE';
        } else {
            const img = document.createElement('img');
            img.src = skin.path;
            img.alt = skin.name;
            img.loading = index < 6 ? 'eager' : 'lazy'; // Eager load first 6 skins
            
            // Preload and cache the image
            img.onload = function() {
                skinCache.set(skin.id, img);
            };
            
            skinItem.appendChild(img);
        }
        
        // Add click handler
        skinItem.addEventListener('click', function() {
            selectSkin(skin.id);
        });
        
        skinGrid.appendChild(skinItem);
    });
    
    // Select default skin (none) or previously selected
    const savedSkin = localStorage.getItem('selectedSkin') || 'none';
    selectSkin(savedSkin);
}

// Select a skin
function selectSkin(skinId) {
    // Remove previous selection
    const previousSelected = document.querySelector('.skin-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }
    
    // Add selection to new skin
    const skinItem = document.querySelector(`[data-skin-id="${skinId}"]`);
    if (skinItem) {
        skinItem.classList.add('selected');
        selectedSkin = skinId;
        
        // Store selection in localStorage
        localStorage.setItem('selectedSkin', skinId);
    }
}

// Load a skin image for a player
function loadSkinImage(skinId) {
    // Check if it's a token skin
    if (skinId && skinId.startsWith('token_')) {
        return loadTokenSkinImage(skinId);
    }
    
    // Check cache first
    if (skinCache.has(skinId)) {
        return skinCache.get(skinId);
    }
    
    // Find skin data
    const skinData = availableSkins.find(s => s.id === skinId);
    if (!skinData || !skinData.path) {
        return null;
    }
    
    // Load and cache the image
    const img = new Image();
    img.src = skinData.path;
    img.onload = function() {
        skinCache.set(skinId, img);
    };
    
    return img;
}

// Load a token skin image
function loadTokenSkinImage(skinId) {
    // Check cache first
    if (tokenSkinCache.has(skinId)) {
        return tokenSkinCache.get(skinId);
    }
    
    // Request the skin from server if we don't have it
    if (!tokenSkinCache.has(skinId) && socket && socket.connected) {
        socket.emit('requestTokenSkins', [skinId]);
    }
    
    return null; // Will be loaded asynchronously
}

// Load token skin from server
async function loadTokenSkin(tokenAddress) {
    const loadingStatus = document.getElementById('tokenLoadingStatus');
    const loadTokenBtn = document.getElementById('loadTokenSkinBtn');
    
    // Show loading status
    loadingStatus.textContent = 'Loading token...';
    loadingStatus.className = 'token-loading-status loading';
    loadTokenBtn.disabled = true;
    
    try {
        const response = await fetch(`/api/token-skin/${tokenAddress}`);
        const tokenData = await response.json();
        
        if (response.ok) {
            // Create and cache the image
            const img = new Image();
            img.src = tokenData.image;
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            // Store in cache
            tokenSkinCache.set(tokenData.id, img);
            
            // Store the token data
            currentTokenSkin = tokenData;
            
            // Add to skin grid
            addTokenSkinToGrid(tokenData);
            
            // Show success
            loadingStatus.textContent = `Loaded ${tokenData.symbol}!`;
            loadingStatus.className = 'token-loading-status success';
            
            // Auto-select the new token skin
            selectSkin(tokenData.id);
        } else {
            throw new Error(tokenData.error || 'Failed to load token');
        }
    } catch (error) {
        console.error('Error loading token skin:', error);
        loadingStatus.textContent = 'Error: ' + error.message;
        loadingStatus.className = 'token-loading-status error';
    } finally {
        loadTokenBtn.disabled = false;
    }
}

// Add token skin to the skin grid
function addTokenSkinToGrid(tokenData) {
    const skinGrid = document.getElementById('skinGrid');
    
    // Remove any existing token skin
    const existingTokenSkin = skinGrid.querySelector('[data-skin-id^="token_"]');
    if (existingTokenSkin) {
        existingTokenSkin.remove();
    }
    
    // Create new skin item
    const skinItem = document.createElement('div');
    skinItem.className = 'skin-item';
    skinItem.dataset.skinId = tokenData.id;
    skinItem.style.border = '2px solid #FFD700'; // Gold border for token skins
    
    const img = document.createElement('img');
    img.src = tokenData.image;
    img.alt = tokenData.name;
    img.title = `${tokenData.name} (${tokenData.symbol})`;
    
    skinItem.appendChild(img);
    
    // Add click handler
    skinItem.addEventListener('click', function() {
        selectSkin(tokenData.id);
    });
    
    // Add to beginning of grid
    skinGrid.insertBefore(skinItem, skinGrid.firstChild);
}

async function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;
    global.playerSkin = selectedSkin || 'none';
    
    // Include token skin data if using a token skin
    if (global.playerSkin.startsWith('token_') && currentTokenSkin) {
        global.tokenSkinData = currentTokenSkin;
    }

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0';
    document.getElementById('startMenuWrapper').style.display = 'none';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    document.getElementById('screenshotNotice').style.display = 'block';
    document.body.classList.add('game-active');
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = async function () {

    var playBtn = document.getElementById('playBtn'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#playerSection .input-error');
    
    // Initialize animated background
    initializeBackground();
    
    // Initialize audio
    initializeAudio();

    // Fetch game configuration from server
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Update UI with dynamic values from server
        if (config.winnerMassThreshold) {
            document.getElementById('winnerMassThreshold').textContent = config.winnerMassThreshold;
        }
    } catch (error) {
        console.error('Failed to fetch game configuration:', error);
    }

    
    // Initialize player count display
    updatePlayerCount();
    // Update player count every 5 seconds
    setInterval(updatePlayerCount, 5000);
    
    // Load winner history
    loadWinnerHistory();
    
    // Initialize skins
    initializeSkins();
    
    // Load token skin button
    var loadTokenBtn = document.getElementById('loadTokenSkinBtn');
    var tokenAddressInput = document.getElementById('tokenAddressInput');
    
    loadTokenBtn.onclick = function() {
        const tokenAddress = tokenAddressInput.value.trim();
        if (tokenAddress) {
            loadTokenSkin(tokenAddress);
        } else {
            document.getElementById('tokenLoadingStatus').textContent = 'Please enter a token address';
            document.getElementById('tokenLoadingStatus').className = 'token-loading-status error';
        }
    };
    
    tokenAddressInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadTokenBtn.click();
        }
    });

    // Check if mobile and disable play button
    checkIfMobile();


    // Play button
    playBtn.onclick = async function () {
        // Check if user is on mobile
        if (global.mobile) {
            showError('The game should be played on computer, soon available on mobile');
            return;
        }

        // Validate nickname is not empty
        if (playerNameInput.value.trim() === '') {
            nickErrorText.textContent = 'Please enter a name!';
            nickErrorText.style.opacity = 1;
            return;
        }
        
        // Validate nickname format
        if (!validNick()) {
            nickErrorText.textContent = 'Nick must be alphanumeric characters only!';
            nickErrorText.style.opacity = 1;
            return;
        }
        nickErrorText.style.opacity = 0;


        // Check if game is full
        try {
            const statusResponse = await fetch('/api/game-status');
            const gameStatus = await statusResponse.json();
            
            if (gameStatus.isFull) {
                showError(`Game is full! (${gameStatus.currentPlayers}/${gameStatus.maxPlayers} players). Please try again later.`);
                return;
            }
        } catch (error) {
            console.error('Error checking game status:', error);
            showError('Failed to check game status. Please try again.');
            return;
        }

        // Start the game immediately
        startGame('player');
    };

    // Spectate button
    btnS.onclick = function () {
        startGame('spectator');
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.classList.contains('open')) {
            settings.classList.remove('open');
        } else {
            settings.classList.add('open');
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            playBtn.click();
        }
    });
    
    // Chat toggle functionality
    var chatToggle = document.getElementById('chatToggle');
    if (chatToggle) {
        chatToggle.onclick = function() {
            var chatbox = document.getElementById('chatbox');
            chatbox.classList.toggle('collapsed');
            this.textContent = chatbox.classList.contains('collapsed') ? '💬' : '❌';
        };
    }
    
    // Refresh game button
    var refreshBtn = document.getElementById('refreshGameBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            window.location.reload();
        };
    }
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.checked = global.borderDraw;
visibleBorderSetting.onchange = function() { window.chat.toggleBorder(); };

var showMassSetting = document.getElementById('showMass');
showMassSetting.checked = global.toggleMassState === 1;
showMassSetting.onchange = function() { window.chat.toggleMass(); };

var continuitySetting = document.getElementById('continuity');
continuitySetting.checked = global.continuity;
continuitySetting.onchange = function() { window.chat.toggleContinuity(); };

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.checked = global.toggleRoundFood;
roundFoodSetting.onchange = function() { window.chat.toggleRoundFood(); };

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { // We have a more specific error message 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
    
    // Clean up background heartbeat
    if (global.heartbeatInterval) {
        clearInterval(global.heartbeatInterval);
        global.heartbeatInterval = null;
    }
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle receiving token skins from server
    socket.on('tokenSkins', function(tokenSkins) {
        Object.entries(tokenSkins).forEach(([skinId, skinData]) => {
            if (!tokenSkinCache.has(skinId)) {
                const img = new Image();
                img.src = skinData.image;
                img.onload = function() {
                    tokenSkinCache.set(skinId, img);
                    console.log('Loaded token skin:', skinData.symbol);
                };
            }
        });
    });

    // Store welcome data for later use
    let welcomeData = null;
    

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        player.skin = global.playerSkin || 'none';
        
        // Add token skin data if applicable
        if (global.tokenSkinData) {
            player.tokenSkinData = global.tokenSkinData;
        }
        
        global.player = player;
        window.chat.player = player;
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
        
        // Send gotit immediately for all players
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        
        // Start background heartbeat to prevent timeout when tab is inactive
        if (!global.heartbeatInterval) {
            global.heartbeatInterval = setInterval(function() {
                if (socket && socket.connected && global.gameStart) {
                    socket.emit('0', window.canvas.target || { x: player.x, y: player.y });
                }
            }, 20000); // Send heartbeat every 20 seconds
        }
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            var mass = leaderboard[i].mass ? ' (' + leaderboard[i].mass + ')' : '';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + mass + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell" + mass + "</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name + mass;
                else
                    status += (i + 1) + '. An unnamed cell' + mass;
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.skin = playerData.skin;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        
        // Clean up heartbeat interval when player dies
        if (global.heartbeatInterval) {
            clearInterval(global.heartbeatInterval);
            global.heartbeatInterval = null;
        }
        
        // Disconnect socket to ensure clean state
        // This prevents rejoining as a player when clicking spectate
        socket.disconnect();
        socket = null;
        
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.display = 'flex';
            document.getElementById('startMenuWrapper').style.maxHeight = '100vh';
            document.getElementById('screenshotNotice').style.display = 'none';
            document.body.classList.remove('game-active');
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
    
    // Game won event
    socket.on('gameWon', function(data) {
        // Hide game area
        document.getElementById('gameAreaWrapper').style.opacity = 0;
        
        // Show winner overlay
        document.getElementById('winnerOverlay').style.display = 'flex';
        document.getElementById('winnerName').textContent = data.winner;
        
        // Enable refresh button immediately
        document.getElementById('refreshGameBtn').disabled = false;
    });
    
    // Game reset event
    socket.on('gameReset', function() {
        // Reload the page to start fresh
        window.location.reload();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });


        let borders = { // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        var tokenSkinsNeeded = new Set();
        
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            
            // Check if this user has a token skin we haven't loaded
            if (users[i].skin && users[i].skin.startsWith('token_') && !tokenSkinCache.has(users[i].skin)) {
                tokenSkinsNeeded.add(users[i].skin);
            }
            
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2,
                    skin: users[i].skin || 'none'
                });
            }
        }
        
        // Request any token skins we need
        if (tokenSkinsNeeded.size > 0 && socket && socket.connected) {
            socket.emit('requestTokenSkins', Array.from(tokenSkinsNeeded));
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph, loadSkinImage);

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}

// Initialize audio system
function initializeAudio() {
    const audioToggle = document.getElementById('audioToggle');
    const audioIcon = audioToggle.querySelector('.audio-icon');
    const bgMusic = document.getElementById('background_music');
    
    // Set initial volume
    bgMusic.volume = 0.3; // 30% volume
    
    // Check for saved audio preference
    const audioEnabled = localStorage.getItem('audioEnabled') !== 'false';
    
    // Function to update audio state
    function updateAudioState(enabled) {
        if (enabled) {
            bgMusic.play().catch(err => {
                // Handle autoplay policy - try playing on first user interaction
                console.log('Autoplay prevented, will play on user interaction');
            });
            audioIcon.textContent = '🔊';
        } else {
            bgMusic.pause();
            audioIcon.textContent = '🔇';
        }
        localStorage.setItem('audioEnabled', enabled);
    }
    
    // Set initial state
    updateAudioState(audioEnabled);
    
    // Toggle audio on click
    audioToggle.addEventListener('click', function() {
        const isPlaying = !bgMusic.paused;
        updateAudioState(!isPlaying);
    });
    
    // Try to play on first user interaction if autoplay was blocked
    document.addEventListener('click', function playOnFirstInteraction() {
        if (localStorage.getItem('audioEnabled') !== 'false' && bgMusic.paused) {
            bgMusic.play().catch(err => console.log('Still cannot play:', err));
        }
        // Remove this listener after first interaction
        document.removeEventListener('click', playOnFirstInteraction);
    }, { once: true });
    
    // Show hint popup after 5 seconds if music is off
    setTimeout(() => {
        if (bgMusic.paused && !localStorage.getItem('audioHintShown')) {
            const audioHint = document.getElementById('audioHint');
            audioHint.classList.add('show');
            
            // Hide the hint after 3 seconds
            setTimeout(() => {
                audioHint.classList.remove('show');
                localStorage.setItem('audioHintShown', 'true');
            }, 3000);
            
            // Also hide if user clicks the audio toggle
            audioToggle.addEventListener('click', function hideHint() {
                audioHint.classList.remove('show');
                localStorage.setItem('audioHintShown', 'true');
                audioToggle.removeEventListener('click', hideHint);
            });
        }
    }, 5000);
}

// Initialize animated background
function initializeBackground() {
    const canvas = document.getElementById('backgroundCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let isDarkMode = false;
    
    // Make canvas full screen
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Cell objects for animation
    const cells = [];
    const cellCount = 15;
    const gridSize = 40;
    
    // Create cells
    for (let i = 0; i < cellCount; i++) {
        cells.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 30 + 20,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            hue: Math.random() * 360,
            mass: Math.random() * 100 + 50,
            showSkin: i < 3 // Show selected skin on first 3 cells
        });
    }
    
    // Food particles
    const foods = [];
    const foodCount = 30;
    
    for (let i = 0; i < foodCount; i++) {
        foods.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 5,
            hue: Math.random() * 360
        });
    }
    
    // Animation loop
    function animate() {
        // Clear canvas with appropriate background
        if (isDarkMode) {
            ctx.fillStyle = 'rgba(17, 17, 17, 0.95)';
        } else {
            ctx.fillStyle = 'rgba(242, 251, 255, 0.95)';
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid with appropriate color
        if (isDarkMode) {
            ctx.strokeStyle = 'rgba(76, 175, 80, 0.1)';
        } else {
            ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
        }
        ctx.lineWidth = 1;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw food particles
        foods.forEach(food => {
            if (isDarkMode) {
                ctx.fillStyle = `hsla(${food.hue}, 100%, 50%, 0.6)`;
            } else {
                ctx.fillStyle = `hsla(${food.hue}, 100%, 45%, 0.8)`;
            }
            ctx.beginPath();
            ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Update and draw cells
        cells.forEach(cell => {
            // Update position
            cell.x += cell.vx;
            cell.y += cell.vy;
            
            // Bounce off edges
            if (cell.x - cell.radius < 0 || cell.x + cell.radius > canvas.width) {
                cell.vx *= -1;
            }
            if (cell.y - cell.radius < 0 || cell.y + cell.radius > canvas.height) {
                cell.vy *= -1;
            }
            
            // Keep cells in bounds
            cell.x = Math.max(cell.radius, Math.min(canvas.width - cell.radius, cell.x));
            cell.y = Math.max(cell.radius, Math.min(canvas.height - cell.radius, cell.y));
            
            // Check if we should show skin for this cell
            const skinImage = cell.showSkin && selectedSkin && selectedSkin !== 'none' ? skinCache.get(selectedSkin) : null;
            
            if (skinImage && skinImage.complete && skinImage.naturalWidth > 0) {
                // Draw cell with skin
                ctx.save();
                
                // Create circular clipping path
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                // Draw the skin image
                const size = cell.radius * 2;
                ctx.drawImage(
                    skinImage,
                    cell.x - cell.radius,
                    cell.y - cell.radius,
                    size,
                    size
                );
                
                ctx.restore();
                
                // Draw border
                if (isDarkMode) {
                    ctx.strokeStyle = `hsla(${cell.hue}, 100%, 45%, 0.5)`;
                } else {
                    ctx.strokeStyle = `hsla(${cell.hue}, 100%, 40%, 0.8)`;
                }
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Draw regular colored cell
                if (isDarkMode) {
                    ctx.fillStyle = `hsla(${cell.hue}, 100%, 50%, 0.3)`;
                    ctx.strokeStyle = `hsla(${cell.hue}, 100%, 45%, 0.5)`;
                } else {
                    ctx.fillStyle = `hsla(${cell.hue}, 100%, 50%, 0.4)`;
                    ctx.strokeStyle = `hsla(${cell.hue}, 100%, 40%, 0.8)`;
                }
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            
            // Draw cell name (memer.io)
            if (isDarkMode) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            }
            ctx.font = '10px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('memer', cell.x, cell.y - 5);
            ctx.fillText('.io', cell.x, cell.y + 5);
        });
        
        // Draw title shadow
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.font = '64px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isDarkMode) {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
        } else {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.05)';
        }
        ctx.fillText('MEMER.IO', centerX, centerY - 30);
        
        ctx.font = '32px "Press Start 2P"';
        if (isDarkMode) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        } else {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
        }
        ctx.fillText('FREE EDITION', centerX, centerY + 20);
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('memerTheme');
    if (savedTheme === 'dark') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '🌙';
    }
    
    themeToggle.addEventListener('click', function() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        
        if (isDarkMode) {
            themeIcon.textContent = '🌙';
            localStorage.setItem('memerTheme', 'dark');
        } else {
            themeIcon.textContent = '☀️';
            localStorage.setItem('memerTheme', 'light');
        }
    });
}

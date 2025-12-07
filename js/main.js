/**
 * ==========================================
 * MAIN ENTRY POINT
 * ==========================================
 * Initializes the game and handles screen navigation
 * Coordinates all modules and user interactions
 */

(function() {
    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
        // Connection status
        connectionStatus: document.getElementById('connectionStatus'),
        
        // Screens
        lobbyScreen: document.getElementById('lobbyScreen'),
        waitingScreen: document.getElementById('waitingScreen'),
        gameScreen: document.getElementById('gameScreen'),
        
        // Lobby elements
        playerNameInput: document.getElementById('playerName'),
        shapeButtons: document.getElementById('shapeButtons'),
        createGameBtn: document.getElementById('createGameBtn'),
        sessionCodeInput: document.getElementById('sessionCode'),
        joinGameBtn: document.getElementById('joinGameBtn'),
        
        // Waiting room elements
        displaySessionCode: document.getElementById('displaySessionCode'),
        displayShapeName: document.getElementById('displayShapeName'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        waitingPlayersList: document.getElementById('waitingPlayersList'),
        leaveWaitingBtn: document.getElementById('leaveWaitingBtn'),
        
        // Game elements
        gameSessionCode: document.getElementById('gameSessionCode'),
        gameCanvas: document.getElementById('gameCanvas'),
        maskCanvas: document.getElementById('maskCanvas'),
        leaveGameBtn: document.getElementById('leaveGameBtn'),
        
        // Game over modal
        gameOverModal: document.getElementById('gameOverModal'),
        winnerName: document.getElementById('winnerName'),
        backToLobbyBtn: document.getElementById('backToLobbyBtn'),
    };

    // ==========================================
    // STATE
    // ==========================================
    let selectedShape = 'circle';
    let currentSessionId = null;

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        Game.init(elements.gameCanvas, elements.maskCanvas);
        setupEventListeners();
        setupWebSocketHandlers();
        WebSocketClient.connect();
        console.log('🧲 Magnet Shapes initialized');
    }

    function setupEventListeners() {
        // Shape selection
        elements.shapeButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.shape-btn');
            if (!btn) return;

            document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedShape = btn.dataset.shape;
        });

        elements.createGameBtn.addEventListener('click', handleCreateGame);
        elements.joinGameBtn.addEventListener('click', handleJoinGame);
        elements.copyCodeBtn.addEventListener('click', handleCopyCode);
        elements.leaveWaitingBtn.addEventListener('click', handleLeaveSession);
        elements.leaveGameBtn.addEventListener('click', handleLeaveSession);
        elements.backToLobbyBtn.addEventListener('click', handleBackToLobby);

        elements.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (elements.sessionCodeInput.value) {
                    handleJoinGame();
                } else {
                    handleCreateGame();
                }
            }
        });

        elements.sessionCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleJoinGame();
        });
    }

    function setupWebSocketHandlers() {
        WebSocketClient.on('connect', () => {
            updateConnectionStatus('connected');
        });

        WebSocketClient.on('disconnect', () => {
            updateConnectionStatus('disconnected');
        });

        WebSocketClient.on('error', () => {
            updateConnectionStatus('disconnected');
        });

        WebSocketClient.on('message', handleServerMessage);
    }

    // ==========================================
    // SERVER MESSAGE HANDLING
    // ==========================================

    function handleServerMessage(message) {
        switch (message.type) {
            case 'SESSION_CREATED':
                handleSessionCreated(message);
                break;

            case 'SESSION_JOINED':
                handleSessionJoined(message);
                break;

            case 'PLAYER_JOINED':
                handlePlayerJoined(message);
                break;

            case 'PLAYER_LEFT':
                handlePlayerLeft(message);
                break;

            case 'GAME_STARTED':
                handleGameStarted(message);
                break;

            case 'MAGNET_PLACED':
                handleMagnetPlaced(message);
                break;

            case 'PLACEMENT_INVALID':
                handlePlacementInvalid(message);
                break;

            case 'MAGNETS_CLUMPED':
                handleMagnetsClumped(message);
                break;

            case 'TURN_CHANGED':
                handleTurnChanged(message);
                break;

            case 'GAME_OVER':
                handleGameOver(message);
                break;

            case 'ERROR':
                handleError(message);
                break;
        }
    }

    function handleSessionCreated(message) {
        currentSessionId = message.sessionId;
        
        const myPlayer = message.gameState.players[0];
        if (myPlayer) {
            Game.setMyPlayerId(myPlayer.id);
        }

        Game.updateState(message.gameState);

        elements.displaySessionCode.textContent = message.sessionId;
        elements.displayShapeName.textContent = capitalizeFirst(message.gameState.shapeType);
        updateWaitingPlayersList(message.gameState.players);
        showScreen('waiting');

        Game.showMessage(`Session created: ${message.sessionId}`, 'success');
    }

    function handleSessionJoined(message) {
        currentSessionId = message.gameState.sessionId;

        const myPlayer = message.gameState.players[message.gameState.players.length - 1];
        if (myPlayer) {
            Game.setMyPlayerId(myPlayer.id);
        }

        Game.updateState(message.gameState);

        if (message.gameState.status === 'playing') {
            startGame(message.gameState);
        } else {
            elements.displaySessionCode.textContent = message.gameState.sessionId;
            elements.displayShapeName.textContent = capitalizeFirst(message.gameState.shapeType);
            updateWaitingPlayersList(message.gameState.players);
            showScreen('waiting');
        }

        Game.showMessage('Joined session successfully!', 'success');
    }

    function handlePlayerJoined(message) {
        Game.updateState(message.gameState);
        updateWaitingPlayersList(message.gameState.players);
        Game.showMessage(`${message.player.name} joined the game`, 'info');

        if (message.gameState.status === 'playing') {
            startGame(message.gameState);
        }
    }

    function handlePlayerLeft(message) {
        Game.updateState(message.gameState);
        updateWaitingPlayersList(message.gameState.players);
        
        const leftPlayer = message.gameState.players.find(p => p.id === message.playerId);
        Game.showMessage(`${leftPlayer?.name || 'A player'} left the game`, 'warning');
    }

    function handleGameStarted(message) {
        startGame(message.gameState);
    }

    /**
     * Handle magnet placement with attraction animation
     * The server sends movements array showing how magnets attracted to each other
     */
    function handleMagnetPlaced(message) {
        const player = message.gameState.players.find(p => p.id === message.magnet.playerId);
        
        // If there are movements (attraction happened), animate them
        if (message.movements && message.movements.length > 0) {
            // First update state without the movements applied (show initial positions)
            const stateBeforeMovement = JSON.parse(JSON.stringify(message.gameState));
            
            // Reset magnet positions to their "from" positions for animation
            for (const movement of message.movements) {
                const magnet = stateBeforeMovement.magnets.find(m => m.id === movement.magnetId);
                if (magnet) {
                    magnet.position = { ...movement.fromPosition };
                }
            }
            
            Game.updateState(stateBeforeMovement);
            
            if (player && player.id !== Game.getMyPlayerId()) {
                Game.showMessage(`${player.name} placed a magnet - magnets attracting!`, 'info');
            } else if (player) {
                Game.showMessage('Magnets are attracting!', 'info');
            }
            
            // Animate the movements
            Game.animateMovements(message.movements, () => {
                // After animation, update to final state
                Game.updateState(message.gameState);
            });
        } else {
            // No movements, just update state directly
            Game.updateState(message.gameState);
            
            if (player && player.id !== Game.getMyPlayerId()) {
                Game.showMessage(`${player.name} placed a magnet`, 'info');
            }
        }
    }

    /**
     * Handle magnets clumping - animate them flying to the collector
     */
    function handleMagnetsClumped(message) {
        const collector = message.gameState.players.find(p => p.id === message.collectorPlayerId);
        const isMe = message.collectorPlayerId === Game.getMyPlayerId();
        
        // Show message about clumping
        if (isMe) {
            Game.showMessage(`You collected ${message.magnetsCollected} magnets from clumping!`, 'warning');
        } else if (collector) {
            Game.showMessage(`${collector.name} collected ${message.magnetsCollected} magnets from clumping!`, 'warning');
        }
        
        // Animate the clumped magnets flying away
        Game.animateClumpCollection(message.clumpedMagnets, message.collectorPlayerId, () => {
            // After animation, update to final state
            Game.updateState(message.gameState);
        });
    }

    function handlePlacementInvalid(message) {
        Game.showMessage(message.reason, 'error');
    }

    function handleTurnChanged(message) {
        const gameState = Game.getState();
        if (gameState) {
            gameState.currentTurnPlayerId = message.currentTurnPlayerId;
            Game.updateState(gameState);
        }

        if (message.currentTurnPlayerId === Game.getMyPlayerId()) {
            Game.showMessage("It's your turn!", 'success');
        }
    }

    function handleGameOver(message) {
        // Don't show modal if we've already left the game (returned to lobby)
        if (!currentSessionId) return;
        
        const isWinner = message.winnerId === Game.getMyPlayerId();
        
        elements.winnerName.textContent = isWinner 
            ? 'You Win! 🎉' 
            : `${message.winnerName} Wins!`;
        
        elements.gameOverModal.classList.remove('hidden');
    }

    function handleError(message) {
        Game.showMessage(message.message, 'error');
    }

    // ==========================================
    // USER ACTIONS
    // ==========================================

    function handleCreateGame() {
        const playerName = elements.playerNameInput.value.trim();

        if (!playerName) {
            alert('Please enter your name');
            elements.playerNameInput.focus();
            return;
        }

        WebSocketClient.createSession(playerName, selectedShape);
    }

    function handleJoinGame() {
        const playerName = elements.playerNameInput.value.trim();
        const sessionCode = elements.sessionCodeInput.value.trim();

        if (!playerName) {
            alert('Please enter your name');
            elements.playerNameInput.focus();
            return;
        }

        if (!sessionCode) {
            alert('Please enter a session code');
            elements.sessionCodeInput.focus();
            return;
        }

        WebSocketClient.joinSession(sessionCode, playerName);
    }

    function handleCopyCode() {
        const code = elements.displaySessionCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            elements.copyCodeBtn.textContent = '✓';
            setTimeout(() => {
                elements.copyCodeBtn.textContent = '📋';
            }, 2000);
        });
    }

    function handleLeaveSession() {
        // Clear session ID first to prevent any incoming messages from triggering UI updates
        currentSessionId = null;
        elements.gameOverModal.classList.add('hidden');
        WebSocketClient.leaveSession();
        resetToLobby();
    }

    function handleBackToLobby() {
        // Clear session ID first to prevent any incoming messages from showing modal again
        currentSessionId = null;
        elements.gameOverModal.classList.add('hidden');
        WebSocketClient.leaveSession();
        resetToLobby();
    }

    // ==========================================
    // SCREEN MANAGEMENT
    // ==========================================

    function showScreen(screen) {
        elements.lobbyScreen.classList.add('hidden');
        elements.waitingScreen.classList.add('hidden');
        elements.gameScreen.classList.add('hidden');

        switch (screen) {
            case 'lobby':
                elements.lobbyScreen.classList.remove('hidden');
                break;
            case 'waiting':
                elements.waitingScreen.classList.remove('hidden');
                break;
            case 'game':
                elements.gameScreen.classList.remove('hidden');
                break;
        }
    }

    function startGame(gameState) {
        Shapes.generateMask(gameState.shapeType);
        elements.gameSessionCode.textContent = gameState.sessionId;
        showScreen('game');
        Game.updateState(gameState);
        Game.showMessage('Game started! Place magnets carefully - they attract each other!', 'success');
    }

    function resetToLobby() {
        currentSessionId = null;
        Game.reset();
        elements.sessionCodeInput.value = '';
        elements.gameOverModal.classList.add('hidden');
        showScreen('lobby');
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    function updateConnectionStatus(status) {
        elements.connectionStatus.className = 'connection-status ' + status;
        const statusText = elements.connectionStatus.querySelector('.status-text');
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            default:
                statusText.textContent = 'Connecting...';
        }
    }

    function updateWaitingPlayersList(players) {
        elements.waitingPlayersList.innerHTML = '';

        players.forEach((player, index) => {
            const color = Game.PLAYER_COLORS[index % Game.PLAYER_COLORS.length];
            const isMe = player.id === Game.getMyPlayerId();

            const playerEl = document.createElement('div');
            playerEl.className = 'player-item' + (!player.connected ? ' disconnected' : '');

            playerEl.innerHTML = `
                <div class="player-avatar" style="background: ${color}">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-info">
                    <div class="player-name">
                        ${escapeHtml(player.name)}
                        ${isMe ? '<span class="you-badge">(You)</span>' : ''}
                    </div>
                    <div class="player-magnets">Ready to play</div>
                </div>
            `;

            elements.waitingPlayersList.appendChild(playerEl);
        });
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================
    // START APPLICATION
    // ==========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

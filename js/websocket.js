/**
 * ==========================================
 * WEBSOCKET MODULE
 * ==========================================
 * Handles WebSocket connection and communication with game server
 * All game state synchronization happens through this module
 */

const WebSocketClient = (function() {
    // ==========================================
    // CONNECTION STATE
    // ==========================================
    let socket = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000;

    // Server URL - change this for production
    // Note: Render.com proxies through port 443, so no port needed
    const SERVER_URL = 'wss://magnet-shapes-server.onrender.com';

    // Event handlers
    const handlers = {
        onConnect: null,
        onDisconnect: null,
        onError: null,
        onMessage: null,
    };

    // ==========================================
    // CONNECTION MANAGEMENT
    // ==========================================

    /**
     * Connect to the WebSocket server
     * Automatically handles reconnection attempts
     */
    function connect() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }

        console.log('[WS] Connecting to', SERVER_URL);

        try {
            socket = new WebSocket(SERVER_URL);

            socket.onopen = handleOpen;
            socket.onclose = handleClose;
            socket.onerror = handleError;
            socket.onmessage = handleMessage;
        } catch (error) {
            console.error('[WS] Connection error:', error);
            handleError(error);
        }
    }

    /**
     * Disconnect from the server
     */
    function disconnect() {
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
        if (socket) {
            socket.close();
            socket = null;
        }
        isConnected = false;
    }

    /**
     * Handle successful connection
     */
    function handleOpen() {
        console.log('[WS] Connected to server');
        isConnected = true;
        reconnectAttempts = 0;

        if (handlers.onConnect) {
            handlers.onConnect();
        }
    }

    /**
     * Handle connection close
     */
    function handleClose(event) {
        console.log('[WS] Disconnected from server', event.code, event.reason);
        isConnected = false;
        socket = null;

        if (handlers.onDisconnect) {
            handlers.onDisconnect();
        }

        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`[WS] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connect, RECONNECT_DELAY);
        } else {
            console.log('[WS] Max reconnection attempts reached');
        }
    }

    /**
     * Handle connection error
     */
    function handleError(error) {
        console.error('[WS] Error:', error);

        if (handlers.onError) {
            handlers.onError(error);
        }
    }

    /**
     * Handle incoming messages
     */
    function handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('[WS] Received:', message.type);

            if (handlers.onMessage) {
                handlers.onMessage(message);
            }
        } catch (error) {
            console.error('[WS] Error parsing message:', error);
        }
    }

    // ==========================================
    // MESSAGE SENDING
    // ==========================================

    /**
     * Send a message to the server
     * @param {Object} message - Message object to send
     */
    function send(message) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('[WS] Cannot send - not connected');
            return false;
        }

        try {
            socket.send(JSON.stringify(message));
            console.log('[WS] Sent:', message.type);
            return true;
        } catch (error) {
            console.error('[WS] Error sending message:', error);
            return false;
        }
    }

    // ==========================================
    // GAME-SPECIFIC MESSAGES
    // ==========================================

    /**
     * Create a new game session
     * @param {string} playerName - Player's display name
     * @param {string} shapeType - Selected shape type
     */
    function createSession(playerName, shapeType) {
        return send({
            type: 'CREATE_SESSION',
            playerName,
            shapeType,
        });
    }

    /**
     * Join an existing game session
     * @param {string} sessionId - Session code to join
     * @param {string} playerName - Player's display name
     */
    function joinSession(sessionId, playerName) {
        return send({
            type: 'JOIN_SESSION',
            sessionId: sessionId.toUpperCase(),
            playerName,
        });
    }

    /**
     * Place a magnet at the specified position
     * @param {{x: number, y: number}} position - Canvas coordinates
     */
    function placeMagnet(position) {
        return send({
            type: 'PLACE_MAGNET',
            position,
        });
    }

    /**
     * Leave the current session
     */
    function leaveSession() {
        return send({
            type: 'LEAVE_SESSION',
        });
    }

    // ==========================================
    // EVENT HANDLER REGISTRATION
    // ==========================================

    /**
     * Register event handlers
     * @param {string} event - Event name (connect, disconnect, error, message)
     * @param {Function} handler - Event handler function
     */
    function on(event, handler) {
        switch (event) {
            case 'connect':
                handlers.onConnect = handler;
                break;
            case 'disconnect':
                handlers.onDisconnect = handler;
                break;
            case 'error':
                handlers.onError = handler;
                break;
            case 'message':
                handlers.onMessage = handler;
                break;
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    return {
        connect,
        disconnect,
        on,
        createSession,
        joinSession,
        placeMagnet,
        leaveSession,
        isConnected: () => isConnected,
    };
})();


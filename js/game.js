/**
 * ==========================================
 * GAME MODULE
 * ==========================================
 * Manages game state, rendering, and player interactions
 * Includes magnetic attraction animations
 */

const Game = (function() {
    // ==========================================
    // GAME STATE
    // ==========================================
    let gameState = null;
    let myPlayerId = null;
    let canvas = null;
    let ctx = null;

    // Animation state for magnet movements
    let animatingMagnets = []; // { magnetId, fromPos, toPos, progress }
    let animationFrameId = null;

    // ==========================================
    // CONFIGURATION (must match server values)
    // ==========================================
    const MAGNET_RADIUS = 12;
    const CLUMP_THRESHOLD = 30;      // Increased for easier clumping
    const ATTRACTION_RANGE = 150;    // Increased attraction range
    const ANIMATION_DURATION = 600;  // ms - slightly longer for smoother animation

    // Player colors for visual distinction
    const PLAYER_COLORS = [
        '#f43f5e', // Rose
        '#3b82f6', // Blue
        '#22c55e', // Green
        '#f59e0b', // Amber
    ];

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init(gameCanvas, maskCanvas) {
        canvas = gameCanvas;
        ctx = canvas.getContext('2d');

        Shapes.initMaskCanvas(maskCanvas);

        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchstart', handleCanvasTouchStart);
    }

    function handleCanvasClick(event) {
        if (!canPlaceMagnet()) return;

        const coords = Shapes.getScaledCoordinates(canvas, event.clientX, event.clientY);
        attemptPlacement(coords);
    }

    function handleCanvasTouchStart(event) {
        if (!canPlaceMagnet()) return;
        event.preventDefault();

        const touch = event.touches[0];
        const coords = Shapes.getScaledCoordinates(canvas, touch.clientX, touch.clientY);
        attemptPlacement(coords);
    }

    function canPlaceMagnet() {
        if (!gameState) return false;
        if (gameState.status !== 'playing') return false;
        if (gameState.currentTurnPlayerId !== myPlayerId) return false;
        if (animatingMagnets.length > 0) return false; // Don't allow during animation

        const myPlayer = gameState.players.find(p => p.id === myPlayerId);
        if (!myPlayer || myPlayer.remainingMagnets <= 0) return false;

        return true;
    }

    function attemptPlacement(coords) {
        if (!Shapes.isInsideShape(coords.x, coords.y)) {
            showMessage('Cannot place magnet outside the shape!', 'warning');
            return;
        }

        WebSocketClient.placeMagnet(coords);
    }

    // ==========================================
    // STATE MANAGEMENT
    // ==========================================

    function updateState(newState) {
        gameState = newState;
        render();
        updateUI();
    }

    /**
     * Animate magnet movements from attraction physics
     * @param {Array} movements - Array of { magnetId, fromPosition, toPosition }
     * @param {Function} onComplete - Callback when animation completes
     */
    function animateMovements(movements, onComplete) {
        if (!movements || movements.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        const startTime = performance.now();

        animatingMagnets = movements.map(m => ({
            magnetId: m.magnetId,
            fromPos: { ...m.fromPosition },
            toPos: { ...m.toPosition },
            progress: 0,
        }));

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / ANIMATION_DURATION);

            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // Update positions
            for (const anim of animatingMagnets) {
                anim.progress = easeProgress;
                
                // Find the magnet in game state and update its displayed position
                const magnet = gameState.magnets.find(m => m.id === anim.magnetId);
                if (magnet) {
                    magnet.position.x = anim.fromPos.x + (anim.toPos.x - anim.fromPos.x) * easeProgress;
                    magnet.position.y = anim.fromPos.y + (anim.toPos.y - anim.fromPos.y) * easeProgress;
                }
            }

            render();

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                animatingMagnets = [];
                animationFrameId = null;
                if (onComplete) onComplete();
            }
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Animate magnets being collected (fly off screen)
     * @param {Array} clumpedMagnets - Array of magnets that clumped
     * @param {string} collectorId - ID of player collecting them
     * @param {Function} onComplete - Callback when animation completes
     */
    function animateClumpCollection(clumpedMagnets, collectorId, onComplete) {
        if (!clumpedMagnets || clumpedMagnets.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        const startTime = performance.now();
        const duration = 600;

        // Find collector's position in player list for animation target
        const playerIndex = gameState.players.findIndex(p => p.id === collectorId);
        const targetX = canvas.width + 50; // Fly off to the right
        const targetY = 50 + playerIndex * 60;

        // Store original positions
        const animations = clumpedMagnets.map(m => ({
            magnet: { ...m, position: { ...m.position } },
            startPos: { ...m.position },
            progress: 0,
        }));

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Easing function (ease-in)
            const easeProgress = progress * progress;

            // Clear and redraw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBackground();
            Shapes.drawShape(ctx, gameState.shapeType);

            // Draw remaining magnets (not being collected)
            const clumpedIds = new Set(clumpedMagnets.map(m => m.id));
            for (const magnet of gameState.magnets) {
                if (!clumpedIds.has(magnet.id)) {
                    drawMagnet(magnet);
                }
            }

            // Draw flying magnets with scale and fade
            for (const anim of animations) {
                const x = anim.startPos.x + (targetX - anim.startPos.x) * easeProgress;
                const y = anim.startPos.y + (targetY - anim.startPos.y) * easeProgress;
                const scale = 1 - easeProgress * 0.5;
                const alpha = 1 - easeProgress;

                drawMagnetAt(x, y, anim.magnet.playerId, scale, alpha);
            }

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                animationFrameId = null;
                render();
                if (onComplete) onComplete();
            }
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    function setMyPlayerId(playerId) {
        myPlayerId = playerId;
    }

    function getState() {
        return gameState;
    }

    function getMyPlayerId() {
        return myPlayerId;
    }

    // ==========================================
    // RENDERING
    // ==========================================

    function render() {
        if (!ctx || !gameState) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        Shapes.drawShape(ctx, gameState.shapeType);
        drawMagnets();
        drawAttractionLines();

        if (canPlaceMagnet()) {
            canvas.classList.remove('disabled');
        } else {
            canvas.classList.add('disabled');
        }
    }

    function drawBackground() {
        ctx.save();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.lineWidth = 1;

        const gridSize = 40;
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

        ctx.restore();
    }

    /**
     * Draw visual lines showing magnetic attraction between nearby magnets
     * Line thickness and opacity increase as magnets get closer (inverse-square)
     */
    function drawAttractionLines() {
        if (!gameState || !gameState.magnets || gameState.magnets.length < 2) return;

        ctx.save();
        
        for (let i = 0; i < gameState.magnets.length; i++) {
            for (let j = i + 1; j < gameState.magnets.length; j++) {
                const m1 = gameState.magnets[i];
                const m2 = gameState.magnets[j];
                
                const dx = m2.position.x - m1.position.x;
                const dy = m2.position.y - m1.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Draw attraction field if within range
                if (distance < ATTRACTION_RANGE && distance > CLUMP_THRESHOLD) {
                    // Inverse-square strength - much stronger visual when closer
                    const normalizedDist = distance / ATTRACTION_RANGE;
                    const strength = 1 / (normalizedDist * normalizedDist + 0.2);
                    const clampedStrength = Math.min(strength, 3); // Cap at 3x
                    
                    ctx.strokeStyle = `rgba(99, 102, 241, ${Math.min(clampedStrength * 0.25, 0.8)})`;
                    ctx.lineWidth = 1 + clampedStrength * 1.5;
                    ctx.setLineDash([4, 4]);
                    
                    ctx.beginPath();
                    ctx.moveTo(m1.position.x, m1.position.y);
                    ctx.lineTo(m2.position.x, m2.position.y);
                    ctx.stroke();
                    
                    // Draw "pulling" arrows when very close
                    if (distance < CLUMP_THRESHOLD * 2) {
                        const midX = (m1.position.x + m2.position.x) / 2;
                        const midY = (m1.position.y + m2.position.y) / 2;
                        
                        ctx.fillStyle = `rgba(99, 102, 241, ${clampedStrength * 0.3})`;
                        ctx.beginPath();
                        ctx.arc(midX, midY, 4 + clampedStrength, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Highlight if touching (clumped) - pulsing red
                if (distance <= CLUMP_THRESHOLD) {
                    const pulse = 0.6 + Math.sin(Date.now() / 200) * 0.2;
                    ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
                    ctx.lineWidth = 4;
                    ctx.setLineDash([]);
                    
                    ctx.beginPath();
                    ctx.moveTo(m1.position.x, m1.position.y);
                    ctx.lineTo(m2.position.x, m2.position.y);
                    ctx.stroke();
                    
                    // Draw warning circle around clumped magnets
                    ctx.strokeStyle = `rgba(244, 63, 94, ${pulse * 0.5})`;
                    ctx.lineWidth = 2;
                    const midX = (m1.position.x + m2.position.x) / 2;
                    const midY = (m1.position.y + m2.position.y) / 2;
                    ctx.beginPath();
                    ctx.arc(midX, midY, distance / 2 + 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }

    function drawMagnets() {
        if (!gameState || !gameState.magnets) return;

        for (const magnet of gameState.magnets) {
            drawMagnet(magnet);
        }
    }

    function drawMagnet(magnet) {
        drawMagnetAt(magnet.position.x, magnet.position.y, magnet.playerId, 1, 1);
        
        // Draw ownership indicator
        if (magnet.playerId === myPlayerId) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(magnet.position.x, magnet.position.y, MAGNET_RADIUS + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawMagnetAt(x, y, playerId, scale = 1, alpha = 1) {
        const playerIndex = gameState.players.findIndex(p => p.id === playerId);
        const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
        const radius = MAGNET_RADIUS * scale;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Outer glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
        glow.addColorStop(0, color + '40');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Magnet body
        const gradient = ctx.createRadialGradient(x - 3 * scale, y - 3 * scale, 0, x, y, radius);
        gradient.addColorStop(0, lightenColor(color, 30));
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, darkenColor(color, 20));

        ctx.fillStyle = gradient;
        ctx.strokeStyle = darkenColor(color, 30);
        ctx.lineWidth = 2 * scale;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(x - 3 * scale, y - 3 * scale, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Magnetic field lines (subtle decoration)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * alpha})`;
        ctx.lineWidth = 1;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * radius * 0.6, y + Math.sin(angle) * radius * 0.6);
            ctx.lineTo(x + Math.cos(angle) * radius * 1.3, y + Math.sin(angle) * radius * 1.3);
            ctx.stroke();
        }

        ctx.restore();
    }

    function lightenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    function darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    // ==========================================
    // UI UPDATES
    // ==========================================

    function updateUI() {
        if (!gameState) return;

        updatePlayersList();
        updateTurnIndicator();
    }

    function updatePlayersList() {
        const container = document.getElementById('gamePlayersList');
        if (!container) return;

        container.innerHTML = '';

        gameState.players.forEach((player, index) => {
            const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
            const isMyTurn = player.id === gameState.currentTurnPlayerId;
            const isMe = player.id === myPlayerId;

            const playerEl = document.createElement('div');
            playerEl.className = 'player-item' + 
                (isMyTurn ? ' current-turn' : '') + 
                (!player.connected ? ' disconnected' : '');

            playerEl.innerHTML = `
                <div class="player-avatar" style="background: ${color}">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-info">
                    <div class="player-name">
                        ${escapeHtml(player.name)}
                        ${isMe ? '<span class="you-badge">(You)</span>' : ''}
                    </div>
                    <div class="player-magnets">🧲 ${player.remainingMagnets} remaining</div>
                </div>
            `;

            container.appendChild(playerEl);
        });
    }

    function updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        const playerName = document.getElementById('currentTurnPlayer');

        if (!indicator || !playerName || !gameState) return;

        const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
        
        if (currentPlayer) {
            const isMyTurn = currentPlayer.id === myPlayerId;
            playerName.textContent = isMyTurn ? 'Your Turn!' : currentPlayer.name;
            indicator.classList.toggle('your-turn', isMyTurn);
        } else {
            playerName.textContent = 'Waiting...';
            indicator.classList.remove('your-turn');
        }
    }

    function showMessage(text, type = 'info') {
        const container = document.getElementById('gameMessages');
        if (!container) return;

        const messageEl = document.createElement('div');
        messageEl.className = `game-message ${type}`;
        messageEl.textContent = text;

        container.insertBefore(messageEl, container.firstChild);

        while (container.children.length > 5) {
            container.removeChild(container.lastChild);
        }

        setTimeout(() => {
            messageEl.style.opacity = '0';
            setTimeout(() => messageEl.remove(), 300);
        }, 4000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function reset() {
        gameState = null;
        myPlayerId = null;
        animatingMagnets = [];
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    return {
        init,
        updateState,
        setMyPlayerId,
        getState,
        getMyPlayerId,
        render,
        showMessage,
        reset,
        animateMovements,
        animateClumpCollection,
        PLAYER_COLORS,
    };
})();

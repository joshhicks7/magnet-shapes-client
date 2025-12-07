/**
 * ==========================================
 * SHAPES MODULE
 * ==========================================
 * Handles shape definitions, drawing, and placement validation
 * Uses pixel mask for shape detection
 */

const Shapes = (function() {
    // ==========================================
    // CANVAS CONFIGURATION
    // ==========================================
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;

    // ==========================================
    // SHAPE DEFINITIONS
    // ==========================================
    
    const CIRCLE_SHAPE = {
        centerX: CANVAS_WIDTH / 2,
        centerY: CANVAS_HEIGHT / 2,
        radius: 200,
    };

    const SQUARE_SHAPE = {
        centerX: CANVAS_WIDTH / 2,
        centerY: CANVAS_HEIGHT / 2,
        size: 350,
    };

    const RECTANGLE_SHAPE = {
        centerX: CANVAS_WIDTH / 2,
        centerY: CANVAS_HEIGHT / 2,
        width: 500,
        height: 300,
    };

    const TRIANGLE_SHAPE = {
        points: [
            { x: 400, y: 80 },
            { x: 180, y: 480 },
            { x: 620, y: 480 },
        ],
    };

    const DIAMOND_SHAPE = {
        points: [
            { x: 400, y: 60 },
            { x: 600, y: 300 },
            { x: 400, y: 540 },
            { x: 200, y: 300 },
        ],
    };

    // Generate star points
    const STAR_SHAPE = (() => {
        const cx = CANVAS_WIDTH / 2;
        const cy = CANVAS_HEIGHT / 2;
        const outerRadius = 220;
        const innerRadius = 90;
        const points = [];
        
        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI / 5) - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
            });
        }
        
        return { points };
    })();

    // Generate heart points
    const HEART_SHAPE = (() => {
        const cx = CANVAS_WIDTH / 2;
        const points = [];
        const scale = 12;
        
        for (let t = 0; t <= Math.PI * 2; t += 0.1) {
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            points.push({
                x: cx + x * scale,
                y: 300 + y * scale,
            });
        }
        
        return { points };
    })();

    const CAT_SHAPE = {
        bodyCenter: { x: 400, y: 380 },
        bodyRadiusX: 120,
        bodyRadiusY: 80,
        headCenter: { x: 400, y: 220 },
        headRadius: 70,
        leftEar: [
            { x: 340, y: 160 },
            { x: 320, y: 100 },
            { x: 360, y: 130 },
        ],
        rightEar: [
            { x: 460, y: 160 },
            { x: 480, y: 100 },
            { x: 440, y: 130 },
        ],
        tailPoints: [
            { x: 520, y: 350 },
            { x: 580, y: 320 },
            { x: 600, y: 280 },
            { x: 580, y: 260 },
            { x: 560, y: 300 },
            { x: 520, y: 330 },
        ],
    };

    const SHARK_SHAPE = {
        bodyPoints: [
            { x: 150, y: 300 },
            { x: 250, y: 250 },
            { x: 400, y: 220 },
            { x: 420, y: 150 },
            { x: 440, y: 220 },
            { x: 550, y: 240 },
            { x: 650, y: 200 },
            { x: 600, y: 300 },
            { x: 650, y: 400 },
            { x: 550, y: 360 },
            { x: 400, y: 380 },
            { x: 300, y: 400 },
            { x: 320, y: 450 },
            { x: 280, y: 380 },
            { x: 200, y: 350 },
        ],
    };

    const TREE_SHAPE = {
        trunkLeft: 370,
        trunkRight: 430,
        trunkTop: 400,
        trunkBottom: 550,
        foliage: [
            [{ x: 400, y: 120 }, { x: 250, y: 300 }, { x: 550, y: 300 }],
            [{ x: 400, y: 80 }, { x: 280, y: 220 }, { x: 520, y: 220 }],
            [{ x: 400, y: 50 }, { x: 320, y: 150 }, { x: 480, y: 150 }],
        ],
    };

    // ==========================================
    // MASK CANVAS
    // ==========================================
    let maskCanvas = null;
    let maskCtx = null;

    function initMaskCanvas(canvas) {
        maskCanvas = canvas;
        maskCtx = canvas.getContext('2d', { willReadFrequently: true });
    }

    function generateMask(shapeType) {
        if (!maskCtx) return;

        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        maskCtx.fillStyle = 'white';

        switch (shapeType) {
            case 'circle': drawCircleMask(); break;
            case 'square': drawSquareMask(); break;
            case 'rectangle': drawRectangleMask(); break;
            case 'triangle': drawTriangleMask(); break;
            case 'diamond': drawDiamondMask(); break;
            case 'star': drawStarMask(); break;
            case 'heart': drawHeartMask(); break;
            case 'cat': drawCatMask(); break;
            case 'shark': drawSharkMask(); break;
            case 'tree': drawTreeMask(); break;
        }
    }

    function drawCircleMask() {
        maskCtx.beginPath();
        maskCtx.arc(CIRCLE_SHAPE.centerX, CIRCLE_SHAPE.centerY, CIRCLE_SHAPE.radius, 0, Math.PI * 2);
        maskCtx.fill();
    }

    function drawSquareMask() {
        const half = SQUARE_SHAPE.size / 2;
        maskCtx.fillRect(
            SQUARE_SHAPE.centerX - half,
            SQUARE_SHAPE.centerY - half,
            SQUARE_SHAPE.size,
            SQUARE_SHAPE.size
        );
    }

    function drawRectangleMask() {
        maskCtx.fillRect(
            RECTANGLE_SHAPE.centerX - RECTANGLE_SHAPE.width / 2,
            RECTANGLE_SHAPE.centerY - RECTANGLE_SHAPE.height / 2,
            RECTANGLE_SHAPE.width,
            RECTANGLE_SHAPE.height
        );
    }

    function drawTriangleMask() {
        drawPolygonMask(TRIANGLE_SHAPE.points);
    }

    function drawDiamondMask() {
        drawPolygonMask(DIAMOND_SHAPE.points);
    }

    function drawStarMask() {
        drawPolygonMask(STAR_SHAPE.points);
    }

    function drawHeartMask() {
        drawPolygonMask(HEART_SHAPE.points);
    }

    function drawCatMask() {
        maskCtx.beginPath();
        maskCtx.ellipse(CAT_SHAPE.bodyCenter.x, CAT_SHAPE.bodyCenter.y, CAT_SHAPE.bodyRadiusX, CAT_SHAPE.bodyRadiusY, 0, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.beginPath();
        maskCtx.arc(CAT_SHAPE.headCenter.x, CAT_SHAPE.headCenter.y, CAT_SHAPE.headRadius, 0, Math.PI * 2);
        maskCtx.fill();
        drawPolygonMask(CAT_SHAPE.leftEar);
        drawPolygonMask(CAT_SHAPE.rightEar);
        drawPolygonMask(CAT_SHAPE.tailPoints);
    }

    function drawSharkMask() {
        drawPolygonMask(SHARK_SHAPE.bodyPoints);
    }

    function drawTreeMask() {
        maskCtx.fillRect(TREE_SHAPE.trunkLeft, TREE_SHAPE.trunkTop, TREE_SHAPE.trunkRight - TREE_SHAPE.trunkLeft, TREE_SHAPE.trunkBottom - TREE_SHAPE.trunkTop);
        for (const layer of TREE_SHAPE.foliage) {
            drawPolygonMask(layer);
        }
    }

    function drawPolygonMask(points) {
        if (points.length < 3) return;
        maskCtx.beginPath();
        maskCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            maskCtx.lineTo(points[i].x, points[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();
    }

    // ==========================================
    // DRAWING FUNCTIONS
    // ==========================================

    function drawShape(ctx, shapeType) {
        ctx.save();

        const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0.15)');
        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 3;

        switch (shapeType) {
            case 'circle': drawCircle(ctx); break;
            case 'square': drawSquare(ctx); break;
            case 'rectangle': drawRectangle(ctx); break;
            case 'triangle': drawTriangle(ctx); break;
            case 'diamond': drawDiamond(ctx); break;
            case 'star': drawStar(ctx); break;
            case 'heart': drawHeart(ctx); break;
            case 'cat': drawCat(ctx); break;
            case 'shark': drawShark(ctx); break;
            case 'tree': drawTree(ctx); break;
        }

        ctx.restore();
    }

    function drawCircle(ctx) {
        ctx.beginPath();
        ctx.arc(CIRCLE_SHAPE.centerX, CIRCLE_SHAPE.centerY, CIRCLE_SHAPE.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    function drawSquare(ctx) {
        const half = SQUARE_SHAPE.size / 2;
        ctx.beginPath();
        ctx.rect(SQUARE_SHAPE.centerX - half, SQUARE_SHAPE.centerY - half, SQUARE_SHAPE.size, SQUARE_SHAPE.size);
        ctx.fill();
        ctx.stroke();
    }

    function drawRectangle(ctx) {
        ctx.beginPath();
        ctx.rect(
            RECTANGLE_SHAPE.centerX - RECTANGLE_SHAPE.width / 2,
            RECTANGLE_SHAPE.centerY - RECTANGLE_SHAPE.height / 2,
            RECTANGLE_SHAPE.width,
            RECTANGLE_SHAPE.height
        );
        ctx.fill();
        ctx.stroke();
    }

    function drawTriangle(ctx) {
        drawPolygon(ctx, TRIANGLE_SHAPE.points);
    }

    function drawDiamond(ctx) {
        // Diamond gradient
        const gradient = ctx.createLinearGradient(200, 60, 600, 540);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.15)');
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.2)');
        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
        
        drawPolygon(ctx, DIAMOND_SHAPE.points);
    }

    function drawStar(ctx) {
        // Golden star gradient
        const gradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 220);
        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        
        drawPolygon(ctx, STAR_SHAPE.points);
    }

    function drawHeart(ctx) {
        // Pink/red heart gradient
        const gradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 200);
        gradient.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.15)');
        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        
        drawPolygon(ctx, HEART_SHAPE.points);
    }

    function drawCat(ctx) {
        // Body
        ctx.beginPath();
        ctx.ellipse(CAT_SHAPE.bodyCenter.x, CAT_SHAPE.bodyCenter.y, CAT_SHAPE.bodyRadiusX, CAT_SHAPE.bodyRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head
        ctx.beginPath();
        ctx.arc(CAT_SHAPE.headCenter.x, CAT_SHAPE.headCenter.y, CAT_SHAPE.headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ears
        drawPolygon(ctx, CAT_SHAPE.leftEar);
        drawPolygon(ctx, CAT_SHAPE.rightEar);
        drawPolygon(ctx, CAT_SHAPE.tailPoints);

        // Face
        drawCatFace(ctx);
    }

    function drawCatFace(ctx) {
        const hx = CAT_SHAPE.headCenter.x;
        const hy = CAT_SHAPE.headCenter.y;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.lineWidth = 2;

        // Eyes
        ctx.beginPath();
        ctx.ellipse(hx - 25, hy - 5, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hx + 25, hy - 5, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Pupils
        ctx.fillStyle = 'rgba(30, 30, 60, 0.9)';
        ctx.beginPath();
        ctx.ellipse(hx - 25, hy - 5, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 25, hy - 5, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
        ctx.beginPath();
        ctx.moveTo(hx, hy + 15);
        ctx.lineTo(hx - 8, hy + 25);
        ctx.lineTo(hx + 8, hy + 25);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawShark(ctx) {
        drawPolygon(ctx, SHARK_SHAPE.bodyPoints);
        
        ctx.save();
        // Eye
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(220, 285, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(30, 30, 60, 0.9)';
        ctx.beginPath();
        ctx.arc(222, 285, 5, 0, Math.PI * 2);
        ctx.fill();

        // Gills
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(280 + i * 20, 280);
            ctx.lineTo(275 + i * 20, 320);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTree(ctx) {
        // Foliage
        const foliageGradient = ctx.createLinearGradient(0, 50, 0, 300);
        foliageGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
        foliageGradient.addColorStop(1, 'rgba(22, 163, 74, 0.2)');
        ctx.fillStyle = foliageGradient;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';

        for (const layer of TREE_SHAPE.foliage) {
            drawPolygon(ctx, layer);
        }

        // Trunk
        const trunkGradient = ctx.createLinearGradient(TREE_SHAPE.trunkLeft, 0, TREE_SHAPE.trunkRight, 0);
        trunkGradient.addColorStop(0, 'rgba(139, 90, 43, 0.4)');
        trunkGradient.addColorStop(0.5, 'rgba(160, 110, 60, 0.4)');
        trunkGradient.addColorStop(1, 'rgba(139, 90, 43, 0.4)');
        ctx.fillStyle = trunkGradient;
        ctx.strokeStyle = 'rgba(139, 90, 43, 0.7)';

        ctx.beginPath();
        ctx.rect(TREE_SHAPE.trunkLeft, TREE_SHAPE.trunkTop, TREE_SHAPE.trunkRight - TREE_SHAPE.trunkLeft, TREE_SHAPE.trunkBottom - TREE_SHAPE.trunkTop);
        ctx.fill();
        ctx.stroke();
    }

    function drawPolygon(ctx, points) {
        if (points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    function isInsideShape(x, y) {
        if (!maskCtx) return false;
        const pixel = maskCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return pixel[0] > 128;
    }

    function getScaledCoordinates(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    return {
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        initMaskCanvas,
        generateMask,
        drawShape,
        isInsideShape,
        getScaledCoordinates,
        shapes: {
            circle: CIRCLE_SHAPE,
            square: SQUARE_SHAPE,
            rectangle: RECTANGLE_SHAPE,
            triangle: TRIANGLE_SHAPE,
            diamond: DIAMOND_SHAPE,
            star: STAR_SHAPE,
            heart: HEART_SHAPE,
            cat: CAT_SHAPE,
            shark: SHARK_SHAPE,
            tree: TREE_SHAPE,
        }
    };
})();

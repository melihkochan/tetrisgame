window.onload = function() {
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas ? holdCanvas.getContext('2d') : null;
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;
const gameOverOverlay = document.getElementById('game-over-overlay');
const restartBtn = document.getElementById('restart-btn');
let scorePopups = [];

const BLOCK_SIZE = 30;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
let score = 0;
let gameLoop;
let isPaused = false;
let timerInterval = null;
let elapsedSeconds = 0;
const timerElement = document.getElementById('timer');

// Timer: geçen süreyi yukarı say
function startElapsedTimer() {
    if (timerInterval) clearInterval(timerInterval);
    elapsedSeconds = 0;
    updateTimerUI();
    timerInterval = setInterval(() => {
        if (!isPaused) {
            elapsedSeconds++;
            updateTimerUI();
        }
    }, 1000);
}
function updateTimerUI() {
    const min = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const sec = (elapsedSeconds % 60).toString().padStart(2, '0');
    timerElement.textContent = `${min}:${sec}`;
}

// Tetris parçaları ve renkler
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]], // J
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]]  // Z
];
const COLORS = [
    '#00f0f0', // I - Cyan
    '#f0f000', // O - Yellow
    '#a000f0', // T - Purple
    '#f0a000', // L - Orange
    '#0000f0', // J - Blue
    '#00f000', // S - Green
    '#f00000'  // Z - Red
];
let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
let currentPiece = null;
let currentPiecePosition = { x: 0, y: 0 };
let nextPiece = null;
let level = 1;
let lines = 0;
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');

// 2. Top score
let topScore = 0;
function updateTopScore() {
    if (score > topScore) topScore = score;
    const topScoreEl = document.getElementById('top-score');
    if (topScoreEl) topScoreEl.textContent = topScore;
}

class Piece {
    constructor(shape, color) {
        this.shape = shape;
        this.color = color;
    }
    rotate() {
        const newShape = [];
        for (let i = 0; i < this.shape[0].length; i++) {
            newShape.push([]);
            for (let j = this.shape.length - 1; j >= 0; j--) {
                newShape[i].push(this.shape[j][i]);
            }
        }
        return newShape;
    }
}
function createNewPiece() {
    const randomIndex = Math.floor(Math.random() * SHAPES.length);
    return new Piece(SHAPES[randomIndex], COLORS[randomIndex]);
}
function createNewPieceWithNext() {
    if (!nextPiece) {
        nextPiece = createNewPiece();
    }
    const piece = nextPiece;
    nextPiece = createNewPiece();
    drawMiniPiece(nextCtx, nextPiece);
    return piece;
}
function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(BOARD_WIDTH * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }
}
function drawBlock(x, y, color) {
    // Modern gradient block
    const grad = ctx.createLinearGradient(
        x * BLOCK_SIZE, y * BLOCK_SIZE, x * BLOCK_SIZE, (y + 1) * BLOCK_SIZE
    );
    grad.addColorStop(0, lightenColor(color, 0.35));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darkenColor(color, 0.25));
    ctx.fillStyle = grad;
    ctx.save();
    ctx.shadowColor = '#2228';
    ctx.shadowBlur = 6;
    ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    ctx.restore();
    // Glossy top
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, (BLOCK_SIZE - 4) / 2);
    ctx.restore();
    // Border
    ctx.strokeStyle = '#fff8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}
function lightenColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.floor(r + (255 - r) * percent));
    g = Math.min(255, Math.floor(g + (255 - g) * percent));
    b = Math.min(255, Math.floor(b + (255 - b) * percent));
    return `rgb(${r},${g},${b})`;
}
function darkenColor(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.floor(r * (1 - percent)));
    g = Math.max(0, Math.floor(g * (1 - percent)));
    b = Math.max(0, Math.floor(b * (1 - percent)));
    return `rgb(${r},${g},${b})`;
}
function getGhostPosition(piece, position) {
    let ghostPos = { ...position };
    while (isValidMove(piece, { ...ghostPos, y: ghostPos.y + 1 })) {
        ghostPos.y++;
    }
    return ghostPos;
}
function drawGhostPiece(piece, position) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = '#bbb';
                ctx.fillRect((position.x + x) * BLOCK_SIZE + 1, (position.y + y) * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            }
        });
    });
    ctx.restore();
}
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x]) {
                drawBlock(x, y, board[y][x]);
            }
        }
    }
    if (currentPiece) {
        // Önce ghost piece'i çiz
        const ghostPos = getGhostPosition(currentPiece, currentPiecePosition);
        drawGhostPiece(currentPiece, ghostPos);
        // Sonra normal taşı çiz
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    drawBlock(currentPiecePosition.x + x, currentPiecePosition.y + y, currentPiece.color);
                }
            });
        });
    }
}
function isValidMove(piece, position) {
    return piece.shape.every((row, y) => {
        return row.every((value, x) => {
            const newX = position.x + x;
            const newY = position.y + y;
            return (
                value === 0 ||
                (newX >= 0 &&
                newX < BOARD_WIDTH &&
                newY < BOARD_HEIGHT &&
                (newY < 0 || board[newY][newX] === 0))
            );
        });
    });
}
function mergePiece() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiecePosition.y + y;
                const boardX = currentPiecePosition.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        });
    });
}
function clearLines() {
    let linesCleared = 0;
    let clearedYs = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            clearedYs.push(y);
            y++;
        }
    }
    if (linesCleared > 0) {
        // Klasik Tetris puanlama
        let points = 0;
        if (linesCleared === 1) points = 100 * level;
        else if (linesCleared === 2) points = 300 * level;
        else if (linesCleared === 3) points = 500 * level;
        else if (linesCleared === 4) points = 800 * level;
        score += points;
        lines += linesCleared;
        scoreElement.textContent = score;
        linesElement.textContent = lines;
        const minY = Math.min(...clearedYs);
        const maxY = Math.max(...clearedYs);
        const popupY = ((minY + maxY + 1) / 2) * BLOCK_SIZE;
        if (points > 0) { /* addScorePopup('+' + points, canvas.width / 2 - 30, popupY); */ }
        if (lines >= level * 10) {
            level++;
            levelElement.textContent = level;
            if (gameLoop) {
                clearInterval(gameLoop);
                gameLoop = setInterval(gameTick, Math.max(100, 1000 - (level - 1) * 100));
            }
        }
    }
}
function moveDown() {
    currentPiecePosition.y++;
    if (!isValidMove(currentPiece, currentPiecePosition)) {
        currentPiecePosition.y--;
        mergePiece();
        clearLines();
        currentPiece = createNewPieceWithNext();
        currentPiecePosition = {
            x: Math.floor(BOARD_WIDTH / 2) - Math.floor(currentPiece.shape[0].length / 2),
            y: 0
        };
        if (!isValidMove(currentPiece, currentPiecePosition)) {
            clearInterval(gameLoop);
            clearInterval(timerInterval);
            gameLoop = null;
            timerInterval = null;
            updateTopScore();
            showGameOverOverlay();
            return;
        }
    }
}
function moveLeft() {
    currentPiecePosition.x--;
    if (!isValidMove(currentPiece, currentPiecePosition)) {
        currentPiecePosition.x++;
    }
}
function moveRight() {
    currentPiecePosition.x++;
    if (!isValidMove(currentPiece, currentPiecePosition)) {
        currentPiecePosition.x--;
    }
}
function rotate() {
    const rotatedShape = currentPiece.rotate();
    const originalShape = currentPiece.shape;
    currentPiece.shape = rotatedShape;
    if (!isValidMove(currentPiece, currentPiecePosition)) {
        currentPiece.shape = originalShape;
    }
}
function dropPiece() {
    while (isValidMove(currentPiece, { ...currentPiecePosition, y: currentPiecePosition.y + 1 })) {
        currentPiecePosition.y++;
    }
    moveDown();
}
function startGame() {
    resetGame();
    if (gameLoop) clearInterval(gameLoop);
    if (timerInterval) clearInterval(timerInterval);
    gameLoop = setInterval(gameTick, 1000);
    startElapsedTimer();
}
function resetGame() {
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    scoreElement.textContent = score;
    linesElement.textContent = lines;
    levelElement.textContent = level;
    nextPiece = null;
    drawMiniPiece(holdCtx, null);
    currentPiece = createNewPieceWithNext();
    currentPiecePosition = {
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(currentPiece.shape[0].length / 2),
        y: 0
    };
    elapsedSeconds = 0;
    updateTimerUI();
    setStartButtonText();
}
function gameTick() {
    if (!isPaused) {
        moveDown();
        drawBoard();
    }
}
function setStartButtonText() {
    if (!gameLoop) {
        startBtn.textContent = 'BAŞLAT';
    } else if (isPaused) {
        startBtn.textContent = 'DEVAM ET';
    } else {
        startBtn.textContent = 'DURDUR';
    }
}
startBtn.addEventListener('click', function() {
    if (gameLoop && !isPaused) {
        // Oyun çalışıyor, durdur
        isPaused = true;
        setStartButtonText();
    } else {
        if (!gameLoop) {
            resetGame();
            gameLoop = setInterval(gameTick, 1000);
            startElapsedTimer();
        }
        isPaused = false;
        setStartButtonText();
    }
});
drawBoard();
// 5. Next kutusunun arka planı için canvas'ın arka planını gradient ile doldur
function drawMiniPiece(ctx, piece) {
    if (!ctx) return;
    // Koyu-mavi gradient arka plan
    const grad = ctx.createLinearGradient(0, 0, 90, 90);
    grad.addColorStop(0, '#232a4d');
    grad.addColorStop(1, '#26306a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 90, 90);
    if (!piece) return;
    const shape = piece.shape;
    const color = piece.color;
    const offsetX = Math.floor((4 - shape[0].length) / 2);
    const offsetY = Math.floor((4 - shape.length) / 2);
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[0].length; x++) {
            if (shape[y][x]) {
                ctx.fillStyle = color;
                ctx.fillRect((x + offsetX) * 20 + 5, (y + offsetY) * 20 + 5, 18, 18);
                ctx.strokeStyle = '#fff8';
                ctx.strokeRect((x + offsetX) * 20 + 5, (y + offsetY) * 20 + 5, 18, 18);
            }
        }
    }
}
document.addEventListener('keydown', (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) {
        e.preventDefault();
    }
    if (isPaused || !gameLoop) return;
    switch (e.key) {
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case 'ArrowDown':
            moveDown();
            break;
        case 'ArrowUp':
            rotate();
            break;
        case ' ':
            dropPiece();
            break;
    }
    drawBoard();
});
if (restartBtn) {
    restartBtn.addEventListener('click', function() {
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        resetGame();
        if (!gameLoop) {
            gameLoop = setInterval(gameTick, 1000);
            startElapsedTimer();
        }
        isPaused = false;
        setStartButtonText();
    });
}
// Mobil dokunmatik butonlar için event listener ekle
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnDown = document.getElementById('btn-down');
const btnRotate = document.getElementById('btn-rotate');
const btnDrop = document.getElementById('btn-drop');
const btnHold = document.getElementById('btn-hold');
if (btnLeft) btnLeft.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { moveLeft(); drawBoard(); } });
if (btnRight) btnRight.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { moveRight(); drawBoard(); } });
if (btnDown) btnDown.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { moveDown(); drawBoard(); } });
if (btnRotate) btnRotate.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { rotate(); drawBoard(); } });
if (btnDrop) btnDrop.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { dropPiece(); drawBoard(); } });
if (btnHold) btnHold.addEventListener('touchstart', function(e) { e.preventDefault(); if (!isPaused && gameLoop) { holdCurrentPiece(); drawBoard(); } });
function holdCurrentPiece() {
    // 1. Hold sistemini kaldır
    // Tüm holdPiece, canHold, holdCtx, holdCanvas, holdCurrentPiece fonksiyonu ve ilgili kodları sil
}
// 3. Welcome overlay
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeStartBtn = document.getElementById('welcome-start-btn');
if (welcomeStartBtn) {
    welcomeStartBtn.addEventListener('click', function() {
        if (welcomeOverlay) welcomeOverlay.style.display = 'none';
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        startBtn.click();
    });
}
// Sayfa açılırken welcome overlay göster
if (welcomeOverlay) welcomeOverlay.style.display = 'flex';
if (gameOverOverlay) gameOverOverlay.style.display = 'none';

const nextCanvas1 = document.getElementById('next-canvas-1');
const nextCanvas2 = document.getElementById('next-canvas-2');
const nextCanvas3 = document.getElementById('next-canvas-3');
const nextCtx1 = nextCanvas1 ? nextCanvas1.getContext('2d') : null;
const nextCtx2 = nextCanvas2 ? nextCanvas2.getContext('2d') : null;
const nextCtx3 = nextCanvas3 ? nextCanvas3.getContext('2d') : null;

scoreElement.textContent = score;
updateTopScore();

function showGameOverOverlay() {
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
    const goScore = document.getElementById('go-score');
    const goLevel = document.getElementById('go-level');
    const goLines = document.getElementById('go-lines');
    const goTopScore = document.getElementById('go-top-score');
    if (goScore) goScore.textContent = score;
    if (goLevel) goLevel.textContent = level;
    if (goLines) goLines.textContent = lines;
    if (goTopScore) goTopScore.textContent = topScore;
}

// Oyun bittiğinde:
clearInterval(gameLoop);
clearInterval(timerInterval);
gameLoop = null;
timerInterval = null;
updateTopScore();
showGameOverOverlay();

// Skor güncellendiği her yerde updateTopScore çağır
scoreElement.textContent = score;
updateTopScore();
} // end window.onload 
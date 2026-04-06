const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

const checkWinner = (board) => {
    for (let combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return board.includes(null) ? null : 'Tie';
};

const minimax = (board, depth, isMaximizing, aiSymbol, playerSymbol, maxDepth) => {
    const result = checkWinner(board);
    if (result === aiSymbol) return 10 - depth;
    if (result === playerSymbol) return depth - 10;
    if (result === 'Tie') return 0;
    if (depth >= maxDepth) return 0; // Cutoff for medium difficulty

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = aiSymbol;
                let score = minimax(board, depth + 1, false, aiSymbol, playerSymbol, maxDepth);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = playerSymbol;
                let score = minimax(board, depth + 1, true, aiSymbol, playerSymbol, maxDepth);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
};

const getBestMove = (board, aiSymbol, difficulty = 'hard') => {
    const playerSymbol = aiSymbol === 'X' ? 'O' : 'X';
    const availableSpots = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);

    if (availableSpots.length === 0) return -1;

    // Easy: Random move
    if (difficulty === 'easy') {
        const randomIndex = Math.floor(Math.random() * availableSpots.length);
        return availableSpots[randomIndex];
    }

    let maxDepth = difficulty === 'medium' ? 2 : Infinity;
    let bestScore = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = aiSymbol;
            let score = minimax(board, 0, false, aiSymbol, playerSymbol, maxDepth);
            board[i] = null;
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    
    // Fallback if minimax struggles due to depth cutoff on medium
    if (move === -1) {
        move = availableSpots[Math.floor(Math.random() * availableSpots.length)];
    }

    return move;
};

module.exports = { checkWinner, getBestMove, WINNING_COMBOS };

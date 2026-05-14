importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

var pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

var pst_w = {
    p: [ [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0] ],
    n: [ [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50] ],
    b: [ [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20] ],
    r: [ [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0] ],
    q: [ [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20] ],
    k: [ [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20] ]
};

var startTime = 0;
var timeUp = false;
var MAX_TIME = 4000; 
var nodeCount = 0;

function checkTime() {
    if ((nodeCount++ & 1023) === 0) {
        if (Date.now() - startTime > MAX_TIME) {
            timeUp = true; 
        }
    }
}

function evaluateBoard(game) {
    var total = 0;
    var board = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var p = board[i][j];
            if (p) {
                var val = pieceValues[p.type] + (pst_w[p.type] ? pst_w[p.type][i][j] : 0);
                // 백은 양수, 흑은 음수로 절대적인 가치를 더함
                total += (p.color === 'w' ? val : -val);
            }
        }
    }
    return total;
}

function orderMoves(game, moves) {
    return moves.sort((a, b) => {
        var scoreA = 0; var scoreB = 0;
        if (a.includes('x')) scoreA += 10; if (b.includes('x')) scoreB += 10;
        if (a.includes('+')) scoreA += 5; if (b.includes('+')) scoreB += 5;
        return scoreB - scoreA;
    });
}

// ★ 버그 수정: 부호 반전(-1) 제거! 무조건 절대 평가값(stand_pat)을 그대로 반환함.
function quiesce(game, alpha, beta, isMax, qLimit) {
    checkTime(); 
    if (timeUp) return 0; 

    var stand_pat = evaluateBoard(game); 
    if (qLimit === 0) return stand_pat;

    if (isMax) {
        if (stand_pat >= beta) return beta;
        if (alpha < stand_pat) alpha = stand_pat;
    } else {
        if (stand_pat <= alpha) return alpha;
        if (beta > stand_pat) beta = stand_pat;
    }

    var moves = orderMoves(game, game.moves().filter(m => m.includes('x')));
    if (moves.length === 0) return stand_pat;

    for (var m of moves) {
        game.move(m);
        var score = quiesce(game, alpha, beta, !isMax, qLimit - 1);
        game.undo();
        
        if (isMax) {
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        } else {
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
    }
    return isMax ? alpha : beta;
}

// ★ 버그 수정: 깊이가 0일 때 부호 반전(-1) 제거!
function minimax(game, depth, alpha, beta, isMax, useQuiesce) {
    checkTime(); 
    if (timeUp) return 0; 

    if (depth === 0) return useQuiesce ? quiesce(game, alpha, beta, isMax, 3) : evaluateBoard(game);
    
    var moves = orderMoves(game, game.moves());
    if (isMax) {
        var best = -999999;
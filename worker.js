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
        if (Date.now() - startTime > MAX_TIME) timeUp = true; 
    }
}

// NegaMax를 위한 강력하고 깔끔한 판세 평가
function evaluateBoard(game, color) {
    var total = 0;
    var board = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var p = board[i][j];
            if (p) {
                var val = pieceValues[p.type];
                var pst = pst_w[p.type];
                if (pst) {
                    var rank = p.color === 'w' ? i : 7 - i; // 흑백 위치 자동 보정
                    val += pst[rank][j];
                }
                // 내 기물이면 점수 더하고, 적 기물이면 뺌
                if (p.color === color) total += val;
                else total -= val;
            }
        }
    }
    return total;
}

function orderMoves(game, moves) {
    return moves.sort((a, b) => {
        var scoreA = 0; var scoreB = 0;
        if (a.includes('x')) scoreA += 10;
        if (b.includes('x')) scoreB += 10;
        if (a.includes('+')) scoreA += 5;
        if (b.includes('+')) scoreB += 5;
        return scoreB - scoreA;
    });
}

function quiesce(game, alpha, beta, color, qLimit) {
    checkTime(); 
    if (timeUp) return 0; 

    var stand_pat = evaluateBoard(game, color); 
    if (qLimit === 0) return stand_pat;

    if (stand_pat >= beta) return beta;
    if (alpha < stand_pat) alpha = stand_pat;

    var moves = game.moves().filter(m => m.includes('x'));
    if (moves.length === 0) return stand_pat;
    
    var movesSorted = orderMoves(game, moves);

    for (var m of movesSorted) {
        game.move(m);
        var score = -quiesce(game, -beta, -alpha, color === 'w' ? 'b' : 'w', qLimit - 1);
        game.undo();
        
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function negamax(game, depth, alpha, beta, color, useQuiesce) {
    checkTime(); 
    if (timeUp) return 0; 

    if (depth === 0) return useQuiesce ? quiesce(game, alpha, beta, color, 3) : evaluateBoard(game, color);
    
    var moves = game.moves();
    if (moves.length === 0) {
        if (game.in_checkmate()) return -999999;
        return 0; 
    }

    var movesSorted = orderMoves(game, moves);
    var bestScore = -Infinity;

    for (var m of movesSorted) {
        game.move(m);
        var score = -negamax(game, depth - 1, -beta, -alpha, color === 'w' ? 'b' : 'w', useQuiesce);
        game.undo();

        if (score > bestScore) bestScore = score;
        if (bestScore > alpha) alpha = bestScore;
        if (alpha >= beta) break;
    }
    return bestScore;
}

onmessage = function(e) {
    try {
        var { fen, depth, isAIWhite, useQuiesce } = e.data;
        var game = new Chess(fen);
        var moves = game.moves();
        
        if (moves.length === 0) {
            postMessage(null);
            return;
        }

        var aiColor = isAIWhite ? 'w' : 'b';
        var movesSorted = orderMoves(game, moves);
        var bestMove = movesSorted[0]; 
        
        startTime = Date.now();
        timeUp = false;
        nodeCount = 0;

        for (var d = 1; d <= depth; d++) {
            var currentBestMove = null;
            var currentBestScore = -Infinity;

            for (var m of movesSorted) {
                game.move(m);
                var score = -negamax(game, d - 1, -1000000, 1000000, aiColor === 'w' ? 'b' : 'w', useQuiesce);
                game.undo();

                if (timeUp) break;

                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = m;
                }
            }

            if (timeUp) {
                break; 
            } else {
                bestMove = currentBestMove || bestMove; 
            }
        }

        postMessage(bestMove || movesSorted[Math.floor(Math.random() * movesSorted.length)]);
    } catch (err) {
        // ★ 최후의 방어막: 에러가 나도 게임이 멈추지 않고 아무 수나 두게 만듦
        if (moves && moves.length > 0) {
            postMessage(moves[0]);
        }
    }
};
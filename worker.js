importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

var pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

var pst_w = {
    p: [ [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0] ],
    n: [ [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50] ]
}; 

function evaluateBoard(game) {
    var total = 0;
    var board = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var p = board[i][j];
            if (p) {
                var val = pieceValues[p.type] + (pst_w[p.type] ? pst_w[p.type][i][j] : 0);
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

// ★ 변경점: qLimit (탐색 제한 깊이) 추가!
function quiesce(game, alpha, beta, isMax, qLimit) {
    var stand_pat = (isMax ? 1 : -1) * evaluateBoard(game);
    
    // 안전장치 작동: 설정한 깊이까지만 파고들고 강제 종료
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
        // 깊이를 1씩 깎으면서 재귀 호출
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

function minimax(game, depth, alpha, beta, isMax, useQuiesce) {
    // ★ 변경점: 정지 탐색을 호출할 때 최대 3수(3)까지만 보라고 브레이크를 걸어줌
    if (depth === 0) return useQuiesce ? quiesce(game, alpha, beta, isMax, 3) : (isMax ? 1 : -1) * evaluateBoard(game);
    
    var moves = orderMoves(game, game.moves());
    if (isMax) {
        var best = -99999;
        for (var m of moves) {
            game.move(m);
            best = Math.max(best, minimax(game, depth - 1, alpha, beta, false, useQuiesce));
            game.undo();
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        var best = 99999;
        for (var m of moves) {
            game.move(m);
            best = Math.min(best, minimax(game, depth - 1, alpha, beta, true, useQuiesce));
            game.undo();
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

onmessage = function(e) {
    var { fen, depth, isAIWhite, useQuiesce } = e.data;
    var game = new Chess(fen);
    var moves = orderMoves(game, game.moves());
    var bestMove = null;
    var bestVal = isAIWhite ? -999999 : 999999;

    for (var m of moves) {
        game.move(m);
        var val = minimax(game, depth - 1, -1000000, 1000000, !isAIWhite, useQuiesce);
        game.undo();
        if (isAIWhite ? val > bestVal : val < bestVal) {
            bestVal = val; bestMove = m;
        }
    }
    postMessage(bestMove);
};
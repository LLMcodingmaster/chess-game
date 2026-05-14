// ★ 본인의 Firebase 설정값으로 변경 필수! ★
const firebaseConfig = {
  apiKey: "AIzaSyBsTILIaHfuhMFQAEyXLNE3V2lNDUJVVNI",
  authDomain: "chess-leaderboard-eab00.firebaseapp.com",
  projectId: "chess-leaderboard-eab00",
  storageBucket: "chess-leaderboard-eab00.firebasestorage.app",
  messagingSenderId: "1097770206289",
  appId: "1:1097770206289:web:906c018444a60bf00ca470"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

var board = null;
var game = new Chess();
var difficultyDepth = null;
var playerColor = null;
var gameActive = false;
var selectedSquare = null;
var playerName = "";
var timerInterval = null; // 타이머 제어용 변수

const diffNames = { 1: "초심자", 2: "일반인", 3: "아마추어", 4: "프로" };

// 보조 두뇌 (worker.js) 호출
var aiWorker = new Worker('worker.js');

// AI가 계산을 마치고 수를 던져주면 작동
aiWorker.onmessage = function(e) {
    stopAITimer(); // 수가 도착하면 타이머 즉시 정지!
    
    var move = e.data;
    if (move) {
        game.move(move);
        board.position(game.fen());
        updateStatus();
    }
};

// 모달 제어
function toggleModal(id) {
    var modal = document.getElementById(id);
    modal.style.display = (modal.style.display === "block") ? "none" : "block";
}

window.onclick = function(event) {
    if (event.target == document.getElementById("rules-modal")) document.getElementById("rules-modal").style.display = "none";
    if (event.target == document.getElementById("rank-modal")) document.getElementById("rank-modal").style.display = "none";
}

// 타이머 함수 (4초)
function startAITimer() {
    document.getElementById('timer-container').style.display = 'block';
    let timeLeft = 4.0;
    const bar = document.getElementById('timer-bar-fill');
    const text = document.getElementById('timer-count');
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            timeLeft = 0;
            clearInterval(timerInterval);
        }
        text.innerText = timeLeft.toFixed(1);
        bar.style.width = (timeLeft / 4.0 * 100) + '%';
    }, 100);
}

function stopAITimer() {
    clearInterval(timerInterval);
    document.getElementById('timer-container').style.display = 'none';
}

// 파이어베이스 점수 저장
function saveResult(resultText) {
    if (!playerName) return;
    let turns = Math.ceil(game.history().length / 2); 
    database.ref('rankings').push({
        name: playerName,
        difficulty: diffNames[difficultyDepth],
        result: resultText,
        turns: turns,
        timestamp: Date.now()
    });
}

// 명예의 전당 (최단 수 정렬)
function showLeaderboard() {
    toggleModal('rank-modal');
    database.ref('rankings').once('value', (snapshot) => {
        const body = document.getElementById('leaderboard-body');
        body.innerHTML = "";
        let data = [];
        snapshot.forEach((child) => { data.push(child.val()); });
        
        let wins = data.filter(item => item.result === "플레이어 승리");
        wins.sort((a, b) => a.turns - b.turns);
        let top10 = wins.slice(0, 10);
        
        if(top10.length === 0) {
            body.innerHTML = "<tr><td colspan='4'>아직 승리 기록이 없습니다. 첫 승리의 주인공이 되어보세요!</td></tr>";
        } else {
            top10.forEach((item, index) => {
                body.innerHTML += `<tr><td>${index+1}</td><td>${item.name}</td><td>${item.difficulty}</td><td>${item.turns}턴</td></tr>`;
            });
        }
    });
}

// 세팅 버튼 동작
function selectColor(color) {
    playerColor = color;
    $('.color-btn').removeClass('active');
    $(`#btn-${color}`).addClass('active');
}

function setDifficulty(d) {
    difficultyDepth = d;
    $('.diff-btn').removeClass('active');
    $(`#diff-${d}`).addClass('active');
}

function startGame() {
    playerName = document.getElementById('player-name').value;
    if (!playerName) { alert("닉네임을 입력해주세요!"); return; }
    if (!playerColor || !difficultyDepth) { alert("진영과 난이도를 모두 선택해야 합니다!"); return; }
    
    gameActive = true;
    document.getElementById('setup-panel').style.display = 'none';
    document.getElementById('info-panel').style.display = 'block';
    
    board.orientation(playerColor === 'w' ? 'white' : 'black');
    if (playerColor === 'b') makeBestMove(); 
}

// AI에게 계산 명령 내리기
function makeBestMove() {
    if (game.game_over() || !gameActive) return;
    
    startAITimer(); // 계산 시작과 함께 4초 타이머 가동

    var depth = difficultyDepth == 4 ? 3 : difficultyDepth;
    var useQuiesce = (difficultyDepth >= 3);

    aiWorker.postMessage({
        fen: game.fen(),
        depth: parseInt(depth), 
        isAIWhite: (playerColor === 'b'),
        useQuiesce: useQuiesce
    });
}

// 이동 가능 위치(힌트) 표시
function showMoveHints(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    moves.forEach(function(move) {
        var $el = $('#board .square-' + move.to);
        if (move.captured) {
            $el.addClass('highlight-capture'); 
        } else {
            $el.addClass('highlight-hint'); 
        }
    });
}

// 힌트 삭제
function removeHints() {
    $('#board [class^="square-"]').removeClass('highlight-hint highlight-capture');
}

function highlightSquare(square) { 
    $('#board .square-' + square).addClass('highlight-active'); 
}

function removeHighlight() { 
    $('#board [class^="square-"]').removeClass('highlight-active'); 
}

// 플레이어 말 클릭 시
function onSquareClick(square) {
    if (!gameActive || game.turn() !== playerColor) return;

    if (selectedSquare === null) {
        var piece = game.get(square);
        if (piece && piece.color === playerColor) {
            selectedSquare = square;
            removeHints();
            removeHighlight();
            highlightSquare(square);
            showMoveHints(square); // 클릭 시 힌트 보여주기
        }
        return;
    }

    var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
    
    if (move === null) {
        var piece = game.get(square);
        removeHints();
        removeHighlight();
        if (piece && piece.color === playerColor && square !== selectedSquare) {
            selectedSquare = square;
            highlightSquare(square);
            showMoveHints(square);
        } else {
            selectedSquare = null; 
        }
        return;
    }

    board.position(game.fen());
    selectedSquare = null;
    removeHints();
    removeHighlight();
    updateStatus();
    
    if (!game.game_over()) makeBestMove();
}

// 게임 상태 체크 (승리, 무승부 판단)
function updateStatus() {
    var status = "";
    var restartBtn = document.getElementById('restart-btn');
    
    if (game.in_checkmate()) {
        let winner = game.turn() === playerColor ? "AI 승리" : "플레이어 승리";
        saveResult(winner); 
        alert("체크메이트! " + winner);
        status = "게임 종료 (" + winner + ")";
        gameActive = false;
        
        restartBtn.innerText = "새 게임 시작";
        restartBtn.style.background = "#238636";
        
    } else if (game.in_draw()) {
        saveResult("무승부");
        alert("무승부입니다!");
        status = "게임 종료 (무승부)";
        gameActive = false;
        
        restartBtn.innerText = "새 게임 시작";
        restartBtn.style.background = "#238636";
        
    } else {
        status = (game.turn() === playerColor ? "당신의 차례" : "AI 생각 중...") + (game.in_check() ? " (체크!)" : "");
        restartBtn.innerText = "항복 및 재시작";
        restartBtn.style.background = "#da3633";
    }
    
    document.getElementById('status-box').innerText = status;
}

var config = {
    draggable: false, 
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('board', config);

$('#board').on('click', '[data-square]', function() {
    var square = $(this).attr('data-square');
    if (square) onSquareClick(square);
});
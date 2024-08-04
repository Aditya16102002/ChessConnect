const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const clearChatBtn = document.getElementById("clear-chat");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let gameOverDisplayed = false; // Flag to ensure game over message is displayed only once
let legalMoves = []; // Array to store highlighted legal moves
let selectedPiece = null; // Track selected piece for legal moves

// Load previous chat history from local storage
const loadChatHistory = () => {
  const chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
  chatBox.innerHTML = chatHistory.map(msg => `<div>${msg}</div>`).join("");
};

// Save chat history to local storage
const saveChatHistory = (message) => {
  let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
  chatHistory.push(message);
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
};

// Clear chat history from local storage
const clearChatHistory = () => {
  localStorage.removeItem("chatHistory");
  chatBox.innerHTML = "";
};

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  board.forEach((row, rowindex) => {
    row.forEach((square, squareindex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowindex + squareindex) % 2 === 0 ? "light" : "dark"
      );

      squareElement.dataset.row = rowindex;
      squareElement.dataset.col = squareindex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = playerRole === square.color;

        pieceElement.addEventListener("click", () => {
          if (pieceElement.draggable) {
            selectedPiece = { row: rowindex, col: squareindex };
            // Request legal moves for the piece
            socket.emit("getLegalMoves", { row: rowindex, col: squareindex });
          }
        });

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowindex, col: squareindex };
            e.dataTransfer.setData("text/plain", "");
          }
        });

        pieceElement.addEventListener("dragend", (e) => {
          draggedPiece = null;
          sourceSquare = null;
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", function (e) {
        e.preventDefault();
      });

      squareElement.addEventListener("drop", function (e) {
        e.preventDefault();
        if (draggedPiece) {
          const targetSquare = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };
          handleMove(sourceSquare, targetSquare);
        }
      });

      // Add event listener to handle clicks on squares
      squareElement.addEventListener("click", () => {
        const row = parseInt(squareElement.dataset.row);
        const col = parseInt(squareElement.dataset.col);
        handleClickOnSquare(row, col);
      });

      boardElement.appendChild(squareElement);
    });
  });
  if (playerRole === 'b') {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }

  // Highlight legal moves
  legalMoves.forEach(move => {
    const square = boardElement.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
    if (square) {
      const indicator = document.createElement("div");
      indicator.classList.add("move-indicator");
      indicator.style.top = `${square.getBoundingClientRect().height / 2}px`;
      indicator.style.left = `${square.getBoundingClientRect().width / 2}px`;
      square.appendChild(indicator);
    }
  });
};

const handleMove = (source, target) => {
  const move = {
    from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
    to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    promotion: "q",
  };

  // Emit the move to the server
  socket.emit("move", move);

  // Clear legal moves from the board
  legalMoves = [];
  selectedPiece = null; // Clear selected piece
  renderBoard();
};

const handleClickOnSquare = (row, col) => {
  // Check if the clicked square is a legal move
  const targetMove = legalMoves.find(move => move.row === row && move.col === col);
  
  if (selectedPiece && targetMove) {
    handleMove(selectedPiece, targetMove);
  }
};

const getPieceUnicode = (piece) => {
  const unicodePieces = {
    p: "♙", // White pawn
    r: "♖", // White rook
    n: "♘", // White knight
    b: "♗", // White bishop
    q: "♕", // White queen
    k: "♔", // White king
    P: "♟", // Black pawn
    R: "♜", // Black rook
    N: "♞", // Black knight
    B: "♝", // Black bishop
    Q: "♛", // Black queen
    K: "♚", // Black king
  };
  return unicodePieces[piece.type] || "";
};

socket.on("playerRole", function (role) {
  playerRole = role;
  renderBoard();
  loadChatHistory(); // Load chat history on role assignment
});

socket.on("spectatorRole", function () {
  playerRole = null;
  renderBoard();
  loadChatHistory(); // Load chat history for spectators
});

socket.on("boardState", function (fen) {
  chess.load(fen);
  renderBoard();
});

socket.on("move", function (move) {
  chess.move(move);
  renderBoard();
});

socket.on("gameOver", function (result) {
  if (!gameOverDisplayed) {
    setTimeout(() => {
      let message;
      if (result === 'Stalemate') {
        message = "The game is a stalemate!";
      } else if (result === 'Draw') {
        message = "The game ended in a draw!";
      } else {
        message = `${result} wins!`;
      }
      alert(message);
      gameOverDisplayed = true; // Set the flag to prevent multiple alerts
    }, 500); // Delay by 500ms
  }
});

socket.on("chatMessage", function (message) {
  chatBox.innerHTML += `<div>${message}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom of the chat box
  saveChatHistory(message); // Save received chat message to local storage
});

// Handle chat form submission
chatForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (message) {
    socket.emit("chatMessage", message);
    chatInput.value = "";
  }
});

// Clear chat history when the "Clear Chat History" button is clicked
clearChatBtn.addEventListener("click", clearChatHistory);

// Clear chat history on page unload
window.addEventListener('beforeunload', function() {
  clearChatHistory();
});

// Handle legal moves
socket.on("legalMoves", function (moves) {
  legalMoves = moves;
  renderBoard();
});

renderBoard();


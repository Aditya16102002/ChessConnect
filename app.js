const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

let chess = new Chess(); // Initialize chess instance
let players = {};
let currentPlayer = "w";
let gameOver = false; // Flag to track if the game is over

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Custom Chess Game" });
});

io.on("connection", function (uniquesocket) {
  console.log("connected");

  // Assign player roles or spectator role
  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectatorRole");
  }

  // Handle disconnection
  uniquesocket.on("disconnect", function () {
    if (uniquesocket.id === players.white) {
      delete players.white;
    } else if (uniquesocket.id === players.black) {
      delete players.black;
    }
  });

  // Handle move requests
  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
      if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

      const result = chess.move(move);
      if (result) {
        currentPlayer = chess.turn();
        io.emit("move", move);
        io.emit("boardState", chess.fen());

        // Check for game over conditions
        if (chess.isGameOver() && !gameOver) {
          let winner;
          if (chess.isCheckmate()) {
            winner = chess.turn() === 'w' ? 'Black' : 'White';
            // Delay the game over announcement for checkmate
            setTimeout(() => {
              io.emit("gameOver", winner);
              gameOver = true; // Set the game over flag after emitting
            }, 500); // Delay by 500ms
          } else if (chess.isStalemate()) {
            winner = 'Stalemate';
            io.emit("gameOver", winner);
            gameOver = true; // Set the game over flag after emitting
          } else {
            winner = 'Draw';
            io.emit("gameOver", winner);
            gameOver = true; // Set the game over flag after emitting
          }
        }
      } else {
        console.log("Invalid move: ", move);
        uniquesocket.emit("invalidMove", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("invalidMove", move);
    }
  });

  // Handle chat messages
  uniquesocket.on("chatMessage", (message) => {
    let prefix = "";
    if (players.white === uniquesocket.id) {
      prefix = "w: ";
    } else if (players.black === uniquesocket.id) {
      prefix = "b: ";
    }

    const prefixedMessage = prefix + message;

    io.to(players.white).emit("chatMessage", prefixedMessage);
    io.to(players.black).emit("chatMessage", prefixedMessage);
  });

  // Reset game state for a new game
  uniquesocket.on("newGame", () => {
    chess = new Chess(); // Reset the chess instance
    gameOver = false; // Reset the game over flag
    io.emit("boardState", chess.fen()); // Emit initial board state
  });

  // Send legal moves for a piece
  uniquesocket.on("getLegalMoves", (square) => {
    const { row, col } = square;
    const moves = chess.moves({
      square: `${String.fromCharCode(97 + col)}${8 - row}`,
      verbose: true
    }).map(move => ({
      row: 8 - parseInt(move.to[1]),
      col: move.to.charCodeAt(0) - 97
    }));
    uniquesocket.emit("legalMoves", moves);
  });
});

server.listen(3000, function () {
  console.log("listening on port 3000");
});


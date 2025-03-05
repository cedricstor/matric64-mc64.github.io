// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const getEvaluation = (message, turn) => {
    let result = { bestMove: "", evaluation: "" };

    if (message.startsWith("bestmove")) {
        result.bestMove = message.split(" ")[1];
    }

    if (message.includes("info") && message.includes("score")) {
        const scoreParts = message.split(" ");
        const scoreIndex = scoreParts.indexOf("score") + 2;

        if (scoreParts[scoreIndex - 1] === "cp") {
            let score = parseInt(scoreParts[scoreIndex], 10);
            if (turn !== "b") {
                score = -score;
            }
            result.evaluation = `${(score / 100).toFixed(2)}`;
        } else if (scoreParts[scoreIndex - 1] === "mate") {
            const mateIn = parseInt(scoreParts[scoreIndex], 10);
            result.evaluation = `Mate in ${Math.abs(mateIn)}`;
        }
    }

    return result;
};

const App = () => {
    const [game, setGame] = useState(new Chess());
    const [stockfish, setStockfish] = useState(null);
    const [bestMove, setBestMove] = useState("");
    const [evaluation, setEvaluation] = useState("");
    const [moveHistory, setMoveHistory] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [promotionSquare, setPromotionSquare] = useState(null);
    const [promotionSource, setPromotionSource] = useState(null);
    const [showPromotionModal, setShowPromotionModal] = useState(false);

    useEffect(() => {
        const stockfishWorker = new Worker(`${process.env.PUBLIC_URL}/js/stockfish-17-lite-single.js`);
        setStockfish(stockfishWorker);

        return () => {
            stockfishWorker.terminate();
        };
    }, []);

    const resetGame = () => {
        const newGame = new Chess();
        setGame(newGame);
        setMoveHistory([]);
        setBestMove("");
        setEvaluation("");
        setErrorMessage("");
    };

    const undoLastMove = () => {
      if (moveHistory.length === 0) return;
  
      const gameCopy = new Chess(game.fen());
  
      const undoneMove = gameCopy.undo();  // Actually undo the move in game state
  
      if (undoneMove) {
          setGame(gameCopy);  // Set the new game state after undo
          setMoveHistory((prev) => prev.slice(0, -1));  // Remove last move from history
      }
  };

    const handlePromotionSelection = (piece) => {
        handleMove(promotionSource, promotionSquare, piece);
        setShowPromotionModal(false);
        setPromotionSource(null);
        setPromotionSquare(null);
    };

    const onDrop = (sourceSquare, targetSquare) => {
        if (isPromotionMove(sourceSquare, targetSquare)) {
            setPromotionSource(sourceSquare);
            setPromotionSquare(targetSquare);
            setShowPromotionModal(true);
            return false; // Block move until promotion is handled
        }

        return handleMove(sourceSquare, targetSquare, "q"); // Default to queen for non-promotion moves
    };

    const isPromotionMove = (from, to) => {
        const piece = game.get(from);
        if (piece && piece.type === "p") {
            if ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1")) {
                return true;
            }
        }
        return false;
    };

    const handleMove = (sourceSquare, targetSquare, promotionPiece) => {
        const gameCopy = new Chess(game.fen());
        setErrorMessage("");

        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: promotionPiece,
            });

            if (move === null) {
                setErrorMessage("Invalid move. Please try again.");
                return false;
            }

            setGame(gameCopy);
            setMoveHistory((prev) => [...prev, move.san]);

            if (stockfish) {
                stockfish.postMessage(`position fen ${gameCopy.fen()}`);
                stockfish.postMessage("go depth 15");

                stockfish.onmessage = (event) => {
                    const { bestMove, evaluation } = getEvaluation(event.data, game.turn());
                    if (bestMove) setBestMove(bestMove);
                    if (evaluation) setEvaluation(evaluation);
                };
            }

            return true;
        } catch (error) {
            setErrorMessage(`Move failed: ${error.message}`);
            console.error(error.message);
            return false;
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "row", gap: "20px", padding: "20px" }}>
            <div>
                <h1>Chess Game with Stockfish</h1>
                <button onClick={resetGame} style={{ marginBottom: "10px" }}>Reset Game</button>
                <button onClick={undoLastMove} style={{ marginBottom: "10px", marginLeft: "10px" }}>Undo Last Move</button>

                <Chessboard
                    position={game.fen()}
                    onPieceDrop={onDrop}
                    boardWidth={500}
                />

                {errorMessage && <p style={{ color: "red", marginTop: "10px" }}>{errorMessage}</p>}
                <div>
                    <h3>Best Move: {bestMove || "Calculating..."}</h3>
                    <h3>Evaluation: {evaluation || "Evaluating..."}</h3>
                </div>
            </div>

            <div>
                <h3>Move History</h3>
                <ol>
                    {moveHistory.map((move, index) => (
                        <li key={index}>{move}</li>
                    ))}
                </ol>
            </div>

            {/* Promotion Modal */}
            {showPromotionModal && (
                <div style={modalStyles}>
                    <h3>Select Promotion Piece</h3>
                    <div style={{ display: "flex", gap: "10px" }}>
                        {["q", "r", "b", "n"].map((piece) => (
                            <button
                                key={piece}
                                onClick={() => handlePromotionSelection(piece)}
                                style={pieceButtonStyles}
                            >
                                {piece === "q" ? "♕ Queen" :
                                 piece === "r" ? "♖ Rook" :
                                 piece === "b" ? "♗ Bishop" :
                                 "♘ Knight"}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Basic styles for modal
const modalStyles = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "white",
    padding: "20px",
    boxShadow: "0px 0px 10px rgba(0,0,0,0.3)",
    zIndex: 1000,
    borderRadius: "8px"
};

const pieceButtonStyles = {
    fontSize: "16px",
    padding: "10px 20px",
    cursor: "pointer"
};

export default App;
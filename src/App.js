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
    const [redoStack, setRedoStack] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [promotionSquare, setPromotionSquare] = useState(null);
    const [promotionSource, setPromotionSource] = useState(null);
    const [showPromotionModal, setShowPromotionModal] = useState(false);

    useEffect(() => {
        const savedFen = localStorage.getItem("chessGameFEN");
        const savedHistory = JSON.parse(localStorage.getItem("chessMoveHistory")) || [];
        const savedRedoStack = JSON.parse(localStorage.getItem("chessRedoStack")) || [];

        if (savedFen) {
            const savedGame = new Chess();
            savedGame.load(savedFen);
            setGame(savedGame);
        }

        setMoveHistory(savedHistory);
        setRedoStack(savedRedoStack);

        const stockfishWorker = new Worker(`${process.env.PUBLIC_URL}/js/stockfish-17-lite-single.js`);
        setStockfish(stockfishWorker);

        return () => {
            stockfishWorker.terminate();
        };
    }, []);

    useEffect(() => {
        localStorage.setItem("chessGameFEN", game.fen());
        localStorage.setItem("chessMoveHistory", JSON.stringify(moveHistory));
        localStorage.setItem("chessRedoStack", JSON.stringify(redoStack));
    }, [game, moveHistory, redoStack]);

    const resetGame = () => {
        const newGame = new Chess();
        setGame(newGame);
        setMoveHistory([]);
        setRedoStack([]);
        setBestMove("");
        setEvaluation("");
        setErrorMessage("");

        localStorage.removeItem("chessGameFEN");
        localStorage.removeItem("chessMoveHistory");
        localStorage.removeItem("chessRedoStack");
    };

    const undoLastMove = () => {
        if (moveHistory.length === 0) return;

        const gameCopy = new Chess(game.fen());
        const undoneMove = gameCopy.undo();

        if (undoneMove) {
            setGame(gameCopy);
            setMoveHistory((prev) => prev.slice(0, -1));
            setRedoStack((prev) => [undoneMove, ...prev]);
        }
    };

    const redoLastMove = () => {
        if (redoStack.length === 0) return;

        const gameCopy = new Chess(game.fen());
        const move = redoStack[0];
        gameCopy.move(move);

        setGame(gameCopy);
        setMoveHistory((prev) => [...prev, move.san]);
        setRedoStack((prev) => prev.slice(1));
    };

    const onDrop = (sourceSquare, targetSquare) => {
        if (isPromotionMove(sourceSquare, targetSquare)) {
            setPromotionSource(sourceSquare);
            setPromotionSquare(targetSquare);
            setShowPromotionModal(true);
            return false; // Block automatic move - wait for user to select piece
        }

        return handleMove(sourceSquare, targetSquare, null);
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

    const handlePromotionSelection = (piece) => {
        handleMove(promotionSource, promotionSquare, piece);
        setShowPromotionModal(false);
        setPromotionSource(null);
        setPromotionSquare(null);
    };

    const handleMove = (sourceSquare, targetSquare, promotionPiece) => {
        const gameCopy = new Chess(game.fen());
        setErrorMessage("");

        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: promotionPiece || undefined,
            });

            if (move === null) {
                setErrorMessage("Invalid move. Please try again.");
                return false;
            }

            setGame(gameCopy);
            setMoveHistory((prev) => [...prev, move.san]);
            setRedoStack([]); // Clear redo stack after any valid move

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
        <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
            <div>
                <h1>Chess Game with Stockfish</h1>
                <button onClick={resetGame}>Reset Game</button>
                <button onClick={undoLastMove}>Undo Last Move</button>
                <button onClick={redoLastMove}>Redo Last Move</button>

                <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={500} />

                {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
                <h3>Best Move: {bestMove || "Calculating..."}</h3>
                <h3>Evaluation: {evaluation || "Evaluating..."}</h3>
            </div>

            {showPromotionModal && (
                <div style={{ backgroundColor: "white", padding: "20px", border: "1px solid black", zIndex: 1000 }}>
                    <h3>Select Promotion Piece</h3>
                    {["q", "r", "b", "n"].map((piece) => (
                        <button key={piece} onClick={() => handlePromotionSelection(piece)}>
                            {piece.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default App;
// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import ThreatMeter from "./ThreatMeter";
import MateInstructions from "./MateInstructions";

// Parse Stockfish messages to extract evaluation, best move, mate info, and principal variation
const getEvaluation = (message, turn) => {
    let result = { bestMove: "", evaluation: "", forcedMate: false, mateIn: null, principalVariation: [] };

    if (message.startsWith("bestmove")) {
        result.bestMove = message.split(" ")[1];
    }

    if (message.includes("info") && message.includes("score")) {
        const parts = message.split(" ");
        const scoreIndex = parts.indexOf("score") + 2;

        if (parts[scoreIndex - 1] === "cp") {
            let score = parseInt(parts[scoreIndex], 10);
            if (turn !== "b") score = -score;
            result.evaluation = `${(score / 100).toFixed(2)}`;
        } else if (parts[scoreIndex - 1] === "mate") {
            const mateIn = parseInt(parts[scoreIndex], 10);
            result.mateIn = mateIn;
            result.forcedMate = true;
            result.evaluation = `Mate in ${Math.abs(mateIn)}`;
        }
    }

    if (message.includes(" pv ")) {
        const pvIndex = message.indexOf(" pv ") + 4;
        const pvMoves = message.slice(pvIndex).trim().split(" ");
        result.principalVariation = pvMoves;
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
    const [promotionSource, setPromotionSource] = useState(null);
    const [promotionSquare, setPromotionSquare] = useState(null);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [mateInfo, setMateInfo] = useState(null);
    const [stockfishLog, setStockfishLog] = useState([]);
    const [fromSquare, setFromSquare] = useState(null);
    const [toSquare, setToSquare] = useState(null);
    const [bestMoveArrow, setBestMoveArrow] = useState([]);
    const arrowColor = "rgba(0, 0, 255, 0.6)";

    useEffect(() => {
        const worker = new Worker(`${process.env.PUBLIC_URL}/js/stockfish-17-lite-single.js`);
        setStockfish(worker);
        return () => worker.terminate();
    }, []);

    const resetGame = () => {
        setGame(new Chess());
        setMoveHistory([]);
        setRedoStack([]);
        setBestMove("");
        setEvaluation("");
        setErrorMessage("");
        setMateInfo(null);
        setStockfishLog([]);
        setFromSquare(null);
        setToSquare(null);
        setBestMoveArrow([]);
    };

    const undoLastMove = () => {
        if (moveHistory.length === 0) return;

        const gameCopy = new Chess(game.fen());
        const undoneMove = gameCopy.undo();
        if (undoneMove) {
            setGame(gameCopy);
            setMoveHistory(prev => prev.slice(0, -1));
            setRedoStack(prev => [undoneMove, ...prev]);
            setFromSquare(undoneMove.from);
            setToSquare(undoneMove.to);
        }
    };

    const redoLastMove = () => {
        if (redoStack.length === 0) return;

        const gameCopy = new Chess(game.fen());
        const move = redoStack[0];
        gameCopy.move(move);

        setGame(gameCopy);
        setMoveHistory(prev => [...prev, move.san]);
        setRedoStack(prev => prev.slice(1));
        setFromSquare(move.from);
        setToSquare(move.to);
    };

    const isPromotionMove = (from, to) => {
        const piece = game.get(from);
        return piece?.type === "p" && ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
    };

    const onDrop = (source, target) => {
        if (isPromotionMove(source, target)) {
            setPromotionSource(source);
            setPromotionSquare(target);
            setShowPromotionModal(true);
            return false;
        }
        return handleMove(source, target, null);
    };

    const handlePromotionSelection = (piece) => {
        handleMove(promotionSource, promotionSquare, piece);
        setShowPromotionModal(false);
        setPromotionSource(null);
        setPromotionSquare(null);
    };

    const handleMove = (source, target, promotion) => {
        const gameCopy = new Chess(game.fen());
        setErrorMessage("");

        const move = gameCopy.move({ from: source, to: target, promotion });

        if (!move) {
            setErrorMessage("Invalid move. Please try again.");
            return false;
        }

        setGame(gameCopy);
        setMoveHistory(prev => [...prev, move.san]);
        setRedoStack([]);
        setFromSquare(source);
        setToSquare(target);
        setBestMoveArrow([]);  // Clear arrow on player move

        stockfish.postMessage(`position fen ${gameCopy.fen()}`);
        stockfish.postMessage("go depth 12");

        stockfish.onmessage = (event) => {
            setStockfishLog(prev => [...prev.slice(-19), event.data]);

            const { bestMove, evaluation, forcedMate, mateIn, principalVariation } = getEvaluation(event.data, game.turn());

            setBestMove(bestMove || "");
            setEvaluation(evaluation || "");

            if (bestMove) {
                setBestMoveArrow([[bestMove.slice(0, 2), bestMove.slice(2, 4)]]);
            }

            if (forcedMate) {
                setMateInfo({ mateIn, principalVariation });
            } else {
                setMateInfo(null);
            }
        };

        return true;
    };

    const getSquareStyles = () => {
        const styles = {};
        if (fromSquare) styles[fromSquare] = { backgroundColor: "rgba(173, 216, 230, 0.8)" };
        if (toSquare) styles[toSquare] = { backgroundColor: "rgba(144, 238, 144, 0.8)" };
        return styles;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", padding: "20px", gap: "20px" }}>
            <div>
                <h1>Chess Game with Stockfish</h1>
                <button onClick={resetGame}>Reset Game</button>
                <button onClick={undoLastMove}>Undo Last Move</button>
                <button onClick={redoLastMove}>Redo Last Move</button>

                <Chessboard
                    position={game.fen()}
                    onPieceDrop={onDrop}
                    boardWidth={500}
                    customSquareStyles={getSquareStyles()}
                    customArrows={bestMoveArrow}
                    customArrowColor={arrowColor}
                />

                {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
                <h3>Best Move: {bestMove || "Calculating..."}</h3>
                <ThreatMeter evaluation={evaluation} />
                {mateInfo && <MateInstructions mateInfo={mateInfo} />}
            </div>

            {showPromotionModal && (
                <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid black", zIndex: 1000 }}>
                    <h3>Select Promotion Piece</h3>
                    {["q", "r", "b", "n"].map(piece => (
                        <button key={piece} onClick={() => handlePromotionSelection(piece)}>
                            {piece.toUpperCase()}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "#f0f0f0", padding: "10px", fontSize: "12px" }}>
                <h4>Stockfish Logs</h4>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                    {stockfishLog.join("\n")}
                </pre>
            </div>
        </div>
    );
};

export default App;
// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

// Function to extract best move and evaluation from Stockfish's message
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

    useEffect(() => {
        const stockfishWorker = new Worker(`${process.env.PUBLIC_URL}/js/stockfish-17-lite-single.js`);
        setStockfish(stockfishWorker);

        return () => {
            stockfishWorker.terminate();
        };
    }, []);

    const onDrop = (sourceSquare, targetSquare) => {
        const gameCopy = new Chess(game.fen());
        setErrorMessage("");  // Clear previous errors

        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q", // Always promote to queen for simplicity
            });

            if (move === null) {
                setErrorMessage("Invalid move. Please try again.");
                return false;
            }

            setGame(gameCopy);
            setMoveHistory((prev) => [...prev, move.san]);  // Store move in history

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
        </div>
    );
};

export default App;
// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import ThreatMeter from "./ThreatMeter";
import MateInstructions from "./MateInstructions";
import {
    Button,
    Container,
    Typography,
    Box
} from "@mui/material";

// Parse Stockfish output for best move, evaluation, mate, etc.
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

    return result;
};

// Function to clean and extract bare moves from PGN
const extractMoves = (pgn) => {
    return pgn.replace(/^\[.*\]$/gm, "")
        .replace(/\{.*?\}/g, "")
        .replace(/\d+\.+/g, "")
        .trim()
        .replace(/\s+/g, " ");
};

// Function to calculate FEN from PGN moves
const calculateFenFromMoves = (pgn) => {
    const chess = new Chess();
    chess.loadPgn(extractMoves(pgn));
    return chess.fen();
};

const App = () => {
    const [view, setView] = useState("chess");

    // Chess Game with Stockfish
    const [game, setGame] = useState(new Chess());
    const [stockfish, setStockfish] = useState(null);
    const [bestMove, setBestMove] = useState("");
    const [evaluation, setEvaluation] = useState("");
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
        setBestMove("");
        setEvaluation("");
        setMateInfo(null);
        setStockfishLog([]);
        setFromSquare(null);
        setToSquare(null);
        setBestMoveArrow([]);
    };

    const handleMove = (source, target, promotion) => {
        const gameCopy = new Chess(game.fen());
        if (!gameCopy.move({ from: source, to: target, promotion })) return false;

        setGame(gameCopy);
        setFromSquare(source);
        setToSquare(target);
        setBestMoveArrow([]);

        stockfish.postMessage(`position fen ${gameCopy.fen()}`);
        stockfish.postMessage("go depth 12");

        stockfish.onmessage = (event) => {
            setStockfishLog(prev => [...prev.slice(-19), event.data]);
            const { bestMove, evaluation, forcedMate, mateIn, principalVariation } = getEvaluation(event.data, game.turn());
            setBestMove(bestMove || "");
            setEvaluation(evaluation || "");
            if (bestMove) setBestMoveArrow([[bestMove.slice(0, 2), bestMove.slice(2, 4)]]);
        };

        return true;
    };

    const getSquareStyles = () => ({
        [fromSquare]: { backgroundColor: "rgba(173, 216, 230, 0.8)" },
        [toSquare]: { backgroundColor: "rgba(144, 238, 144, 0.8)" }
    });

    return (
        <Container>
            <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={resetGame}>Reset Game</Button>
            </Box>

            <Box>
                <Typography variant="h4">Chess Game with Stockfish</Typography>
                <Chessboard
                    position={game.fen()}
                    onPieceDrop={(s, t) => handleMove(s, t, null)}
                    boardWidth={500}
                    customSquareStyles={getSquareStyles()}
                    customArrows={bestMoveArrow}
                    customArrowColor={arrowColor}
                />
                <Typography variant="h6">Best Move: {bestMove || "Calculating..."}</Typography>
                <ThreatMeter evaluation={evaluation} />
                {mateInfo && <MateInstructions mateInfo={mateInfo} />}
            </Box>

            <Box sx={{ maxHeight: 200, overflowY: "auto", backgroundColor: "#f0f0f0", padding: 2, marginTop: 2 }}>
                <Typography variant="subtitle1">Stockfish Logs</Typography>
                <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>
                    {stockfishLog.join("\n")}
                </pre>
            </Box>
        </Container>
    );
};

export default App;
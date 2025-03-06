// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
    TextField,
    Button,
    Container,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@mui/material";
import ThreatMeter from "./ThreatMeter";
import MateInstructions from "./MateInstructions";

// Parse Stockfish messages to extract evaluation, best move, and forced mate info
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
            result.mateIn = parseInt(parts[scoreIndex], 10);
            result.forcedMate = true;
            result.evaluation = `Mate in ${Math.abs(result.mateIn)}`;
        }
    }

    return result;
};

const extractMoves = (pgn) =>
    pgn.replace(/^\[.*\]$/gm, "").replace(/\{.*?\}/g, "").replace(/\d+\.+/g, "").trim().replace(/\s+/g, " ");

const calculateFenFromMoves = (pgn) => {
    const chess = new Chess();
    chess.loadPgn(extractMoves(pgn));
    return chess.fen();
};

const App = () => {
    const [view, setView] = useState("chess");
    const [game, setGame] = useState(new Chess());
    const [stockfish, setStockfish] = useState(null);
    const [bestMove, setBestMove] = useState("");
    const [evaluation, setEvaluation] = useState("");
    const [mateInfo, setMateInfo] = useState(null);
    const [fromSquare, setFromSquare] = useState(null);
    const [toSquare, setToSquare] = useState(null);
    const [bestMoveArrow, setBestMoveArrow] = useState([]);
    const [moveHistory, setMoveHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [stockfishLog, setStockfishLog] = useState([]);
    const arrowColor = "rgba(0, 0, 255, 0.6)";

    const [lichessUsername, setLichessUsername] = useState("");
    const [lichessGames, setLichessGames] = useState([]);
    const [chessComUsername, setChessComUsername] = useState("");
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [chessComGames, setChessComGames] = useState([]);

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
        setMateInfo(null);
        setFromSquare(null);
        setToSquare(null);
        setBestMoveArrow([]);
        setStockfishLog([]);
    };

    const undoLastMove = () => {
        if (moveHistory.length === 0) return;
        const gameCopy = new Chess(game.fen());
        const undoneMove = gameCopy.undo();
        if (undoneMove) {
            setGame(gameCopy);
            setMoveHistory((prev) => prev.slice(0, -1));
            setRedoStack((prev) => [undoneMove, ...prev]);
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
        setMoveHistory((prev) => [...prev, move.san]);
        setRedoStack((prev) => prev.slice(1));
        setFromSquare(move.from);
        setToSquare(move.to);
    };

    const handleMove = (source, target, promotion) => {
        const gameCopy = new Chess(game.fen());
        const move = gameCopy.move({ from: source, to: target, promotion });

        if (!move) return false;

        setGame(gameCopy);
        setMoveHistory((prev) => [...prev, move.san]);
        setRedoStack([]);
        setFromSquare(source);
        setToSquare(target);
        setBestMoveArrow([]);

        stockfish.postMessage(`position fen ${gameCopy.fen()}`);
        stockfish.postMessage("go depth 15");

        stockfish.onmessage = (event) => {
            const { bestMove, evaluation } = getEvaluation(event.data, game.turn());
            if (bestMove) setBestMoveArrow([[bestMove.slice(0, 2), bestMove.slice(2, 4)]]);
            setBestMove(bestMove || "");
            setEvaluation(evaluation || "");
        };

        return true;
    };

    const getSquareStyles = () => ({
        [fromSquare]: { backgroundColor: "rgba(173, 216, 230, 0.8)" },
        [toSquare]: { backgroundColor: "rgba(144, 238, 144, 0.8)" },
    });

    const fetchLichessGames = async () => {
        const response = await fetch(
            `https://lichess.org/api/games/user/${lichessUsername}?max=50&opening=true&moves=true&lastFen=true`,
            { headers: { Accept: "application/x-ndjson" } }
        );
        const text = await response.text();
        setLichessGames(text.trim().split("\n").map((line) => JSON.parse(line)));
    };

    const fetchChessComGames = async () => {
        const response = await fetch(`https://api.chess.com/pub/player/${chessComUsername}/games/${year}/${month}`);
        const data = await response.json();
        setChessComGames(
            (data.games || []).map((game) => ({
                ...game,
                finalFen: calculateFenFromMoves(game.pgn),
            }))
        );
    };

    return (
        <Container>
            <Box sx={{ mb: 2 }}>
                <Button onClick={() => setView("chess")}>Play Chess</Button>
                <Button onClick={() => setView("lichess")}>Lichess Games</Button>
                <Button onClick={() => setView("chesscom")}>Chess.com Games</Button>
            </Box>

            {view === "chess" && (
                <Box>
                    <Typography variant="h4">Chess Game with Stockfish</Typography>
                    <Button onClick={resetGame}>Reset Game</Button>
                    <Button onClick={undoLastMove}>Undo Move</Button>
                    <Button onClick={redoLastMove}>Redo Move</Button>
                    <Chessboard
                        position={game.fen()}
                        onPieceDrop={(s, t) => handleMove(s, t, null)}
                        boardWidth={500}
                        customSquareStyles={getSquareStyles()}
                        customArrows={bestMoveArrow}
                        customArrowColor={arrowColor}
                    />
                    <ThreatMeter evaluation={evaluation} />
                    {mateInfo && <MateInstructions mateInfo={mateInfo} />}
                </Box>
            )}

            {/* Lichess Game Viewer */}
            {view === "lichess" && <LichessViewer {...{ lichessUsername, setLichessUsername, fetchLichessGames, lichessGames }} />}

            {/* Chess.com Game Viewer */}
            {view === "chesscom" && <ChessComViewer {...{ chessComUsername, setChessComUsername, month, setMonth, year, setYear, fetchChessComGames, chessComGames }} />}
        </Container>
    );
};

export default App;
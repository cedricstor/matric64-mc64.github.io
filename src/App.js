// src/App.js

import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import ThreatMeter from "./ThreatMeter";
import MateInstructions from "./MateInstructions";
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

// Evaluation parser from Stockfish
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
            const { bestMove, evaluation } = getEvaluation(event.data, game.turn());
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

    // Lichess Fetch
    const [lichessUsername, setLichessUsername] = useState("");
    const [lichessGames, setLichessGames] = useState([]);

    const fetchLichessGames = async () => {
        const url = `https://lichess.org/api/games/user/${lichessUsername}?max=50&opening=true&moves=true&lastFen=true`;
        const response = await fetch(url, { headers: { Accept: "application/x-ndjson" } });
        const text = await response.text();
        setLichessGames(text.trim().split("\n").map(line => JSON.parse(line)));
    };

    // Chess.com Fetch
    const [chessComUsername, setChessComUsername] = useState("");
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [chessComGames, setChessComGames] = useState([]);

    const fetchChessComGames = async () => {
        const url = `https://api.chess.com/pub/player/${chessComUsername}/games/${year}/${month}`;
        const response = await fetch(url);
        const data = await response.json();
        const gamesWithFen = (data.games || []).slice(0, 50).map(game => ({
            ...game,
            finalFen: calculateFenFromMoves(game.pgn)
        }));
        setChessComGames(gamesWithFen);
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
                    <Chessboard
                        position={game.fen()}
                        onPieceDrop={(s, t) => handleMove(s, t, null)}
                        boardWidth={500}
                        customSquareStyles={getSquareStyles()}
                        customArrows={bestMoveArrow}
                        customArrowColor={arrowColor}
                    />
                    <p>Best Move: {bestMove}</p>
                    <ThreatMeter evaluation={evaluation} />
                    {mateInfo && <MateInstructions mateInfo={mateInfo} />}
                </Box>
            )}

            {view === "lichess" && (
                <Box>
                    <Typography variant="h4">Lichess Game Viewer</Typography>
                    <TextField label="Lichess Username" value={lichessUsername} onChange={e => setLichessUsername(e.target.value)} />
                    <Button onClick={fetchLichessGames}>Fetch Games</Button>
                    <Table><TableBody>
                        {lichessGames.map((g, i) => (
                            <TableRow key={i}>
                                <TableCell><Chessboard position={g.lastFen} boardWidth={200} /></TableCell>
                                <TableCell>{g.opening?.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table>
                </Box>
            )}

            {view === "chesscom" && (
                <Box>
                    <Typography variant="h4">Chess.com Game Viewer</Typography>
                    <TextField label="Username" value={chessComUsername} onChange={e => setChessComUsername(e.target.value)} />
                    <TextField label="Month" value={month} onChange={e => setMonth(e.target.value)} />
                    <TextField label="Year" value={year} onChange={e => setYear(e.target.value)} />
                    <Button onClick={fetchChessComGames}>Fetch Games</Button>
                    <Table><TableBody>
                        {chessComGames.map((g, i) => (
                            <TableRow key={i}>
                                <TableCell><Chessboard position={g.finalFen} boardWidth={200} /></TableCell>
                                <TableCell>{g.white?.username} vs {g.black?.username}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table>
                </Box>
            )}
        </Container>
    );
};

export default App;
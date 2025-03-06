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

const App = () => {
    const [game, setGame] = useState(new Chess());
    const [stockfish, setStockfish] = useState(null);
    const [bestMove, setBestMove] = useState("");
    const [evaluation, setEvaluation] = useState("");
    const [mateInfo, setMateInfo] = useState(null);
    const [stockfishLog, setStockfishLog] = useState([]);
    const [fromSquare, setFromSquare] = useState(null);
    const [toSquare, setToSquare] = useState(null);
    const [bestMoveArrow, setBestMoveArrow] = useState([]);
    const [playerColor, setPlayerColor] = useState("w");
    const [isPvS, setIsPvS] = useState(false); // Player vs Stockfish mode toggle
    const [promotionSource, setPromotionSource] = useState(null);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [promotionSquare, setPromotionSquare] = useState(null);
    const [moveHistory, setMoveHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const arrowColor = "rgba(0, 0, 255, 0.6)";

    useEffect(() => {
        const worker = new Worker(`${process.env.PUBLIC_URL}/js/stockfish-17-lite-single.js`);
        setStockfish(worker);
        return () => worker.terminate();
    }, []);

    const resetGame = (color = "w") => {
        const newGame = new Chess();
        setGame(newGame);
        setPlayerColor(color);
        setBestMove("");
        setEvaluation("");
        setMateInfo(null);
        setStockfishLog([]);
        setFromSquare(null);
        setToSquare(null);
        setBestMoveArrow([]);
        setShowPromotionModal(false);

        if (color === "b" && isPvS) {
            // Stockfish opens if player is black
            setTimeout(() => {
                requestStockfishMove(newGame);
            }, 100);
        }
    };

    const requestStockfishMove = (currentGame) => {
        stockfish.postMessage(`position fen ${currentGame.fen()}`);
        stockfish.postMessage("go depth 12");

        stockfish.onmessage = (event) => {
            const { bestMove } = getEvaluation(event.data, currentGame.turn());
            if (bestMove) {
                currentGame.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) });
                setGame(new Chess(currentGame.fen()));
                setFromSquare(bestMove.slice(0, 2));
                setToSquare(bestMove.slice(2, 4));
                updateEvaluation(currentGame);
            }
        };
    };

    const updateEvaluation = (currentGame) => {
        stockfish.postMessage(`position fen ${currentGame.fen()}`);
        stockfish.postMessage("go depth 12");

        stockfish.onmessage = (event) => {
            setStockfishLog(prev => [...prev.slice(-19), event.data]);
            const { bestMove, evaluation, forcedMate, mateIn, principalVariation } = getEvaluation(event.data, currentGame.turn());
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
    };

    const handleMove = (source, target, promotion) => {
        const gameCopy = new Chess(game.fen());
        if (!gameCopy.move({ from: source, to: target, promotion })) return false;

        setGame(gameCopy);
        setFromSquare(source);
        setToSquare(target);
        setBestMoveArrow([]);

        const newMoveHistory = moveHistory.slice(0, currentMoveIndex + 1);
        newMoveHistory.push(gameCopy.fen());
        setMoveHistory(newMoveHistory);
        setCurrentMoveIndex(newMoveHistory.length - 1);

        updateEvaluation(gameCopy);

        if (isPvS && gameCopy.turn() !== playerColor) {
            setTimeout(() => requestStockfishMove(gameCopy), 300);
        }

        return true;
    };

    const handleUndo = () => {
        if (currentMoveIndex <= 0) return;
        const gameCopy = new Chess(moveHistory[currentMoveIndex - 1]);
        setGame(gameCopy);
        setCurrentMoveIndex(currentMoveIndex - 1);
        updateEvaluation(gameCopy);
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
        return handleMove(source, target, "q");
    };

    const handlePromotionSelection = (piece) => {
        handleMove(promotionSource, promotionSquare, piece);
        setShowPromotionModal(false);
        setPromotionSource(null);
        setPromotionSquare(null);
    };

    const getSquareStyles = () => ({
        [fromSquare]: { backgroundColor: "rgba(173, 216, 230, 0.8)" },
        [toSquare]: { backgroundColor: "rgba(144, 238, 144, 0.8)" }
    });

    return (
        <Container>
            <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={() => resetGame("w")}>Play as White</Button>
                <Button variant="contained" onClick={() => resetGame("b")}>Play as Black</Button>
                <Button variant="contained" onClick={handleUndo}>Undo Move</Button>
                <Button variant="contained" onClick={() => setIsPvS(!isPvS)}>
                    Switch to {isPvS ? "PvP" : "PvS"} Mode
                </Button>
            </Box>

            <Box>
                <Typography variant="h4">Chess Game with Stockfish</Typography>
                <Chessboard
                    position={game.fen()}
                    onPieceDrop={onDrop}
                    boardWidth={500}
                    customSquareStyles={getSquareStyles()}
                    customArrows={bestMoveArrow}
                    customArrowColor={arrowColor}
                    boardOrientation={playerColor === "w" ? "white" : "black"}
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

            {showPromotionModal && (
                <Box sx={{ backgroundColor: "#fff", padding: 2, border: "1px solid black", zIndex: 1000, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                    <Typography>Select Promotion Piece</Typography>
                    {["q", "r", "b", "n"].map(piece => (
                        <Button key={piece} onClick={() => handlePromotionSelection(piece)}>{piece.toUpperCase()}</Button>
                    ))}
                </Box>
            )}
        </Container>
    );
};

export default App;
// src/MateInstructions.js

import React from "react";

const MateInstructions = ({ mateInfo }) => {
    const copyToClipboard = () => {
        navigator.clipboard.writeText(mateInfo.principalVariation.join(" "));
    };

    return (
        <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#ffeeba", border: "1px solid #ffc107" }}>
            <h3>Guaranteed Mate Detected!</h3>
            <p>Mate in {mateInfo.mateIn} moves.</p>
            <h4>Correct Move Sequence:</h4>
            <ol>
                {mateInfo.principalVariation.map((move, index) => (
                    <li key={index}>{move}</li>
                ))}
            </ol>
            <button onClick={copyToClipboard}>Copy Move Sequence</button>
        </div>
    );
};

export default MateInstructions;
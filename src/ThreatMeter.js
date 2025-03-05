// src/ThreatMeter.js

import React from "react";

const ThreatMeter = ({ evaluation }) => {
    const getThreatColor = () => {
        const score = parseFloat(evaluation) || 0;

        if (score > 5) return "green";
        if (score > 2) return "lightgreen";
        if (score > -2) return "yellow";
        if (score > -5) return "orange";
        return "red";
    };

    return (
        <div style={{
            width: "100%",
            height: "20px",
            backgroundColor: getThreatColor(),
            color: "black",  // Always black for better readability
            textAlign: "center",
            marginBottom: "10px"
        }}>
            {evaluation ? `Threat Level: ${evaluation}` : "Threat Level: No Evaluation"}
        </div>
    );
};

export default ThreatMeter;
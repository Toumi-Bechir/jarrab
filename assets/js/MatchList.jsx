import React, { useState } from 'react';

const MatchList = ({ groupedMatches }) => {
  const leagues = Object.keys(groupedMatches).sort();

  return (
    <div className="space-y-4">
      {leagues.length === 0 ? (
        <p className="text-gray-400">No matches available.</p>
      ) : (
        leagues.map(league => (
          <div key={league} className="bg-gray-800 rounded-lg overflow-hidden">
            <h2 className="text-lg font-semibold bg-gray-700 text-white px-4 py-2">{league}</h2>
            <div className="divide-y divide-gray-700">
              {groupedMatches[league].map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MatchCard = ({ match }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract team names
  const team1 = match.t1?.n || "Team 1";
  const team2 = match.t2?.n || "Team 2";

  // Extract match time (et in seconds, convert to MM:SS)
  const matchTimeSeconds = match.et || 0;
  const minutes = Math.floor(matchTimeSeconds / 60);
  const seconds = matchTimeSeconds % 60;
  const matchTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Extract score (stats.a in format [home, away])
  const score = match.stats?.a ? `${match.stats.a[0]} - ${match.stats.a[1]}` : "0 - 0";

  // Extract odds (1777 for 1X2, 421 for double chance)
  const odds1777 = match.odds?.["1777"] || null; // e.g., { 1: "2.10", X: "3.20", 2: "3.50" }
  const odds421 = match.odds?.["421"] || null;   // e.g., { "1X": "1.30", "X2": "1.70", "12": "1.40" }

  return (
    <div className="p-4 hover:bg-gray-700">
      {/* Main Row - Always Visible */}
      <div className="flex justify-between items-center">
        {/* Left: Teams and Match Time */}
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="text-red-500 text-xs">●</span>
              <span className="text-sm text-gray-400">{matchTime}</span>
            </div>
            <div className="flex-1">
              <p className="text-base font-medium text-white">{team1}</p>
              <p className="text-base font-medium text-white">{team2}</p>
            </div>
          </div>
        </div>

        {/* Center: Score */}
        <div className="text-lg font-bold text-white mx-4">{score}</div>

        {/* Right: Action Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm md:text-base"
        >
          {isExpanded ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      {/* Expanded Details - Visible on Click (Mobile) or Always on Desktop */}
      <div className={`${isExpanded ? 'block' : 'hidden'} md:block mt-2 text-sm text-gray-400`}>
        <div className="flex flex-col space-y-2">
          {odds1777 && (
            <div className="flex space-x-2">
              <span>1X2 Odds:</span>
              <span>1: {odds1777["1"] || "N/A"}</span>
              <span>X: {odds1777["X"] || "N/A"}</span>
              <span>2: {odds1777["2"] || "N/A"}</span>
            </div>
          )}
          {odds421 && (
            <div className="flex space-x-2">
              <span>Double Chance:</span>
              <span>1X: {odds421["1X"] || "N/A"}</span>
              <span>X2: {odds421["X2"] || "N/A"}</span>
              <span>12: {odds421["12"] || "N/A"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchList;
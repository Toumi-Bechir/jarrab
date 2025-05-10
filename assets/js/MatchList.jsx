import React, { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { getMarketName } from './marketNames';

const MatchList = memo(({ groupedMatches }) => {
  const leagues = Object.keys(groupedMatches);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  // Toggle the expanded state for a match
  const toggleMatchDetails = (matchId) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  return (
    <div className="space-y-4">
      {leagues.length === 0 ? (
        <p className="text-gray-400">No matches available.</p>
      ) : (
        leagues.map(league => (
          <div key={league} className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="flex justify-between items-center bg-gray-700 text-white px-4 py-2">
              <h2 className="text-lg font-semibold">{league}</h2>
              <div className="flex space-x-4 text-sm">
                <span className="w-16 text-center">Over</span>
                <span className="w-16 text-center">Under</span>
              </div>
            </div>
            <div className="divide-y divide-gray-700">
              {groupedMatches[league].map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isExpanded={expandedMatchId === match.id}
                  toggleDetails={() => toggleMatchDetails(match.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
});

const MatchCard = memo(({ match, isExpanded, toggleDetails }) => {
  // Extract team names
  const team1 = match.t1?.n || "Team 1";
  const team2 = match.t2?.n || "Team 2";

  // Extract match time (et in seconds, convert to MM:SS)
  const matchTimeSeconds = match.et || 0;
  const minutes = Math.floor(matchTimeSeconds / 60);
  const seconds = matchTimeSeconds % 60;
  const matchTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Extract score (stats.a in format [home, away])
  const homeScore = match.stats?.a?.[0] || "0";
  const awayScore = match.stats?.a?.[1] || "0";

  // Extract odds for 421 (handicap over/under) without sorting
  const odds421 = match.odds?.filter(odd => odd.id === 421)[0] || null; // Take the first match without sorting

  // Extract over/under values and ha from the selected odds
  const overValue = odds421?.o?.find(opt => opt.n === "Over")?.v || "N/A";
  const underValue = odds421?.o?.find(opt => opt.n === "Under")?.v || "N/A";
  const haValue = odds421?.ha || "N/A";

  // Extract sport from match data (assumed to be in match.sport)
  const sport = match.sport || "soccer"; // Fallback to "soccer" if not available

  // Group odds by id for the expanded view
  const allOdds = match.odds || [];
  const groupedOdds = allOdds.reduce((acc, odd) => {
    const id = odd.id;
    if (!acc[id]) {
      acc[id] = [];
    }
    acc[id].push(odd);
    return acc;
  }, {});

  return (
    <div className="p-4 hover:bg-gray-700">
      {/* Main Row - Always Visible */}
      <div className="flex justify-between items-center">
        {/* Left: Match Time, Teams, and Score */}
        <div className="flex items-center space-x-2 flex-1">
          <div className="flex items-center space-x-1 w-16">
            <span className="text-red-500 text-xs">●</span>
            <span className="text-sm text-gray-400">{matchTime}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <Link to={`/match/${match.id}`} className="text-base font-medium text-white flex-1 hover:underline">
                {team1}
              </Link>
              <p className="text-sm text-yellow-400">{homeScore}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Link to={`/match/${match.id}`} className="text-base font-medium text-white flex-1 hover:underline">
                {team2}
              </Link>
              <p className="text-sm text-yellow-400">{awayScore}</p>
            </div>
          </div>
        </div>

        {/* Center: Odds (421) with ha */}
        <div className="flex space-x-4 text-sm text-white mx-4">
          <span className="w-16 text-center">
            {haValue} <span className="text-yellow-400">{overValue}</span>
          </span>
          <span className="w-16 text-center">
            {haValue} <span className="text-yellow-400">{underValue}</span>
          </span>
        </div>

        {/* Right: Arrow Icon */}
        <button
          onClick={toggleDetails}
          className="text-white text-xl focus:outline-none"
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded Details - Grouped Odds */}
      {isExpanded && (
        <div className="mt-2 text-sm text-gray-400 p-2 bg-gray-700 rounded">
          <h4 className="font-semibold text-white mb-1">All Odds</h4>
          {Object.keys(groupedOdds).map(id => (
            <OddsMarket
              key={id}
              id={Number(id)}
              odds={groupedOdds[id]}
              homeTeam={team1}
              awayTeam={team2}
              sport={sport}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const OddsMarket = memo(({ id, odds, homeTeam, awayTeam, sport }) => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);

  // Determine the display type based on the structure of the options
  const optionNames = [...new Set(odds.flatMap(odd => odd.o.map(opt => opt.n)))].sort();
  const isTableFormatOverUnder = optionNames.some(name => ["Over", "Under", "Exactly"].includes(name));
  const isRowFormat = optionNames.some(name => ["1", "X", "2"].includes(name)) && !odds[0]?.ha; // Second structure: 1, X, 2 without ha
  const isTableFormatHandicap = optionNames.some(name => ["1", "X", "2"].includes(name)) && odds[0]?.ha; // Third structure: 1, X, 2 with ha

  // Default format for odds (simple list)
  const formatOddsOptions = (odd) => {
    const options = odd.o.map(opt => `${opt.n}: ${opt.v}`).join(", ");
    const ha = odd.ha ? ` ${odd.ha}` : "";
    return `${getMarketName(id, sport)}${ha}: ${options}`;
  };

  // Table format for odds like id: 16 (Over, Exactly, Under or Over, Under)
  const renderTableFormatOverUnder = () => {
    return (
      <div className="bg-gray-600 rounded p-2">
        {/* Sub-Header: Option Names */}
        <div className="flex border-b border-gray-500 pb-1">
          <span className="w-16 text-center text-white font-semibold"></span>
          {optionNames.map((name, index) => (
            <span key={index} className="flex-1 text-center text-white font-semibold">{name}</span>
          ))}
        </div>

        {/* Data Rows: ha and v values */}
        {odds.map((odd, index) => ( // Removed sorting by ha
          <div key={index} className="flex py-1 border-b border-gray-500 last:border-b-0">
            <span className="w-16 text-center text-white">ha ({odd.ha})</span>
            {optionNames.map((name, idx) => {
              const option = odd.o.find(opt => opt.n === name);
              return (
                <span key={idx} className="flex-1 text-center text-yellow-400">
                  {option ? option.v : "N/A"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Row format for odds like id: 27 (1, X, 2 without ha)
  const renderRowFormat = () => {
    // Group options into rows of up to 3
    const rows = [];
    for (let i = 0; i < odds.length; i += 3) {
      rows.push(odds.slice(i, i + 3));
    }

    return (
      <div className="bg-gray-600 rounded p-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex py-1 border-b border-gray-500 last:border-b-0">
            {row.map((odd, index) => (
              odd.o.map((opt, optIndex) => {
                const displayName = opt.n === "1" ? homeTeam : opt.n === "2" ? awayTeam : "Tie";
                return (
                  <span key={`${index}-${optIndex}`} className="flex-1 text-center text-white">
                    {displayName} <span className="text-yellow-400">{opt.v}</span>
                  </span>
                );
              })
            ))}
            {/* Fill remaining space with empty spans if less than 3 options */}
            {row.length < 3 && Array(3 - row.length).fill().map((_, idx) => (
              <span key={`empty-${idx}`} className="flex-1 text-center"></span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Table format for odds like id: 11 (1, X, 2 with ha)
  const renderTableFormatHandicap = () => {
    return (
      <div className="bg-gray-600 rounded p-2">
        {/* Sub-Header: Option Names */}
        <div className="flex border-b border-gray-500 pb-1">
          {optionNames.map((name, index) => {
            const displayName = name === "1" ? homeTeam : name === "2" ? awayTeam : "Tie";
            return (
              <span key={index} className="flex-1 text-center text-white font-semibold">{displayName}</span>
            );
          })}
        </div>

        {/* Data Rows: ha and v values */}
        {odds.map((odd, index) => ( // Removed sorting by ha
          <div key={index} className="flex py-1 border-b border-gray-500 last:border-b-0">
            {optionNames.map((name, idx) => {
              const option = odd.o.find(opt => opt.n === name);
              return (
                <span key={idx} className="flex-1 text-center text-white">
                  {option ? (
                    <>
                      +{odd.ha} {name === "1" ? "1" : name === "2" ? "2" : "1"} <span className="text-yellow-400">{option.v}</span>
                    </>
                  ) : (
                    "N/A"
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Row format for odds like id: 561127121 (arbitrary names, 2-3 columns per row)
  const renderDefaultRowFormat = () => {
    // Flatten options since each odds entry has multiple options
    const allOptions = odds.flatMap(odd => odd.o || []);
    // Group options into rows of 2 to 3 columns
    const rows = [];
    for (let i = 0; i < allOptions.length; i += 3) {
      const row = allOptions.slice(i, i + 3);
      // Ensure at least 2 columns, up to 3
      if (row.length === 1) {
        row.push({ n: "...", v: "" }); // Add placeholder to ensure 2 columns
      }
      rows.push(row);
    }

    return (
      <div className="bg-gray-600 rounded p-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex py-1 border-b border-gray-500 last:border-b-0">
            {row.map((opt, optIndex) => (
              <span key={optIndex} className="flex-1 text-center text-white">
                {opt.n} <span className="text-yellow-400">{opt.v || ""}</span>
              </span>
            ))}
            {/* Fill remaining space with empty spans if less than 3 options */}
            {row.length < 3 && Array(3 - row.length).fill().map((_, idx) => (
              <span key={`empty-${idx}`} className="flex-1 text-center"></span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="border-b border-gray-600 mb-2">
      {/* Market Header */}
      <div className="flex justify-between items-center py-2">
        <span className="text-white font-medium">{getMarketName(id, sport)}</span>
        <button
          onClick={() => setIsMarketExpanded(prev => !prev)}
          className="text-white text-xl focus:outline-none"
        >
          {isMarketExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Market Details */}
      {isMarketExpanded && (
        <>
          {isTableFormatOverUnder ? (
            renderTableFormatOverUnder()
          ) : isRowFormat ? (
            renderRowFormat()
          ) : isTableFormatHandicap ? (
            renderTableFormatHandicap()
          ) : (
            renderDefaultRowFormat()
          )}
        </>
      )}
    </div>
  );
});

export default MatchList;
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getMarketName } from './marketNames';

const MatchDetails = ({ matches, sport }) => {
  const { id } = useParams(); // Get the match ID from the URL
  const navigate = useNavigate();
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);

  // Find the match by ID
  const match = matches.find(m => m.id === id);
  
  // If matches are still loading or match is not found, show a loading message
  if (!match) {
    return <div className="text-white">Loading match details...</div>;
  }

  const team1 = match?.t1?.n || "Team 1";
  const team2 = match?.t2?.n || "Team 2";
  const homeScore = match?.stats?.a?.[0] || "0";
  const awayScore = match?.stats?.a?.[1] || "0";
  const matchTimeSeconds = match?.et || 0;
  const minutes = Math.floor(matchTimeSeconds / 60);
  const seconds = matchTimeSeconds % 60;
  const matchTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const yellowCards = match?.yellow_cards || { team1: 0, team2: 0 };
  const redCards = match?.red_cards || { team1: 0, team2: 0 };
  const allOdds = match?.odds || [];

  // Filter matches for the same sport and group by league
  const sportMatches = matches.filter(m => m.sport === sport);
  const groupedSportMatches = sportMatches.reduce((acc, match) => {
    const league = match.cmp_name || "Unknown League";
    if (!acc[league]) {
      acc[league] = [];
    }
    acc[league].push(match);
    return acc;
  }, {});
  const leagues = Object.keys(groupedSportMatches); // Removed .sort()

  // Group odds by id for the expanded view
  const groupedOdds = allOdds.reduce((acc, odd) => {
    const id = odd.id;
    if (!acc[id]) {
      acc[id] = [];
    }
    acc[id].push(odd);
    return acc;
  }, {});

  // Handler to close the menu when a match is clicked
  const handleMatchClick = () => {
    setIsMenuExpanded(false);
  };

  // Handler to close the menu without selecting a match
  const handleCloseMenu = () => {
    setIsMenuExpanded(false);
  };

  return (
    <div className="text-white">
      {/* Header with Back Arrow and Toggleable Menu */}
      <div className="sticky top-0 z-10 bg-gray-900">
        <div className="bg-gray-800 p-4 rounded-lg mb-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-white text-xl focus:outline-none">
            ←
          </button>
          <div className="flex items-center">
            <h1 className="text-2xl font-bold mr-4">{team1} vs {team2}</h1>
            <button
              onClick={() => setIsMenuExpanded(prev => !prev)}
              className="text-white text-xl focus:outline-none"
            >
              {isMenuExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Toggleable Menu of Other Matches - Fixed Overlay When Expanded */}
      {isMenuExpanded && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-20 overflow-y-auto">
          <div className="bg-gray-700 p-4 rounded-lg m-4 relative">
            {/* Close Button (X) in Top-Right Corner */}
            <button
              onClick={handleCloseMenu}
              className="absolute top-4 right-4 text-white text-xl font-bold hover:text-gray-300 focus:outline-none"
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2">Other {sport} Matches</h2>
            <div className="space-y-4">
              {leagues.map(league => (
                <div key={league}>
                  <h3 className="text-md font-semibold text-white mb-2">{league}</h3>
                  <div className="space-y-2">
                    {groupedSportMatches[league].map(m => (
                      <Link
                        key={m.id}
                        to={`/match/${m.id}`}
                        onClick={handleMatchClick} // Close menu on click
                        className="flex justify-between items-center p-2 bg-gray-600 rounded hover:bg-gray-500"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-red-500 text-xs">●</span>
                          <span className="text-sm text-gray-400">
                            {m.et ? `${Math.floor(m.et / 60)}:${(m.et % 60).toString().padStart(2, '0')}` : "0:00"}
                          </span>
                          <span className="text-white">{m.t1?.n || "Team 1"} vs {m.t2?.n || "Team 2"}</span>
                        </div>
                        <span className="text-yellow-400">
                          {m.stats?.a?.[0] || "0"} - {m.stats?.a?.[1] || "0"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Sticky Match Details and Scrollable Odds */}
      <div className="relative z-0">
        {/* Match Details - Desktop and Mobile Layout */}
        <div className="sticky top-[80px] bg-gray-900 z-10">
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            {/* Desktop Layout */}
            <div className="md:flex md:items-center md:justify-between hidden">
              <div className="flex items-center space-x-2">
                <span className="text-red-500 text-xs">●</span>
                <span className="text-sm text-gray-400">{matchTime}</span>
                <div>
                  <p className="text-base font-medium text-white">{team1}</p>
                  <p className="text-base font-medium text-white">{team2}</p>
                </div>
              </div>
              <div className="text-lg font-bold text-yellow-400 mx-4">
                {homeScore} - {awayScore}
              </div>
              <div className="text-sm text-gray-400">
                <p>Yellow Cards: {yellowCards.team1}-{yellowCards.team2}</p>
                <p>Red Cards: {redCards.team1}-{redCards.team2}</p>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-red-500 text-xs">●</span>
                <span className="text-sm text-gray-400">{matchTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-base font-medium text-white">{team1}</p>
                  <p className="text-base font-medium text-white">{team2}</p>
                </div>
                <div className="text-lg font-bold text-yellow-400">
                  {homeScore} - {awayScore}
                </div>
              </div>
              <div className="text-sm text-gray-400 mt-2">
                <p>Yellow Cards: {yellowCards.team1}-{yellowCards.team2}</p>
                <p>Red Cards: {redCards.team1}-{redCards.team2}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Odds Section */}
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Betting Odds</h2>
            <div className="space-y-2">
              {Object.keys(groupedOdds).map(id => (
                <OddsMarket
                  key={id}
                  id={Number(id)}
                  odds={groupedOdds[id] || []} // Ensure odds is always an array
                  homeTeam={team1}
                  awayTeam={team2}
                  sport={sport}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component for each odds market (copied from MatchList.jsx)
const OddsMarket = ({ id, odds, homeTeam, awayTeam, sport }) => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);

  // Safeguard: Ensure odds is an array
  const safeOdds = Array.isArray(odds) ? odds : [];

  // Determine the display type based on the structure of the options
  const optionNames = [...new Set(safeOdds.flatMap(odd => odd.o?.map(opt => opt.n) || []))].sort();
  const isTableFormatOverUnder = optionNames.some(name => ["Over", "Under", "Exactly"].includes(name));
  const isRowFormat = optionNames.some(name => ["1", "X", "2"].includes(name)) && (!safeOdds[0] || !safeOdds[0].ha); // Second structure: 1, X, 2 without ha
  const isTableFormatHandicap = optionNames.some(name => ["1", "X", "2"].includes(name)) && safeOdds[0]?.ha; // Third structure: 1, X, 2 with ha

  // Default format for odds (simple list)
  const formatOddsOptions = (odd) => {
    const options = odd.o?.map(opt => `${opt.n}: ${opt.v}`).join(", ") || "N/A";
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
        {safeOdds.sort((a, b) => a.ha - b.ha).map((odd, index) => (
          <div key={index} className="flex py-1 border-b border-gray-500 last:border-b-0">
            <span className="w-16 text-center text-white">ha ({odd.ha})</span>
            {optionNames.map((name, idx) => {
              const option = odd.o?.find(opt => opt.n === name);
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
    for (let i = 0; i < safeOdds.length; i += 3) {
      rows.push(safeOdds.slice(i, i + 3));
    }

    return (
      <div className="bg-gray-600 rounded p-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex py-1 border-b border-gray-500 last:border-b-0">
            {row.map((odd, index) => (
              odd.o?.map((opt, optIndex) => {
                const displayName = opt.n === "1" ? homeTeam : opt.n === "2" ? awayTeam : "Tie";
                return (
                  <span key={`${index}-${optIndex}`} className="flex-1 text-center text-white">
                    {displayName} <span className="text-yellow-400">{opt.v}</span>
                  </span>
                );
              }) || []
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
        {safeOdds.sort((a, b) => a.ha - b.ha).map((odd, index) => (
          <div key={index} className="flex py-1 border-b border-gray-500 last:border-b-0">
            {optionNames.map((name, idx) => {
              const option = odd.o?.find(opt => opt.n === name);
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
    const allOptions = safeOdds.flatMap(odd => odd.o || []);
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
};

export default MatchDetails;
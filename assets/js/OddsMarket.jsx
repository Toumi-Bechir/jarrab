import React, { useState } from 'react';
import { getMarketName } from './marketNames';

const OddsMarket = ({ id, odds, homeTeam, awayTeam, sport }) => {
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);

  // Determine the display type based on the structure of the options
  const optionNames = [...new Set(odds.flatMap(odd => odd.o.map(opt => opt.n)))].sort();
  const isTableFormatOverUnder = optionNames.some(name => ["Over", "Under", "Exactly"].includes(name));
  const isRowFormat = optionNames.some(name => ["1", "X", "2"].includes(name)) && !odds[0].ha; // Second structure: 1, X, 2 without ha
  const isTableFormatHandicap = optionNames.some(name => ["1", "X", "2"].includes(name)) && odds[0].ha; // Third structure: 1, X, 2 with ha

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
        {odds.sort((a, b) => a.ha - b.ha).map((odd, index) => (
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
        {odds.sort((a, b) => a.ha - b.ha).map((odd, index) => (
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
    const allOptions = odds.flatMap(odd => odd.o);
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

export default OddsMarket;
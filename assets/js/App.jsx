import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MatchList from './MatchList';
import MatchDetails from './MatchDetails';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [channel, setChannel] = useState(null);
  const [sport, setSport] = useState("soccer");
  const sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"];
  const pageSize = 50; // Must match the backend @page_size

  // Map sports to their Unicode icons for mobile view
  const sportIcons = {
    soccer: "⚽",
    basket: "🏀",
    tennis: "🎾",
    baseball: "⚾",
    amfootball: "🏈",
    hockey: "🏒",
    volleyball: "🏐",
  };

  useEffect(() => {
    const socket = new Phoenix.Socket("/socket", {});
    socket.connect();

    const newChannel = socket.channel(`match:${sport}`, { page: page.toString() });
    newChannel.join()
      .receive("ok", resp => {
        console.log(`Joined match:${sport}`, resp);
        setMatches(resp.events || []);
        const newTotalPages = resp.total_pages || 1;
        setTotalPages(newTotalPages);
        setTotalMatches(resp.total_events || 0);
      })
      .receive("error", resp => {
        console.error(`Failed to join match:${sport}`, resp);
      });

    newChannel.on("batch_update", payload => {
      console.log("Received batch update", payload);
      setMatches(prevMatches => {
        const updatedMatches = [...prevMatches];
        payload.updates.forEach(update => {
          const index = updatedMatches.findIndex(match => match.id === update.event_id);
          if (index !== -1) {
            updatedMatches[index] = update.event;
          } else {
            updatedMatches.push(update.event);
          }
        });
        return updatedMatches;
      });
      newChannel.push("get_event_count", {})
        .receive("ok", resp => {
          const newTotalPages = resp.total_pages || 1;
          setTotalPages(newTotalPages);
          setTotalMatches(resp.total_events || 0);
        });
    });

    newChannel.on("event_removed", payload => {
      console.log("Received event removed", payload);
      setMatches(prevMatches => prevMatches.filter(match => match.id !== payload.event_id));
      newChannel.push("get_event_count", {})
        .receive("ok", resp => {
          const newTotalPages = resp.total_pages || 1;
          setTotalPages(newTotalPages);
          setTotalMatches(resp.total_events || 0);
        });
    });

    newChannel.on("presence_state", payload => {
      console.log("Received presence state", payload);
      const userCount = Object.keys(payload).length;
      console.log(`Setting connectedUsers to ${userCount}`);
      setConnectedUsers(userCount);
    });

    newChannel.on("presence_diff", payload => {
      console.log("Received presence diff", payload);
      setConnectedUsers(prevCount => {
        const joins = Object.keys(payload.joins).length;
        const leaves = Object.keys(payload.leaves).length;
        const newCount = prevCount + joins - leaves;
        console.log(`Updating connectedUsers: prev=${prevCount}, joins=${joins}, leaves=${leaves}, newCount=${newCount}`);
        return newCount;
      });
    });

    setChannel(newChannel);

    return () => {
      newChannel.leave();
      socket.disconnect();
    };
  }, [sport, page]);

  // Memoize groupedMatches to prevent recalculation on every render
  const groupedMatches = useMemo(() => {
    return matches.reduce((acc, match) => {
      const league = match.cmp_name || "Unknown League";
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(match);
      return acc;
    }, {});
  }, [matches]);

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prevPage => prevPage - 1);
    }
  };

  const handleSportChange = (newSport) => {
    setSport(newSport);
    setPage(1);
  };

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-900">
        {/* Sidebar - Sticky on Desktop, Hidden on Mobile */}
        <div className="w-64 bg-gray-800 p-4 md:sticky md:top-0 md:h-screen hidden md:block">
          <h2 className="text-xl font-bold mb-4">Sports</h2>
          <ul>
            {sports.map(s => (
              <li key={s} className="mb-2">
                <button
                  onClick={() => handleSportChange(s)}
                  className={`w-full text-left px-4 py-2 rounded ${sport === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Routes>
            <Route
              path="/"
              element={
                <>
                  {/* Sticky Header and Sports Menu */}
                  <div className="sticky top-0 z-10 bg-gray-900">
                    <div className="bg-gray-800 p-4 rounded-lg mb-4 flex justify-between items-center">
                      <h1 className="text-2xl font-bold text-white">Live Matches - {sport} ({totalMatches})</h1>
                      <span className="text-gray-400">Connected Users: {connectedUsers}</span>
                    </div>

                    {/* Sports Menu - Horizontal on Mobile */}
                    <div className="md:hidden flex overflow-x-auto space-x-2 mb-4">
                      {sports.map(s => (
                        <button
                          key={s}
                          onClick={() => handleSportChange(s)}
                          className={`flex-shrink-0 px-4 py-2 rounded text-2xl ${sport === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                        >
                          {sportIcons[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Match List - Scrollable */}
                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                    <MatchList groupedMatches={groupedMatches} />
                    <div className="mt-4 flex justify-between">
                      <button
                        onClick={handlePrevPage}
                        disabled={page === 1}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-600"
                      >
                        Previous
                      </button>
                      <span className="text-gray-400">Page {page} of {totalPages}</span>
                      <button
                        onClick={handleNextPage}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-600"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              }
            />
            <Route
              path="/match/:id"
              element={<MatchDetails matches={matches} sport={sport} />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
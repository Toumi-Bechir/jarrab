import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MatchList from './MatchList';
import MatchDetails from './MatchDetails';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [sport, setSport] = useState("soccer");
  const [isLoading, setIsLoading] = useState(false);
  const sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"];

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
    setIsLoading(true);
    const socket = new Phoenix.Socket("/socket", {});
    socket.connect();

    const channelTopic = "match:all"; // Define topic explicitly
    console.log("Joining channel:", channelTopic); // Debug log
    const newChannel = socket.channel("match:all", {});
    newChannel.join()
      .receive("ok", resp => {
        console.log("Joined channel successfully:", channelTopic, resp); // Debug log
        setIsLoading(false);
      })
      .receive("error", resp => {
        console.error("Failed to join channel:", channelTopic, resp); // Debug log
        setIsLoading(false);
      });

    newChannel.on("shard_data", payload => {
      const shardEvents = payload.events || [];
      setMatches(prevMatches => {
        const otherShardEvents = prevMatches.filter(event => !shardEvents.some(e => e.id === event.id));
        return [...otherShardEvents, ...shardEvents];
      });
      newChannel.push("get_event_count", {});
    });

    newChannel.on("batch_update", payload => {
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
      newChannel.push("get_event_count", {});
    });

    newChannel.on("event_removed", payload => {
      setMatches(prevMatches => prevMatches.filter(match => match.id !== payload.event_id));
      newChannel.push("get_event_count", {});
    });

    newChannel.on("presence_state", payload => {
      const userCount = Object.keys(payload).length;
      setConnectedUsers(userCount);
    });

    newChannel.on("presence_diff", payload => {
      setConnectedUsers(prevCount => {
        const joins = Object.keys(payload.joins).length;
        const leaves = Object.keys(payload.leaves).length;
        return prevCount + joins - leaves;
      });
    });

    newChannel.push("get_event_count", {});

    return () => {
      newChannel.leave();
      socket.disconnect();
    };
  }, []);

  const sportMatches = useMemo(() => {
    return matches.filter(m => m.sport === sport);
  }, [matches, sport]);

  const groupedMatches = useMemo(() => {
    return sportMatches.reduce((acc, match) => {
      const league = match.cmp_name || "Unknown League";
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(match);
      return acc;
    }, {});
  }, [sportMatches]);

  const handleSportChange = (newSport) => {
    setSport(newSport);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 0);
  };

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-900">
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

        <div className="flex-1 p-6">
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <div className="sticky top-0 z-10 bg-gray-900">
                    <div className="bg-gray-800 p-4 rounded-lg mb-4 flex justify-between items-center">
                      <h1 className="text-2xl font-bold text-white">
                        Live Matches - {sport} ({sportMatches.length})
                      </h1>
                      <span className="text-gray-400">
                        Connected Users: {isLoading ? '...' : connectedUsers}
                      </span>
                    </div>

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

                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                    {isLoading ? (
                      <p className="text-gray-400">Loading matches...</p>
                    ) : (
                      <MatchList groupedMatches={groupedMatches} />
                    )}
                  </div>
                </>
              }
            />
            <Route
              path="/match/:id"
              element={<MatchDetails matches={sportMatches} sport={sport} />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
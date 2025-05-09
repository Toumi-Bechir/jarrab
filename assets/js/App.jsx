import React, { useState, useEffect } from 'react';
import MatchList from './MatchList';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [channel, setChannel] = useState(null);
  const [sport, setSport] = useState("soccer");
  const sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"];

  useEffect(() => {
    const socket = new Phoenix.Socket("/socket", {});
    socket.connect();

    const newChannel = socket.channel(`match:${sport}`, { page: page.toString() });
    newChannel.join()
      .receive("ok", resp => {
        console.log(`Joined match:${sport}`, resp);
        setMatches(resp.events || []);
        setTotalPages(resp.total_pages || 1);
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
    });

    newChannel.on("event_removed", payload => {
      console.log("Received event removed", payload);
      setMatches(prevMatches => prevMatches.filter(match => match.id !== payload.event_id));
    });

    newChannel.on("presence_state", payload => {
      console.log("Received presence state", payload);
      const userCount = Object.keys(payload).length;
      setConnectedUsers(userCount);
    });

    newChannel.on("presence_diff", payload => {
      console.log("Received presence diff", payload);
      setConnectedUsers(prevCount => {
        const joins = Object.keys(payload.joins).length;
        const leaves = Object.keys(payload.leaves).length;
        return prevCount + joins - leaves;
      });
    });

    setChannel(newChannel);

    return () => {
      newChannel.leave();
      socket.disconnect();
    };
  }, [sport, page]);

  const groupedMatches = matches.reduce((acc, match) => {
    const league = match.cmp_name || "Unknown League";
    if (!acc[league]) {
      acc[league] = [];
    }
    acc[league].push(match);
    return acc;
  }, {});

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
    <div className="flex min-h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4">
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
        <div className="bg-gray-800 p-4 rounded-lg mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Live Matches - {sport}</h1>
          <span className="text-gray-400">Connected Users: {connectedUsers}</span>
        </div>
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
    </div>
  );
};

export default App;
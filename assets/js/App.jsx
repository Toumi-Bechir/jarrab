import React, { useState, useEffect } from 'react';
   import MatchList from './MatchList';

   const App = () => {
     const [matches, setMatches] = useState([]);

     useEffect(() => {
       const socket = new Phoenix.Socket("/socket", {});
       socket.connect();

       const channel = socket.channel("match:soccer");
       channel.join()
         .receive("ok", resp => {
           console.log("Joined match:soccer", resp);
           setMatches(resp.events || []);
         })
         .receive("error", resp => {
           console.error("Failed to join match:soccer", resp);
         });

       channel.on("batch_update", payload => {
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

       channel.on("event_removed", payload => {
         console.log("Received event removed", payload);
         setMatches(prevMatches => prevMatches.filter(match => match.id !== payload.event_id));
       });

       return () => {
         channel.leave();
         socket.disconnect();
       };
     }, []);

     return (
       <div className="container mx-auto p-4">
         <h1 className="text-3xl font-bold mb-4">Jarrab Matches</h1>
         <MatchList matches={matches} />
       </div>
     );
   };

   export default App;
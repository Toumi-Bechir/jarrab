import React from 'react';

   const MatchList = ({ matches }) => {
     return (
       <div className="grid gap-4">
         {matches.length === 0 ? (
           <p>No matches available.</p>
         ) : (
           matches.map(match => (
             <div key={match.id} className="p-4 bg-gray-100 rounded shadow">
               <h2 className="text-xl font-semibold">{match.id}</h2>
               <p>{match.message}</p>
             </div>
           ))
         )}
       </div>
     );
   };

   export default MatchList;
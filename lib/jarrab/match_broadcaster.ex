defmodule Jarrab.MatchBroadcaster do
    use GenServer
  
    @max_batch_size 1
    @batch_interval 10
  
    def start_link(_opts) do
      GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
    end
  
    @impl true
    def init(:ok) do
      {:ok, %{updates: [], last_broadcast: System.monotonic_time(:millisecond)}}
    end
  
    def broadcast_update(sport, event_id, event) do
      GenServer.cast(__MODULE__, {:queue_update, sport, event_id, event})
    end
  
    def broadcast_removed(sport, event_id) do
      JarrabWeb.Endpoint.broadcast("match:all", "event_removed", %{
        event_id: event_id
      })
    end
  
    @impl true
    def handle_cast({:queue_update, sport, event_id, event}, state) do
      new_updates = [{sport, event_id, event} | state.updates]
      if length(new_updates) >= @max_batch_size do
        broadcast_batch(new_updates)
        {:noreply, %{state | updates: [], last_broadcast: System.monotonic_time(:millisecond)}}
      else
        schedule_broadcast()
        {:noreply, %{state | updates: new_updates}}
      end
    end
  
    @impl true
    def handle_info(:broadcast_batch, state) do
      if state.updates != [] do
        broadcast_batch(state.updates)
        {:noreply, %{state | updates: [], last_broadcast: System.monotonic_time(:millisecond)}}
      else
        {:noreply, state}
      end
    end
  
    defp broadcast_batch(updates) do
      updates_by_sport = Enum.group_by(updates, fn {sport, _, _} -> sport end)
      Enum.each(updates_by_sport, fn {sport, sport_updates} ->
        payload = %{
          updates: Enum.map(sport_updates, fn {_, event_id, event} -> %{event_id: event_id, event: event} end)
        }
        JarrabWeb.Endpoint.broadcast("match:all", "batch_update", payload)
      end)
    end
  
    defp schedule_broadcast do
      Process.send_after(self(), :broadcast_batch, @batch_interval)
    end
  end
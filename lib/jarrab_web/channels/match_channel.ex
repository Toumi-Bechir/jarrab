defmodule JarrabWeb.MatchChannel do
  use Phoenix.Channel

  require Logger

  @impl true
  def join("match:all", _payload, socket) do
    send(self(), :after_join)
    user_id = socket.assigns[:user_id] || UUID.uuid4()
    socket = assign(socket, :user_id, user_id)
    Logger.info("Client joined match:all: user_id=#{user_id}")
    {:ok, %{}, socket}
  end

  def join("match:" <> _sport, _payload, _socket) do
    Logger.error("Attempted to join unsupported topic; only match:all is supported")
    {:error, %{reason: "unsupported topic; use match:all"}}
  end

  @impl true
  def handle_info(:after_join, socket) do
    case Jarrab.Presence.track(socket, socket.topic, %{
      online_at: System.os_time(:second),
      user_id: socket.assigns.user_id
    }) do
      {:ok, _} ->
        Logger.info("Presence tracked for user_id=#{socket.assigns.user_id} in topic=#{socket.topic}")
        presence_state = Jarrab.Presence.list(socket.topic)
        broadcast!(socket, "presence_state", presence_state)
      {:error, reason} ->
        Logger.error("Failed to track presence for user_id=#{socket.assigns.user_id} in topic=#{socket.topic}: #{inspect(reason)}")
    end

    # Broadcast cached shard data
    0..15
    |> Enum.each(fn shard ->
      events = get_cached_shard_data(shard)
      broadcast!(socket, "shard_data", %{shard: shard, events: events})
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_info({:presence_diff, diff}, socket) do
    broadcast!(socket, "presence_diff", diff)
    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", %{"message" => message}, socket) do
    {:reply, {:ok, %{response: "Server received: " <> message}}, socket}
  end

  @impl true
  def handle_in("get_event_count", _payload, socket) do
    total_events =
      0..15
      |> Enum.map(&get_cached_shard_data/1)
      |> Enum.reduce(0, fn events, acc -> acc + length(events) end)
    {:reply, {:ok, %{total_events: total_events}}, socket}
  end

  @impl true
  def handle_in("get_event", %{"event_id" => event_id}, socket) do
    event = Jarrab.EventData.get_event(event_id)
    {:reply, {:ok, %{event: event || %{id: event_id, message: "Not found"}}}, socket}
  end

  @impl true
  def handle_in("delete_event", %{"event_id" => event_id}, socket) do
    sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"]
    Enum.each(sports, fn sport ->
      Jarrab.EventData.delete_event(event_id, sport)
      Jarrab.MatchBroadcaster.broadcast_removed(sport, event_id)
    end)
    broadcast!(socket, "event_removed", %{event_id: event_id})
    # Update cache after deletion
    update_cache_after_deletion(event_id)
    {:reply, {:ok, %{status: "deleted"}}, socket}
  end

  def broadcast_update(sport, event_id, event) do
    Jarrab.MatchBroadcaster.broadcast_update(sport, event_id, event)
    # Update cache after update
    update_cache_after_update(event_id, event)
  end

  def broadcast_removed(sport, event_id) do
    Jarrab.MatchBroadcaster.broadcast_removed(sport, event_id)
    # Update cache after removal
    update_cache_after_deletion(event_id)
  end

  # Cache management functions

  defp get_cached_shard_data(shard) do
    case :ets.lookup(:jarrab_shard_cache, shard) do
      [{^shard, events}] -> events
      [] ->
        worker = :"Elixir.Jarrab.EventWorker-#{shard}"
        events = Jarrab.EventWorker.get_events(worker)
        :ets.insert(:jarrab_shard_cache, {shard, events})
        events
    end
  end

  defp update_cache_after_update(event_id, updated_event) do
    0..15
    |> Enum.each(fn shard ->
      case :ets.lookup(:jarrab_shard_cache, shard) do
        [{^shard, events}] ->
          updated_events = Enum.map(events, fn event ->
            if event.id == event_id, do: updated_event, else: event
          end)
          :ets.insert(:jarrab_shard_cache, {shard, updated_events})
        [] ->
          :ok
      end
    end)
  end

  defp update_cache_after_deletion(event_id) do
    0..15
    |> Enum.each(fn shard ->
      case :ets.lookup(:jarrab_shard_cache, shard) do
        [{^shard, events}] ->
          updated_events = Enum.filter(events, fn event -> event.id != event_id end)
          :ets.insert(:jarrab_shard_cache, {shard, updated_events})
        [] ->
          :ok
      end
    end)
  end
end
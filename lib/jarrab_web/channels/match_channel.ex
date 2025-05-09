defmodule JarrabWeb.MatchChannel do
    use Phoenix.Channel
  
    require Logger
  
    @page_size 50  # Number of matches per page
  
    @impl true
    def join("match:" <> sport, %{"page" => page} = payload, socket) do
      send(self(), :after_join)
      page = String.to_integer(page)
      # Fetch paginated events for the sport
      events = Jarrab.EventData.get_all_events(sport)
      total_events = length(events)
      total_pages = max(1, div(total_events + @page_size - 1, @page_size))
      paginated_events = Enum.slice(events, (page - 1) * @page_size, @page_size)
  
      Logger.info("Client joined match:#{sport}: user_id=#{socket.assigns.user_id}, page=#{page}")
      {:ok, %{events: paginated_events, total_pages: total_pages}, assign(socket, :sport, sport)}
    end
  
    def join("match:" <> sport, _payload, socket) do
      join("match:" <> sport, %{"page" => "1"}, socket)
    end
  
    @impl true
    def handle_info(:after_join, socket) do
      case Jarrab.Presence.track(socket, socket.topic, %{
        online_at: System.os_time(:second),
        user_id: socket.assigns.user_id
      }) do
        {:ok, _} ->
          Logger.info("Presence tracked for user_id=#{socket.assigns.user_id} in topic=#{socket.topic}")
          # Broadcast presence update to all clients in the channel
          presence_state = Jarrab.Presence.list(socket.topic)
          broadcast!(socket, "presence_state", presence_state)
        {:error, reason} ->
          Logger.error("Failed to track presence for user_id=#{socket.assigns.user_id} in topic=#{socket.topic}: #{inspect(reason)}")
      end
      {:noreply, socket}
    end
  
    @impl true
    def handle_info({:presence_diff, diff}, socket) do
      # Broadcast presence updates (joins/leaves) to clients
      broadcast!(socket, "presence_diff", diff)
      {:noreply, socket}
    end
  
    @impl true
    def handle_in("ping", %{"message" => message}, socket) do
      {:reply, {:ok, %{response: "Server received: " <> message}}, socket}
    end
  
    @impl true
    def handle_in("get_event", %{"event_id" => event_id}, socket) do
      event = Jarrab.EventData.get_event(event_id)
      {:reply, {:ok, %{event: event || %{id: event_id, message: "Not found"}}}, socket}
    end
  
    @impl true
    def handle_in("delete_event", %{"event_id" => event_id}, socket) do
      sport = socket.assigns.sport
      Jarrab.EventData.delete_event(event_id, sport)
      Jarrab.MatchBroadcaster.broadcast_removed(sport, event_id)
      {:reply, {:ok, %{status: "deleted"}}, socket}
    end
  
    def broadcast_update(sport, event_id, event) do
      Jarrab.MatchBroadcaster.broadcast_update(sport, event_id, event)
    end
  
    def broadcast_removed(sport, event_id) do
      Jarrab.MatchBroadcaster.broadcast_removed(sport, event_id)
    end
  end
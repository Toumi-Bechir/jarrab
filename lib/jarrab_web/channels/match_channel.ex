defmodule JarrabWeb.MatchChannel do
    use Phoenix.Channel
  
    require Logger
  
    @impl true
    def join("match:" <> sport, %{"page" => page} = payload, socket) do
      send(self(), :after_join)
      page = String.to_integer(page)
      # Placeholder for event data; replace with ETS or mock data
      events = []
      paginated_events = Enum.slice(events, (page - 1) * 100, 100)
      total_pages = 1
      Logger.info("Client joined match:#{sport}: user_id=#{socket.assigns.user_id}")
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
        {:error, reason} ->
          Logger.error("Failed to track presence for user_id=#{socket.assigns.user_id} in topic=#{socket.topic}: #{inspect(reason)}")
      end
      {:noreply, socket}
    end
  
    @impl true
    def handle_in("ping", %{"message" => message}, socket) do
      {:reply, {:ok, %{response: "Server received: " <> message}}, socket}
    end
  
    @impl true
    def handle_in("get_event", %{"event_id" => event_id}, socket) do
      event = %{id: event_id, message: "Mock event"}
      {:reply, {:ok, %{event: event}}, socket}
    end
  
    @impl true
    def handle_in("delete_event", %{"event_id" => event_id}, socket) do
      sport = socket.assigns.sport
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
defmodule JarrabWeb.RoomChannel do
    use Phoenix.Channel
  
    require Logger
  
    @impl true
    def join("room:lobby", _payload, socket) do
      send(self(), :after_join)
      Logger.info("Client joined room:lobby: user_id=#{socket.assigns.user_id}")
      {:ok, socket}
    end
  
    @impl true
    def join("room:" <> _private_room_id, _params, _socket) do
      {:error, %{reason: "unauthorized"}}
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
  end
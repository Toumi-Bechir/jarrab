defmodule JarrabWeb.UserSocket do
    use Phoenix.Socket

    require Logger

    channel "room:*", JarrabWeb.RoomChannel
    channel "match:*", JarrabWeb.MatchChannel

    @impl true
    def connect(params, socket, _connect_info) do
      user_id = params["user_id"] || "anonymous_#{:erlang.unique_integer()}"
      socket = assign(socket, :user_id, user_id)
      Logger.info("UserSocket connected: user_id=#{user_id}")
      {:ok, socket}
    end

    @impl true
    def id(socket) do
      client_id = "user_socket:#{socket.assigns.user_id}"
      Logger.info("UserSocket id: #{client_id}")
      client_id
    end
  end
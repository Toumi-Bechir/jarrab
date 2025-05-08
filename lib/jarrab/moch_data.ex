defmodule Jarrab.MockData do
    def send_mock_update(sport, event_id) do
      event = %{id: event_id, message: "Mock update at #{DateTime.utc_now()}"}
      JarrabWeb.MatchChannel.broadcast_update(sport, event_id, event)
    end
  end
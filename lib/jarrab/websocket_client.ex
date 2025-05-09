
defmodule Jarrab.WebSocketClient do
  use WebSockex

  @base_websocket_url "ws://152.89.28.69:8765"
  @num_shards 16

  def start_link(sport, retries \\ 3, simulate \\ false) do
    #token = if simulate, do: "mock_token", else: Jarrab.TokenFetcher.get_token()
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1biI6InRiZWNoaXIiLCJuYmYiOjE3NDY3NTYwMjIsImV4cCI6MTc0Njc1OTYyMiwiaWF0IjoxNzQ2NzU2MDIyfQ.Z4VexmvFtVEHbP0O_10JjAsLI6WHtMwDak-oP8DZ4-c"
    unless token do
      IO.puts("No token available for sport #{sport}. Cannot start WebSocketClient.")
      {:error, :no_token}
    else
      IO.puts("Using token for sport #{sport}: #{token}")
      sport = if sport == "basketball", do: "basket", else: sport
      websocket_url = "#{@base_websocket_url}/ws/#{sport}?tkn=#{token}"
      headers = []

      IO.puts("Attempting to connect to WebSocket for sport #{sport}: #{websocket_url}")
      if simulate do
        simulate_matches(sport)
        {:ok, nil}
      else
        case WebSockex.start_link(websocket_url, __MODULE__, %{sport: sport}, extra_headers: headers, name: via_tuple(sport)) do
          {:ok, pid} ->
            {:ok, pid}
          {:error, %WebSockex.RequestError{code: 401} = reason} when retries > 0 ->
            IO.puts("Failed to start WebSocketClient for sport #{sport}: #{inspect(reason)}. Retrying (#{retries} attempts left)...")
            Process.sleep(5_000)
            start_link(sport, retries - 1)
          {:error, reason} ->
            IO.puts("Failed to start WebSocketClient for sport #{sport}: #{inspect(reason)}")
            try_alternative_connection(sport, token, retries)
        end
      end
    end
  end

  defp try_alternative_connection(sport, token, retries) do
    sport = if sport == "basketball", do: "basket", else: sport
    websocket_url = "#{@base_websocket_url}/#{sport}"
    headers = [
      {"Authorization", "Bearer #{token}"}
    ]

    IO.puts("Retrying with alternative method for sport #{sport}: #{websocket_url} (Authorization header)")
    case WebSockex.start_link(websocket_url, __MODULE__, %{sport: sport}, extra_headers: headers, name: via_tuple(sport)) do
      {:ok, pid} ->
        {:ok, pid}
      {:error, %WebSockex.RequestError{code: 401} = reason} when retries > 0 ->
        IO.puts("Failed to start WebSocketClient for sport #{sport}: #{inspect(reason)}. Retrying (#{retries} attempts left)...")
        Process.sleep(5_000)
        start_link(sport, retries - 1)
      {:error, reason} ->
        IO.puts("Failed to start WebSocketClient for sport #{sport}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  def handle_connect(_conn, state) do
    IO.puts("WebSocket connected for sport: #{state.sport}")
    schedule_ping()
    {:ok, state}
  end

  def handle_frame({:text, msg}, state) do
    case Jason.decode(msg) do
      {:ok, message} ->
        sport = Map.get(message, "sp")
        normalized_sport = if sport == "basketball", do: "basket", else: sport
        message_with_sport = Map.put(message, "sport", normalized_sport)
        IO.puts("Received WebSocket message for sport #{state.sport}: #{inspect(message_with_sport, pretty: true)}")
        handle_message(message_with_sport)
        {:ok, state}
      {:error, reason} ->
        IO.puts("Failed to decode WebSocket message for sport #{state.sport}: #{inspect(reason)}")
        {:ok, state}
    end
  end

  def handle_frame({:binary, _msg}, state) do
    IO.puts("Received unexpected binary frame for sport: #{state.sport}")
    {:ok, state}
  end

  def handle_disconnect(%{reason: reason}, state) do
    IO.puts("WebSocket disconnected for sport #{state.sport}: #{inspect(reason)}")
    {:reconnect, state}
  end

  def handle_info(:ping, state) do
    IO.puts("Sending ping for sport #{state.sport}")
    schedule_ping()
    {:ok, state}
  end

  def handle_info(message, state) do
    IO.puts("Received unexpected message for sport #{state.sport}: #{inspect(message)}")
    {:ok, state}
  end

  defp handle_message(%{"mt" => "avl", "evts" => events, "sport" => sport} = _message) do
    IO.puts("Processing avl message with #{length(events)} events for sport #{sport}")

    # Extract event IDs from the avl message
    avl_event_ids = Enum.map(events, & &1["id"]) |> MapSet.new()

    # Fetch current events from ETS for this sport
    ets_events = fetch_ets_events(sport)

    # Identify finished events (in ETS but not in avl)
    ets_event_ids = Enum.map(ets_events, & &1["id"]) |> MapSet.new()
    finished_event_ids = MapSet.difference(ets_event_ids, avl_event_ids)

    # Delete finished events
    Enum.each(finished_event_ids, fn event_id ->
      IO.puts("Deleting finished event #{event_id} for sport #{sport}")
      delete_event(event_id, sport)
      Phoenix.PubSub.broadcast(Jarrab.PubSub, "sports:events:#{sport}", {:event_removed, event_id})
    end)

    # Identify new events (in avl but not in ETS)
    new_event_ids = MapSet.difference(avl_event_ids, ets_event_ids)
    IO.puts("Found #{MapSet.size(new_event_ids)} new events for sport #{sport}")

    # Only insert new events
    Enum.each(events, fn event ->
      event_id = event["id"]
      if MapSet.member?(new_event_ids, event_id) do
        event_with_sport = Map.put(event, "sport", sport)
        Jarrab.MessageProducer.add_message(event_id, %{"mt" => "avl", "evts" => [event_with_sport]})
      end
    end)
  end

  defp handle_message(%{"mt" => "updt", "id" => event_id, "sport" => sport} = message) do
    message_with_sport = Map.put(message, "sport", sport)
    Jarrab.MessageProducer.add_message(event_id, message_with_sport)
  end

  defp handle_message(message) do
    :ok
  end

  defp fetch_ets_events(sport) do
    try do
      Jarrab.EventData.get_all_events(sport)
      |> Enum.map(fn event ->
        Map.put_new(event, "id", event["id"] || "unknown")
      end)
    rescue
      _ ->
        try do
          table_names = Enum.map(0..(@num_shards - 1), fn shard -> :"events_shard_#{shard}_#{sport}" end)
          IO.inspect(table_names, label: "Trying ETS Tables for Fetch")
          fetch_from_ets_table(table_names)
        rescue
          _ ->
            []
        end
    end
  end

  defp fetch_from_ets_table([]), do: []
  defp fetch_from_ets_table([table_name | rest]) do
    try do
      case :ets.lookup(table_name, :all) do
        [] ->
          fetch_from_ets_table(rest)
        [{_, events}] when is_list(events) ->
          events
        _ ->
          :ets.match_object(table_name, {:"$1", :"$2"})
          |> Enum.map(fn {key, value} -> Map.put(value, "id", key) end)
      end
    rescue
      _ ->
        fetch_from_ets_table(rest)
    end
  end

  defp delete_event(event_id, sport) do
    IO.puts("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++Deleting event #{event_id} for sport #{sport}")
    try do
      if function_exported?(Jarrab.EventData, :delete_event, 2) do
        IO.puts("Deleting via Jarrab.EventData.delete_event/2")
        Jarrab.EventData.delete_event(event_id, sport)
      else
        delete_from_ets_table(event_id, sport)
      end
    rescue
      e ->
        IO.puts("Error in delete_event (via Jarrab.EventData): #{inspect(e)}")
        delete_from_ets_table(event_id, sport)
    end
  end

  defp delete_from_ets_table(event_id, sport) do
    shard = shard_for_event(event_id)
    table_name = :"events_shard_#{shard}_#{sport}"

    try do
      IO.puts("Deleting event_id: #{event_id} from table: #{table_name}")
      :ets.delete(table_name, event_id)
      IO.puts("Successfully deleted event_id: #{event_id} from table: #{table_name}")
    rescue
      e ->
        IO.puts("Failed to delete event_id: #{event_id} from table: #{table_name}, error: #{inspect(e)}")
        IO.puts("Falling back to trying all shards for sport: #{sport}")
        Enum.each(0..(@num_shards - 1), fn s ->
          fallback_table = :"events_shard_#{s}_#{sport}"
          try do
            case :ets.lookup(fallback_table, event_id) do
              [] ->
                :ok
              [_] ->
                IO.puts("Found event_id: #{event_id} in table: #{fallback_table}, deleting")
                :ets.delete(fallback_table, event_id)
                IO.puts("Successfully deleted event_id: #{event_id} from table: #{fallback_table}")
              _ ->
                :ok
            end
          rescue
            e ->
              IO.puts("Failed to delete event_id: #{event_id} from table: #{fallback_table}, error: #{inspect(e)}")
              :ok
          end
        end)
    end
  end

  defp shard_for_event(event_id) do
    :erlang.phash2(event_id, @num_shards)
  end

  defp via_tuple(sport) do
    {:via, Registry, {Jarrab.WebSocketRegistry, sport}}
  end

  defp schedule_ping do
    Process.send_after(self(), :ping, 30_000)
  end

  defp simulate_matches(sport) do
    # Simulate 1,700 matches with detailed data
    events = Enum.map(1..1700, fn i ->
      %{
        "id" => "match_#{sport}_#{i}",
        "sport" => sport,
        "cmp_name" => "League #{div(i, 100) + 1}",
        "team1" => "Team A#{i}",
        "team2" => "Team B#{i}",
        "score" => "#{Enum.random(0..3)} - #{Enum.random(0..3)}",
        "match_time" => "#{Enum.random(1..90)}:00",
        "yellow_cards" => %{"team1" => Enum.random(0..2), "team2" => Enum.random(0..2)},
        "red_cards" => %{"team1" => Enum.random(0..1), "team2" => Enum.random(0..1)}
      }
    end)

    # Send an "avl" message with all events
    message = %{"mt" => "avl", "evts" => events, "sport" => sport}
    handle_message(message)

    # Simulate periodic updates for a subset of matches
    Enum.each(1..10, fn _ ->
      Process.sleep(5_000) # Simulate updates every 5 seconds
      random_match_id = "match_#{sport}_#{Enum.random(1..1700)}"
      update_message = %{
        "mt" => "updt",
        "id" => random_match_id,
        "sport" => sport,
        "score" => "#{Enum.random(0..3)} - #{Enum.random(0..3)}",
        "match_time" => "#{Enum.random(1..90)}:00"
      }
      handle_message(update_message)
    end)
  end
end
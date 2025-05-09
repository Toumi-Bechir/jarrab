defmodule Jarrab.EventWorker do
  use GenServer
  alias JarrabWeb.MatchChannel

  @pubsub_topic "sports:events"
  @num_shards 16
  @batch_interval 500
  @cleanup_interval :timer.minutes(5)

  def start_link(shard) do
    GenServer.start_link(__MODULE__, shard, name: via_tuple(shard))
  end

  def process_message(event_id, message) do
    shard = shard_for_event(event_id)
    case :pg.get_members(Jarrab.EventWorkerGroup, shard) do
      [] ->
        Jarrab.EventWorkerSupervisor.start_worker(shard)
        GenServer.cast(via_tuple(shard), {:process_message, event_id, message})
      pids ->
        pid = Enum.random(pids)
        GenServer.cast(pid, {:process_message, event_id, message})
    end
  end

  def get_events(shard, sport \\ nil) do
    case :pg.get_members(Jarrab.EventWorkerGroup, shard) do
      [] ->
        Jarrab.EventWorkerSupervisor.start_worker(shard)
        GenServer.call(via_tuple(shard), {:get_events, sport})
      [pid | _] ->
        GenServer.call(pid, {:get_events, sport})
    end
  end

  def get_event(shard, event_id) do
    case :pg.get_members(Jarrab.EventWorkerGroup, shard) do
      [] ->
        Jarrab.EventWorkerSupervisor.start_worker(shard)
        GenServer.call(via_tuple(shard), {:get_event, event_id})
      [pid | _] ->
        GenServer.call(pid, {:get_event, event_id})
    end
  end

  def delete_event(event_id, sport) do
    shard = shard_for_event(event_id)
    case :pg.get_members(Jarrab.EventWorkerGroup, shard) do
      [] ->
        {:error, :no_worker}
      [pid | _] ->
        GenServer.call(pid, {:delete_event, event_id, sport})
    end
  end

  def init(shard) do
    :pg.join(Jarrab.EventWorkerGroup, shard, self())
    ets_tables = %{}
    schedule_batch_broadcast()
    schedule_cleanup()
    {:ok, %{shard: shard, ets_tables: ets_tables, updates: %{}, pending_updates: %{}, last_updated: %{}, initialized: %{}, available_event_ids: %{}}}
  end

  def handle_cast({:process_message, event_id, message}, state) do
    start_time = System.monotonic_time()
    %{shard: shard, ets_tables: ets_tables, updates: updates, pending_updates: pending_updates, last_updated: last_updated, initialized: initialized, available_event_ids: available_event_ids} = state

    sport = case message do
      %{"mt" => "avl"} -> nil
      %{"mt" => "updt"} -> Map.get(message, "sport", "unknown")
      _ -> "unknown"
    end

    case message do
      %{"mt" => "avl"} ->
        leagues = Map.delete(message, "mt")
        new_available_event_ids = Enum.reduce(leagues, available_event_ids, fn {league, events}, acc ->
          sport = events |> List.first() |> Map.get("sport", "unknown")
          new_event_ids = events |> Enum.map(& &1["id"]) |> MapSet.new()
          current_event_ids = Map.get(acc, sport, MapSet.new())
          updated_event_ids = MapSet.union(current_event_ids, new_event_ids)
          Map.put(acc, sport, updated_event_ids)
        end)

        league_and_event = Enum.reduce_while(leagues, nil, fn {league_key, events}, _acc ->
          league = if league_key == "evts" do
            case List.first(events) do
              %{"cmp_name" => cmp_name} -> cmp_name
              _ -> "Unknown League"
            end
          else
            league_key
          end

          case Enum.find(events, fn e -> e["id"] == event_id end) do
            nil -> {:cont, nil}
            event -> {:halt, {league, event}}
          end
        end)

        if league_and_event do
          {league, event} = league_and_event
          sport = Map.get(event, "sport", "unknown")
          ets_table = ensure_ets_table(sport, shard, ets_tables)

          updated_event = event
                          |> Map.put("sport", sport)
                          |> Map.put("cmp_name", league)

          :ets.insert(ets_table, {event_id, updated_event})

          new_initialized = Map.put(initialized, {sport, event_id}, true)

          new_pending_updates = case Map.get(pending_updates, {sport, event_id}) do
            nil -> pending_updates
            pending_message ->
              merged_event = Map.merge(updated_event, pending_message)
              :ets.insert(ets_table, {event_id, merged_event})
              Map.delete(pending_updates, {sport, event_id})
          end

          new_updates = Map.put(updates, {sport, event_id}, updated_event)

          current_time = System.monotonic_time(:millisecond)
          updated_last_updated = Map.put(last_updated, {sport, event_id}, current_time)

          new_state = %{
            state |
            ets_tables: Map.put(ets_tables, sport, ets_table),
            updates: new_updates,
            pending_updates: new_pending_updates,
            last_updated: updated_last_updated,
            initialized: new_initialized,
            available_event_ids: new_available_event_ids
          }
          {:noreply, new_state}
        else
          {:noreply, %{state | available_event_ids: new_available_event_ids}}
        end

      %{"mt" => "updt"} ->
        sport = find_event_sport(ets_tables, event_id) || sport
        ets_table = ensure_ets_table(sport, shard, ets_tables)

        case :ets.lookup(ets_table, event_id) do
          [{^event_id, existing_event}] ->
            updated_event = Map.merge(existing_event, message)
                           |> Map.put("sport", sport)
                           |> ensure_cmp_name(existing_event)
            :ets.insert(ets_table, {event_id, updated_event})

            current_time = System.monotonic_time(:millisecond)
            updated_last_updated = Map.put(last_updated, {sport, event_id}, current_time)

            new_updates = Map.put(updates, {sport, event_id}, updated_event)

            new_state = %{
              state |
              ets_tables: Map.put(ets_tables, sport, ets_table),
              updates: new_updates,
              last_updated: updated_last_updated
            }
            {:noreply, new_state}
          [] ->
            new_pending_updates = Map.put(pending_updates, {sport, event_id}, message)

            current_time = System.monotonic_time(:millisecond)
            updated_last_updated = Map.put(last_updated, {sport, event_id}, current_time)

            new_state = %{
              state |
              ets_tables: Map.put(ets_tables, sport, ets_table),
              pending_updates: new_pending_updates,
              last_updated: updated_last_updated
            }
            {:noreply, new_state}
        end
    end
  end

  def handle_call({:get_events, sport}, _from, state) do
    %{ets_tables: ets_tables} = state
    events = if sport do
      ets_table = Map.get(ets_tables, sport)
      if ets_table, do: :ets.tab2list(ets_table) |> Enum.map(fn {_, event} -> event end), else: []
    else
      ets_tables
      |> Map.values()
      |> Enum.flat_map(fn ets_table ->
        :ets.tab2list(ets_table) |> Enum.map(fn {_, event} -> event end)
      end)
    end
    {:reply, events, state}
  end

  def handle_call({:get_event, event_id}, _from, state) do
    %{ets_tables: ets_tables} = state
    event = Enum.reduce_while(ets_tables, nil, fn {sport, ets_table}, acc ->
      case :ets.lookup(ets_table, event_id) do
        [{^event_id, event}] -> {:halt, event}
        [] -> {:cont, acc}
      end
    end)
    {:reply, event, state}
  end

  def handle_call({:delete_event, event_id, sport}, _from, state) do
    %{ets_tables: ets_tables} = state
    case Map.get(ets_tables, sport) do
      nil -> {:reply, {:error, :no_table}, state}
      ets_table ->
        :ets.delete(ets_table, event_id)
        {:reply, :ok, state}
    end
  end

  def handle_info(:broadcast_batch, state) do
    start_time = System.monotonic_time()
    %{updates: updates, initialized: initialized} = state

    Enum.each(updates, fn {{sport, event_id}, event} ->
      if Map.get(initialized, {sport, event_id}, false) do
        MatchChannel.broadcast_update(sport, event_id, event)
      end
    end)

    duration = System.monotonic_time() - start_time
    :telemetry.execute([:sports_info, :batch_broadcast], %{duration: duration}, %{count: map_size(updates)})

    schedule_batch_broadcast()
    {:noreply, %{state | updates: %{}}}
  end

  def handle_info(:cleanup, state) do
    %{ets_tables: ets_tables, last_updated: last_updated, available_event_ids: available_event_ids} = state

    updated_last_updated = Enum.reduce(ets_tables, last_updated, fn {sport, ets_table}, acc ->
      current_event_ids = :ets.tab2list(ets_table)
                          |> Enum.map(fn {event_id, _} -> event_id end)
                          |> MapSet.new()

      avl_event_ids = Map.get(available_event_ids, sport, MapSet.new())

      events_to_remove = MapSet.difference(current_event_ids, avl_event_ids)

      Enum.each(events_to_remove, fn event_id ->
        :ets.delete(ets_table, event_id)
        MatchChannel.broadcast_removed(sport, event_id)
      end)

      Map.drop(acc, Enum.map(events_to_remove, fn event_id -> {sport, event_id} end))
    end)

    schedule_cleanup()
    {:noreply, %{state | last_updated: updated_last_updated, available_event_ids: %{}}}
  end

  def terminate(_reason, state) do
    %{shard: shard, ets_tables: ets_tables} = state
    :pg.leave(Jarrab.EventWorkerGroup, shard, self())

    Enum.each(ets_tables, fn {sport, table} ->
      :ets.delete(table)
    end)

    :ok
  end

  defp via_tuple(shard) do
    {:global, {:event_worker, shard}}
  end

  defp shard_for_event(event_id) do
    :erlang.phash2(event_id, @num_shards)
  end

  defp schedule_batch_broadcast do
    Process.send_after(self(), :broadcast_batch, @batch_interval)
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @cleanup_interval)
  end

  defp ensure_ets_table(sport, shard, ets_tables) do
    case Map.get(ets_tables, sport) do
      nil ->
        table_name = :"events_shard_#{shard}_#{sport}"
        case :ets.whereis(table_name) do
          :undefined ->
            table = :ets.new(table_name, [:set, :public, :named_table, :compressed, read_concurrency: true, write_concurrency: true])
            table
          table ->
            :ets.setopts(table, {:heir, self(), nil})
            table
        end
      table ->
        table
    end
  end

  defp ensure_cmp_name(updated_event, existing_event) do
    case Map.get(updated_event, "cmp_name") do
      nil ->
        cmp_name = Map.get(existing_event, "cmp_name", "Unknown League")
        Map.put(updated_event, "cmp_name", cmp_name)
      _ ->
        updated_event
    end
  end

  defp find_event_sport(ets_tables, event_id) do
    Enum.reduce_while(ets_tables, nil, fn {sport, ets_table}, acc ->
      case :ets.lookup(ets_table, event_id) do
        [{^event_id, _event}] -> {:halt, sport}
        [] -> {:cont, acc}
      end
    end)
  end
end
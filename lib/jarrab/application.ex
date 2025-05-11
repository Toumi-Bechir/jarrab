defmodule Jarrab.Application do
  @moduledoc false

  use Application
  
  # Add the missing module attribute for number of shards
  @num_shards 16

  @impl true
  def start(_type, _args) do
    # Create ETS table for shard cache
    :ets.new(:jarrab_shard_cache, [:set, :public, :named_table])
    :pg.start_link()
    
    children = [
      {Phoenix.PubSub, name: Jarrab.PubSub},
      {Jarrab.Presence, name: Jarrab.Presence},
      Jarrab.MatchBroadcaster,
      #Jarrab.TokenFetcher,
      {Registry, keys: :unique, name: Jarrab.WebSocketRegistry},
      {DynamicSupervisor, strategy: :one_for_one, name: Jarrab.WebSocketSupervisor},
      Jarrab.MessageProducer,
      {DynamicSupervisor, strategy: :one_for_one, name: Jarrab.MessageConsumerSupervisor},
      {DynamicSupervisor, strategy: :one_for_one, name: Jarrab.EventWorkerSupervisor},
      JarrabWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Jarrab.Supervisor]
    case Supervisor.start_link(children, opts) do
      {:ok, pid} ->
        start_websocket_clients()
        start_message_consumers()
        start_event_workers()
        {:ok, pid}
      error ->
        error
    end
  end

  @impl true
  def config_change(changed, _new, removed) do
    JarrabWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp start_websocket_clients do
    sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"]
    Enum.each(sports, fn sport ->
      case Jarrab.WebSocketSupervisor.start_websocket_client(sport) do
        {:ok, _pid} -> :ok
        {:error, reason} -> raise "Failed to start WebSocketClient for sport #{sport}: #{inspect(reason)}"
      end
    end)
  end

  defp start_message_consumers do
    num_consumers = 10
    Enum.each(1..num_consumers, fn _ ->
      case DynamicSupervisor.start_child( Jarrab.MessageConsumerSupervisor, Jarrab.MessageConsumer) do
        {:ok, _pid} -> :ok
        {:error, reason} -> raise "Failed to start MessageConsumer: #{inspect(reason)}"
      end
    end)
  end

  defp start_event_workers do
    {:ok, _pid} = :pg.start_link( Jarrab.EventWorkerGroup)

    Enum.each(0..(@num_shards - 1), fn shard ->
      case Jarrab.EventWorkerSupervisor.start_worker(shard) do
        {:ok, _pid} ->
          :ok
        {:error, {:already_started, pid}} ->
          :ok
        {:error, reason} ->
          raise "Failed to start EventWorker for shard #{shard}: #{inspect(reason)}"
      end
    end)
  end
end
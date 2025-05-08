defmodule Jarrab.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: Jarrab.PubSub},
      {Jarrab.Presence, name: Jarrab.Presence},
      Jarrab.MatchBroadcaster,
      JarrabWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Jarrab.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    JarrabWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
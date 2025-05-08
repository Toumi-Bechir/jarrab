defmodule Jarrab.Presence do
    use Phoenix.Presence,
      otp_app: :jarrab,
      pubsub_server: Jarrab.PubSub
  end
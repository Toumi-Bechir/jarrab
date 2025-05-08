defmodule JarrabWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :jarrab

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_jarrab_key",
    signing_salt: "your_signing_salt",
    same_site: "Lax"
  ]

  # Socket handler for WebSocket connections
  socket "/socket", JarrabWeb.UserSocket,
    websocket: [
      # Increase timeout for debugging
      timeout: 45_000
    ],
    longpoll: false

  plug Plug.Static,
    at: "/",
    from: :jarrab,
    gzip: false,
    only: ~w(assets fonts images favicon.ico robots.txt)

  if code_reloading? do
    plug Phoenix.CodeReloader
  end

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug JarrabWeb.Router
end

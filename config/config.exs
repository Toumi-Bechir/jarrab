import Config

config :jarrab,
  generators: [timestamp_type: :utc_datetime]

config :jarrab, JarrabWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: JarrabWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Jarrab.PubSub

config :esbuild,
  version: "0.17.11",
  jarrab: [
    args:
      ~w(js/app.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/* --loader:.js=jsx),
    cd: Path.expand("../assets", __DIR__),
    env: %{
      "NODE_PATH" => Path.expand("../assets/node_modules", __DIR__)
    }
  ]

config :tailwind,
  version: "3.4.3",
  jarrab: [
    args: ~w(
      --config=tailwind.config.js
      --input=css/app.css
      --output=../priv/static/assets/app.css
    ),
    cd: Path.expand("../assets", __DIR__)
  ]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
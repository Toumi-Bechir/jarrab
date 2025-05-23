defmodule JarrabWeb.Router do
  use Phoenix.Router

  import Plug.Conn
  import Phoenix.Controller

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_flash
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", JarrabWeb do
    pipe_through :browser

    get "/", PageController, :index
    get "/channel_test", PageController, :channel_test
    get "/*path", PageController, :index
  end
end
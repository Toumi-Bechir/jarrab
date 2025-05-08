defmodule JarrabWeb.PageController do
  use Phoenix.Controller, namespace: JarrabWeb

  def index(conn, _params) do
    render(conn, "index.html")
  end

  def channel_test(conn, _params) do
    render(conn, "channel_test.html")
  end
end
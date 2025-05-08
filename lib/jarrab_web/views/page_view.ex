defmodule JarrabWeb.PageView do
  use Phoenix.View,
    root: "lib/jarrab_web/templates",
    namespace: JarrabWeb

  # Import HTML helpers
  import Phoenix.HTML
  import Phoenix.HTML.Form
  use PhoenixHTMLHelpers
  
  # Import only what we need from Controller
  import Phoenix.Controller, only: [get_csrf_token: 0]

  # Import Gettext module for translations
  import JarrabWeb.Gettext
  
  # Import Router helpers
  alias JarrabWeb.Router.Helpers, as: Routes
end
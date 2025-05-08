defmodule JarrabWeb.LayoutView do
  use Phoenix.View,
    root: "lib/jarrab_web/templates",
    namespace: JarrabWeb

  # Import HTML helpers
  import Phoenix.HTML
  import Phoenix.HTML.Form
  use PhoenixHTMLHelpers
  
  # Import basic functionality
  import Phoenix.Controller,
    only: [get_flash: 1, get_flash: 2, view_module: 1, view_template: 1]
  
  # Import other helper modules
  import JarrabWeb.ErrorHelpers
  import JarrabWeb.Gettext
  alias JarrabWeb.Router.Helpers, as: Routes
end
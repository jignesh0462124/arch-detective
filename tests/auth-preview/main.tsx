import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthPage, Route as LoginRoute } from "../../src/routes/login";
import { ResetPasswordPage } from "../../src/routes/reset-password";
import { AuthProvider } from "../../src/components/auth/AuthProvider";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { AccountMenu } from "../../src/components/auth/AccountMenu";
import { useAuth } from "../../src/hooks/useAuth";
import "../../src/styles.css";
const options = new URLSearchParams(location.search);
document.documentElement.dataset.theme = options.get("theme") || "light";
localStorage.setItem("archon-theme", options.get("theme") || "light");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const root = createRootRoute({
  component: () => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  ),
});
function Private() {
  const { status, user } = useAuth();
  return (
    <RequireAuth>
      <main className="bg-background p-6 text-foreground">
        <AccountMenu />
        <h1>Private workspace</h1>
        <p>
          {status} / {user?.id}
        </p>
      </main>
    </RequireAuth>
  );
}
const login = createRoute({
  getParentRoute: () => root,
  path: "/login",
  validateSearch: LoginRoute.options.validateSearch,
  component: AuthPage,
});
const reset = createRoute({
  getParentRoute: () => root,
  path: "/reset-password",
  component: ResetPasswordPage,
});
const dashboard = createRoute({
  getParentRoute: () => root,
  path: "/dashboard",
  component: Private,
});
const workspace = createRoute({
  getParentRoute: () => root,
  path: "/workspace",
  component: Private,
});
const start =
  options.get("page") === "reset"
    ? "/reset-password"
    : options.get("page") === "private"
      ? "/workspace"
      : "/login";
const router = createRouter({
  routeTree: root.addChildren([login, reset, dashboard, workspace]),
  history: createMemoryHistory({ initialEntries: [start] }),
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

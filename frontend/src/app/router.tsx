import { useMemo } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { paths } from "@/config/paths";
import DashboardRoute from "@/app/routes/dashboard";
import NotFoundRoute from "@/app/routes/not-found";

function createAppRouter() {
  return createBrowserRouter([
    { path: paths.home.path, element: <DashboardRoute /> },
    { path: "*", element: <NotFoundRoute /> },
  ]);
}

export function AppRouter() {
  const router = useMemo(createAppRouter, []);
  return <RouterProvider router={router} />;
}

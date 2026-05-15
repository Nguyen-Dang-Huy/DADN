import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Automation } from "./components/Automation";
import { History } from "./components/History";
import { Login } from "./components/Login";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { 
        index: true, 
        Component: () => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ) 
      },
      { 
        path: "automation", 
        Component: () => (
          <ProtectedRoute>
            <Automation />
          </ProtectedRoute>
        )
      },
      { 
        path: "history", 
        Component: () => (
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        )
      },
    ],
  },
]);
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Rooms } from "./components/Rooms";
import { Automation } from "./components/Automation";
import { History } from "./components/History";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "rooms", Component: Rooms },
      { path: "automation", Component: Automation },
      { path: "history", Component: History },
    ],
  },
]);

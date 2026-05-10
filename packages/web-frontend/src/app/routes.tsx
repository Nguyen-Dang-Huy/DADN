import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
// Xóa dòng import Rooms
import { Automation } from "./components/Automation";
import { History } from "./components/History";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      // Đã xóa { path: "rooms", Component: Rooms }
      { path: "automation", Component: Automation },
      { path: "history", Component: History },
    ],
  },
]);
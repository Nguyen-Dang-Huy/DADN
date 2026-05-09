import { Link, Outlet, useLocation } from "react-router";
import { Home, DoorOpen, Zap, Workflow, Clock, Settings, HelpCircle, Bell, User } from "lucide-react";
import { useNotification } from "../context/NotificationContext";

export function Layout() {
  const location = useLocation();
  const { unreadCount, markAsRead } = useNotification();

  const menuItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/rooms", label: "Rooms", icon: DoorOpen },
    { path: "/automation", label: "Automation", icon: Workflow },
    { path: "/history", label: "History", icon: Clock },
    { path: "/settings", label: "Settings", icon: Settings },
    { path: "/support", label: "Support", icon: HelpCircle },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">SmartHome</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? "bg-gray-800 border-l-4 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
          {/* User Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={markAsRead}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center">
                <User size={18} className="text-white" />
              </div>
              <span className="font-medium">John Doe</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

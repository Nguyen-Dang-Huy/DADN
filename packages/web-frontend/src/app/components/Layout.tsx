import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Home, Zap, Workflow, Clock, Settings, HelpCircle, Bell, User, X, LogOut } from "lucide-react";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
// 1. Import Headless UI để làm Popover
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  // 2. Lấy thêm các hàm cần thiết từ NotificationContext
  const { notifications, unreadCount, markAsRead, clearNotifications, removeNotification } = useNotification();

  const menuItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/automation", label: "Automation", icon: Workflow },
    { path: "/history", label: "History", icon: Clock },
    //{ path: "/settings", label: "Settings", icon: Settings },
   // { path: "/support", label: "Support", icon: HelpCircle },
  ];

  // Hàm hỗ trợ định dạng thời gian ngắn gọn
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `Vừa xong`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    return `${hours} giờ trước`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Không thay đổi */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">SmartHome</h1>
        </div>
        <nav className="flex-1 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${isActive ? "bg-gray-800 border-l-4 border-blue-500" : "hover:bg-gray-800"
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
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end relative z-50">
          {/* User Actions */}
          <div className="flex items-center gap-4">

            {/* 3. THAY THẾ NÚT THÔNG BÁO BẰNG POPOVER */}
            <Popover className="relative">
              {({ open }) => (
                <>
                  {/* Nút bấm hình chuông đã được căn chỉnh icon và badge */}
                  <Popover.Button
                    className="relative p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    title="Notifications"
                  >
                    {/* Icon chuông với kích thước 24 (vừa vặn hơn 30) */}
                    <Bell
                      size={24}
                      className={`transition-colors ${open ? "text-blue-600" : "text-gray-600"}`}
                    />

                    {/* Vòng tròn đỏ thông báo: Đã fix vị trí để không che icon chuông */}
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Popover.Button>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                  >
                    {/* Bảng danh sách thông báo */}
                    <Popover.Panel className="absolute right-0 mt-3 w-80 max-w-sm transform px-4 sm:px-0 lg:max-w-3xl z-50">
                      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-white border border-gray-200">
                        {/* Header của Popover */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                          <h3 className="font-semibold text-gray-900">Thông báo gần đây</h3>
                          {notifications.length > 0 && (
                            <div className="flex gap-2">
                              <button
                                onClick={markAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Đánh dấu đã đọc
                              </button>
                              <button
                                onClick={clearNotifications}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Xóa hết
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Danh sách thông báo */}
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                              Không có thông báo mới.
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {/* Lấy 5 thông báo gần nhất, đảo ngược để cái mới nhất lên đầu */}
                              {notifications.slice(-5).reverse().map((notification) => (
                                <div key={notification.id} className="p-4 flex gap-3 hover:bg-gray-50 relative group">
                                  {/* Icon theo loại thông báo */}
                                  <div className={`mt-1 p-1.5 rounded-full h-fit ${notification.type === 'success' ? 'bg-green-100 text-green-600' :
                                      notification.type === 'error' ? 'bg-red-100 text-red-600' :
                                        notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                          'bg-blue-100 text-blue-600'
                                    }`}>
                                    <Zap size={14} />
                                  </div>

                                  {/* Nội dung thông báo */}
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-800">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(notification.timestamp)}</p>
                                  </div>

                                  {/* NÚT XÓA TỪNG THÔNG BÁO (Hiện khi hover) */}
                                  <button
                                    onClick={() => removeNotification(notification.id)}
                                    className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Xóa thông báo này"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>

            {/* User Profile Dropdown */}
            <Popover className="relative">
              {({ open }) => (
                <>
                  <Popover.Button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none">
                    <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center">
                      <User size={18} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{user || 'User'}</p>
                      <p className="text-xs text-gray-500">Admin</p>
                    </div>
                  </Popover.Button>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                  >
                    <Popover.Panel className="absolute right-0 mt-3 w-48 transform px-4 sm:px-0 z-50">
                      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-white">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                          <p className="text-sm font-semibold text-gray-900">{user || 'User'}</p>
                          <p className="text-xs text-gray-500">Administrator</p>
                        </div>
                        <div className="p-2">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <LogOut size={16} />
                            Đăng xuất
                          </button>
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
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
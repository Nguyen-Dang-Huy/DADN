import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from '../context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RouterProvider router={router} />
        <Toaster 
          position="top-right" 
          closeButton 
          // Thêm phần toastOptions dưới đây để tùy chỉnh nút X
          toastOptions={{
            closeButton: true,
            style: {
              paddingRight: '30px', // Tạo khoảng trống bên phải để không đè vào chữ
            },
            classNames: {
              // Tùy chỉnh class cho nút đóng của sonner
              closeButton: 'bg-white text-gray-900 border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-400 !opacity-100 !visible scale-125 transition-all shadow-sm',
            },
          }}
        />
      </NotificationProvider>
    </AuthProvider>
  );
}
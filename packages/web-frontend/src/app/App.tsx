import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { NotificationProvider } from './context/NotificationContext';

export default function App() {
  return (
    <NotificationProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </NotificationProvider>
  );
}
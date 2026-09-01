import { RouterProvider } from 'react-router-dom';
import router from './router';
import useAuthStore from './store/authStore';
import ToastHost from './components/ui/ToastHost';

function App() {
  useAuthStore.getState().hydrate();

  return (
    <>
      <ToastHost />
      <RouterProvider router={router} />
    </>
  );
}

export default App;

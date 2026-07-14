import { useAppStore } from '@/store';
import './Toast.css';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className={`toast-item toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close">×</button>
        </div>
      ))}
    </div>
  );
}

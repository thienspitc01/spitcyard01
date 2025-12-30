
import React, { useEffect, useState } from 'react';
import { stopAlarm } from '../services/audioService';
import { UserRole } from '../types';

interface NotificationOverlayProps {
    userRole: UserRole;
}

const NotificationOverlay: React.FC<NotificationOverlayProps> = ({ userRole }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }

    const handleNotify = (e: any) => {
      const { id, title: msgTitle, body: msgBody } = e.detail;
      setTitle(msgTitle);
      setMessage(msgBody);
      setActiveRequestId(id);
      setIsVisible(true);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(msgTitle, {
          body: msgBody,
          icon: "/vite.svg",
          tag: "port-urgent-alert-" + id,
          requireInteraction: true
        });
      }
    };

    // Lắng nghe tín hiệu tắt từ bên ngoài (đồng bộ hóa cloud)
    const handleClose = (e: any) => {
        const { id } = e.detail;
        if (id === activeRequestId) {
            setIsVisible(false);
            stopAlarm();
        }
    };

    window.addEventListener('port-notification', handleNotify);
    window.addEventListener('port-notification-close', handleClose);
    return () => {
        window.removeEventListener('port-notification', handleNotify);
        window.removeEventListener('port-notification-close', handleClose);
    };
  }, [activeRequestId]);

  const handleAcknowledge = () => {
    if (activeRequestId) {
        // Gửi tín hiệu lên Cloud để tắt cho mọi người khác cùng vai trò
        const type = (userRole === 'PLANNER' || userRole === 'ADMIN') ? 'YARD' : 'GATE';
        window.dispatchEvent(new CustomEvent('port-request-acknowledge-cloud', { 
            detail: { id: activeRequestId, type } 
        }));
    }
    setIsVisible(false);
    stopAlarm();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-red-600/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="text-center p-12 max-w-3xl w-full mx-4">
        <div className="mb-10 flex justify-center">
          <div className="bg-white p-10 rounded-full text-red-600 shadow-[0_0_50px_rgba(255,255,255,0.4)] animate-bounce">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-8 drop-shadow-2xl animate-pulse">
          {title}
        </h2>
        
        <div className="bg-white/10 p-10 rounded-[3rem] border-4 border-white/30 mb-14 shadow-inner">
            <p className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
              {message}
            </p>
        </div>

        <button
          onClick={handleAcknowledge}
          className="bg-white text-red-600 px-20 py-8 rounded-[2.5rem] font-black text-3xl hover:bg-slate-50 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.3)] active:scale-95 uppercase italic tracking-tighter"
        >
          XÁC NHẬN ĐÃ NHẬN TIN
        </button>
        
        <p className="mt-8 text-white/60 font-bold uppercase tracking-widest text-sm italic">
          Bấm để tắt báo động trên mọi thiết bị cùng phân hệ
        </p>
      </div>
    </div>
  );
};

export default NotificationOverlay;

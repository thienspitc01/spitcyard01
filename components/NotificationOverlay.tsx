
import React, { useEffect, useState, useRef } from 'react';
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
  
  const originalTitle = useRef(document.title);
  const flashInterval = useRef<number | null>(null);

  // Hàm điều khiển việc nháy tiêu đề Tab để gây chú ý trên Taskbar
  const startFlashing = (alertText: string) => {
    if (flashInterval.current) return;
    let isOriginal = false;
    flashInterval.current = window.setInterval(() => {
        document.title = isOriginal ? originalTitle.current : `⚠️ ${alertText} ⚠️`;
        isOriginal = !isOriginal;
    }, 800);
  };

  const stopFlashing = () => {
    if (flashInterval.current) {
        window.clearInterval(flashInterval.current);
        flashInterval.current = null;
    }
    document.title = originalTitle.current;
  };

  useEffect(() => {
    // Yêu cầu quyền thông báo hệ thống khi component mount
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

      // Kích hoạt nháy Taskbar
      startFlashing(msgTitle);

      // Gửi thông báo hệ thống (hiện ra ngoài trình duyệt)
      if ("Notification" in window && Notification.permission === "granted") {
        const sysNotify = new Notification(msgTitle, {
          body: msgBody,
          icon: "/vite.svg",
          tag: "port-urgent-alert-" + id,
          requireInteraction: true, // Quan trọng: Không tự tắt cho đến khi user bấm
          silent: false, // Để hệ thống có thể phát âm thanh riêng nếu có
        });

        sysNotify.onclick = () => {
            window.focus(); // Khi bấm vào thông báo, tự động nhảy về tab app
            sysNotify.close();
        };
      }
      
      // Rung máy (nếu là thiết bị di động/tablet)
      if ("vibrate" in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }
    };

    const handleClose = (e: any) => {
        const { id } = e.detail;
        if (id === activeRequestId) {
            setIsVisible(false);
            stopAlarm();
            stopFlashing();
        }
    };

    window.addEventListener('port-notification', handleNotify);
    window.addEventListener('port-notification-close', handleClose);
    
    return () => {
        window.removeEventListener('port-notification', handleNotify);
        window.removeEventListener('port-notification-close', handleClose);
        stopFlashing();
    };
  }, [activeRequestId]);

  const handleAcknowledge = () => {
    if (activeRequestId) {
        const type = (userRole === 'PLANNER' || userRole === 'ADMIN') ? 'YARD' : 'GATE';
        window.dispatchEvent(new CustomEvent('port-request-acknowledge-cloud', { 
            detail: { id: activeRequestId, type } 
        }));
    }
    setIsVisible(false);
    stopAlarm();
    stopFlashing();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-red-600/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="text-center p-12 max-w-3xl w-full mx-4">
        <div className="mb-10 flex justify-center">
          <div className="bg-white p-10 rounded-full text-red-600 shadow-[0_0_80px_rgba(255,255,255,0.6)] animate-bounce">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter mb-8 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] animate-pulse">
          {title}
        </h2>
        
        <div className="bg-white/10 p-10 rounded-[4rem] border-4 border-white/30 mb-14 shadow-inner backdrop-blur-sm">
            <p className="text-4xl font-black text-white uppercase tracking-tight leading-tight">
              {message}
            </p>
        </div>

        <button
          onClick={handleAcknowledge}
          className="bg-white text-red-600 px-24 py-10 rounded-[3rem] font-black text-4xl hover:bg-slate-50 transition-all shadow-[0_30px_90px_rgba(0,0,0,0.5)] active:scale-95 uppercase italic tracking-tighter hover:scale-105"
        >
          XÁC NHẬN NGAY
        </button>
        
        <div className="mt-12 space-y-2">
            <p className="text-white/80 font-black uppercase tracking-[0.2em] text-sm italic">
                CẢNH BÁO ĐANG PHÁT TRÊN TOÀN HỆ THỐNG
            </p>
            <div className="flex justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                <div className="w-2 h-2 rounded-full bg-white animate-ping [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-white animate-ping [animation-delay:0.4s]"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationOverlay;

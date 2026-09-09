import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string; // tailwind text color class e.g. 'text-neon-cyan'
  children: React.ReactNode;
  size?: 'lg' | 'xl' | 'full';
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  accentColor = 'text-neon-cyan',
  children,
  size = 'xl',
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass =
    size === 'full' ? 'w-[96vw] h-[92vh]' :
    size === 'xl'   ? 'w-auto max-w-5xl max-h-[85vh]' :
                      'w-auto max-w-3xl max-h-[80vh]';

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      {/* Panel — theme-aware container matching application design */}
      <div
        className={`${sizeClass} bg-obsidian-50 border border-border-grid rounded-2xl flex flex-col overflow-hidden shadow-2xl`}
        style={{
          animation: 'modal-in 0.22s cubic-bezier(0.22,1,0.36,1) forwards',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25), 0 0 30px rgba(0, 245, 255, 0.05)',
        }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-border-grid shrink-0 bg-obsidian-100/50">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />

          <div className="flex items-center gap-3">
            {icon && (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                accentColor === 'text-neon-cyan'   ? 'bg-cyan-500/15' :
                accentColor === 'text-purple-400'  ? 'bg-purple-500/15' :
                accentColor === 'text-neon-amber'  ? 'bg-amber-500/15' :
                accentColor === 'text-blue-400'    ? 'bg-blue-500/15' :
                'bg-emerald-500/15'
              }`}>
                <span className={accentColor}>{icon}</span>
              </div>
            )}
            <div>
              <h2 className={`text-base font-bold leading-tight ${accentColor}`}>{title}</h2>
              {subtitle && <p className="text-[11px] text-text-muted font-mono mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-obsidian border border-border-grid flex items-center justify-center text-text-muted hover:text-text-primary hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.93) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

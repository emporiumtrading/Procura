import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`relative w-full ${maxWidth} bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-neutral-800">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
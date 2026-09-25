import React, { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md", // sm, md, lg, xl, full
  withCloseButton = true,
  footer,
  gradientHeader = true,
  closeOnClickOutside = true,
  showCloseIcon = true,
  variant = "default", // default, info, warning, success, danger, purple
  loading = false,
  bodyClass = "",
  headerClass = "",
  footerClass = "",
  customIcon,
  hideBackdrop = false,
}: any) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        closeOnClickOutside &&
        modalRef.current && 
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeOnClickOutside]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    full: "max-w-full mx-4",
  };

  const getHeaderVariant = () => {
    if (variant === "purple") return "from-purple-600 to-indigo-700 text-white";
    if (variant === "danger") return "from-red-600 to-rose-700 text-white";
    if (variant === "warning") return "from-amber-500 to-orange-600 text-white";
    if (variant === "success") return "from-emerald-600 to-teal-700 text-white";
    return "from-blue-600 to-blue-700 text-white";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {!hideBackdrop && (
        <div 
          className={`fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-200 ${
            isClosing ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      <div
        ref={modalRef}
        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full ${
          sizeClasses[size] || "max-w-md"
        } transform transition-all duration-200 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between rounded-t-xl ${
            gradientHeader
              ? `bg-gradient-to-r ${getHeaderVariant()}`
              : "bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700"
          } ${headerClass}`}
        >
          <div className="flex items-center gap-3">
            {customIcon && <div>{customIcon}</div>}
            <h3 className="text-base font-semibold text-white tracking-wide truncate">
              {title}
            </h3>
          </div>
          {showCloseIcon && (
            <button
              onClick={handleClose}
              className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className={`p-5 max-h-[75vh] overflow-y-auto ${bodyClass}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={`px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 rounded-b-xl ${footerClass}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

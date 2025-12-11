import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  active = false,
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500",
    secondary: "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white",
    icon: "p-2 bg-transparent text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const activeStyles = active ? "bg-gray-800 text-white shadow-inner ring-1 ring-gray-600" : "";

  // Override size for icon variant
  const appliedSize = variant === 'icon' ? '' : sizes[size];

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${appliedSize} ${activeStyles} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};
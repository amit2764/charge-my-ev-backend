import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', disabled, className = '', ...props }) => {
  const baseStyle = "w-full py-3 px-4 rounded-lg font-semibold text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black";
  const variants = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400 focus:ring-cyan-500",
    secondary: "bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-500",
    outline: "border-2 border-gray-700 text-gray-300 hover:bg-gray-800 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-500 focus:ring-red-500"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ label, ...props }) => (
  <div className="mb-4 w-full">
    {label && <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>}
    <input
      className="w-full p-3 bg-gray-900 border-2 border-gray-800 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
      {...props} 
    />
  </div>
);

export const Select = ({ label, value, onChange, options = [], className = '' }) => (
  <div className={`mb-4 w-full ${className}`}>
    {label && <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full p-3 bg-gray-900 border-2 border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all appearance-none"
    >
      {options.map(opt => (
        typeof opt === 'string'
          ? <option key={opt} value={opt}>{opt}</option>
          : <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const Card = ({ children, className = '' }) => (
  <div className={`bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800 ${className}`}>
    {children}
  </div>
);
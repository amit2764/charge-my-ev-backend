import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', disabled, className = '', ...props }) => {
  const baseStyle = "group relative min-h-[46px] w-full overflow-hidden rounded-[20px] px-4 py-3.5 text-center text-sm font-semibold tracking-[0.01em] text-white shadow-[0_12px_30px_rgba(2,6,23,0.28)] transition-all duration-200 ease-out before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_58%)] before:opacity-60 before:content-[''] active:scale-[0.97] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-0";
  const variants = {
    primary: "border border-blue-400/30 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-slate-950 shadow-[0_18px_40px_rgba(59,130,246,0.28)] hover:shadow-[0_22px_46px_rgba(59,130,246,0.34)] focus:ring-blue-400",
    secondary: "border border-slate-700/70 bg-[linear-gradient(180deg,rgba(30,41,59,0.95),rgba(15,23,42,0.9))] hover:border-slate-500 hover:bg-slate-800/90 focus:ring-slate-500",
    outline: "border border-slate-600/70 bg-white/5 text-slate-100 backdrop-blur-xl hover:border-blue-400/40 hover:bg-blue-500/10 focus:ring-blue-400",
    danger: "border border-red-500/40 bg-gradient-to-r from-red-600 via-red-500 to-rose-400 shadow-[0_18px_40px_rgba(239,68,68,0.28)] hover:shadow-[0_22px_46px_rgba(239,68,68,0.34)] focus:ring-red-400"
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

export const Input = ({ label, className = '', ...props }) => (
  <div className="mb-4 w-full">
    {label && <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</label>}
    <input
      className={`w-full min-w-0 rounded-[20px] border border-slate-700/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] px-4 py-3.5 text-sm text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-all duration-200 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 ${className}`}
      {...props} 
    />
  </div>
);

export const Select = ({ label, value, onChange, options = [], className = '' }) => (
  <div className={`mb-4 w-full ${className}`}>
    {label && <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none rounded-[20px] border border-slate-700/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] px-4 py-3.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-all duration-200 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20"
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
  <div className={`glass-surface surface-grid rounded-[24px] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.3)] sm:p-6 ${className}`}>
    {children}
  </div>
);
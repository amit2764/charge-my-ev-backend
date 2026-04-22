import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', disabled, className = '', ...props }) => {
  const baseStyle = "group relative min-h-[46px] w-full overflow-hidden rounded-[20px] px-4 py-3.5 text-center text-sm font-semibold tracking-[0.01em] text-slate-900 shadow-[0_12px_30px_rgba(13,148,136,0.12)] transition-all duration-200 ease-out before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_58%)] before:opacity-60 before:content-[''] active:scale-[0.97] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-0";
  const variants = {
    primary: "border border-teal-400/40 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-300 text-slate-950 shadow-[0_18px_40px_rgba(20,184,166,0.18)] hover:shadow-[0_22px_46px_rgba(20,184,166,0.24)] focus:ring-teal-400",
    secondary: "border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.92))] text-slate-700 hover:border-teal-200 hover:bg-teal-50/70 focus:ring-teal-300",
    outline: "border border-slate-200 bg-white/90 text-slate-700 backdrop-blur-xl hover:border-teal-300 hover:bg-teal-50/70 focus:ring-teal-300",
    danger: "border border-rose-300/70 bg-gradient-to-r from-rose-500 via-red-500 to-orange-300 text-white shadow-[0_18px_40px_rgba(239,68,68,0.18)] hover:shadow-[0_22px_46px_rgba(239,68,68,0.24)] focus:ring-red-300"
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
    {label && <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>}
    <input
      className={`w-full min-w-0 rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,252,250,0.92))] px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all duration-200 focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 ${className}`}
      {...props} 
    />
  </div>
);

export const Select = ({ label, value, onChange, options = [], className = '' }) => (
  <div className={`mb-4 w-full ${className}`}>
    {label && <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,252,250,0.92))] px-4 py-3.5 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all duration-200 focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
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
  <div className={`glass-surface surface-grid rounded-[24px] p-4 shadow-[0_18px_45px_rgba(13,148,136,0.1)] sm:p-6 ${className}`}>
    {children}
  </div>
);
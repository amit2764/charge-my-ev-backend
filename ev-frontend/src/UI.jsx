import React from 'react';

export const Badge = ({ status }) => {
  const styles = {
    ACTIVE: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
    DISPUTED: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`px-2 py-1 text-xs font-bold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

export const Button = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50'
  };
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm' };
  
  return (
    <button className={`font-medium rounded transition-colors ${variants[variant]} ${sizes[size]}`} {...props}>
      {children}
    </button>
  );
};

export const Table = ({ headers, children }) => (
  <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
    <table className="w-full text-left text-sm whitespace-nowrap">
      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
        <tr>
          {headers.map((h, i) => <th key={i} className="px-4 py-3">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-gray-700">
        {children}
      </tbody>
    </table>
  </div>
);

export const Card = ({ title, value, subtitle }) => (
  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col">
    <span className="text-gray-500 text-sm font-medium">{title}</span>
    <span className="text-3xl font-bold text-gray-900 my-2">{value}</span>
    {subtitle && <span className="text-xs text-green-600 font-medium">{subtitle}</span>}
  </div>
);
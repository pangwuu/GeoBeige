import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Utility for merging tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Base Card Component
 */
export const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={cn(
    "bg-background border border-surface-border rounded-xl shadow-lg overflow-hidden",
    className
  )}>
    {children}
  </div>
);

/**
 * GlassCard Component for that premium feel
 */
export const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={cn(
    "bg-surface border border-surface-border backdrop-blur-md rounded-xl shadow-2xl overflow-hidden",
    className
  )}>
    {children}
  </div>
);

/**
 * Button Component with brand variants
 */
export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  isLoading, 
  className,
  ...props 
}: Omit<HTMLMotionProps<"button">, 'children'> & { 
  children?: React.ReactNode,
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost',
  size?: 'sm' | 'md' | 'lg',
  isLoading?: boolean 
}) => {
  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white shadow-md shadow-emerald-900/20',
    secondary: 'bg-surface hover:bg-surface-hover text-foreground border border-surface-border',
    outline: 'border border-surface-border hover:bg-surface text-muted hover:text-foreground',
    ghost: 'hover:bg-surface-hover text-muted hover:text-foreground'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      disabled={isLoading || props.disabled}
      className={cn(
        'rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </motion.button>
  );
};

/**
 * Input Component
 */
export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props}
    className={cn(
      "w-full px-4 py-2.5 bg-background border border-surface-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted/60",
      className
    )}
  />
);

/**
 * Badge Component
 */
export const Badge = ({ children, status = 'default', className = "" }: { children: React.ReactNode, status?: 'default' | 'success' | 'processing' | 'accent' | 'warning', className?: string }) => {
  const styles = {
    default: 'bg-surface text-muted border-surface-border',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse-slow',
    accent: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    warning: 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  return (
    <span className={cn(
      "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      styles[status],
      className
    )}>
      {children}
    </span>
  );
};

/**
 * Command Centre (Floating Input Wrapper)
 */
export const CommandCentre = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={cn(
    "fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-4",
    className
  )}>
    <GlassCard className="p-1.5 flex items-center gap-2">
      {children}
    </GlassCard>
  </div>
);

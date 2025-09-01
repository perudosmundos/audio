import * as React from "react"

const Switch = React.forwardRef(({ 
  className = '', 
  checked = false, 
  onCheckedChange, 
  disabled = false,
  ...props 
}, ref) => {
  const baseClasses = 'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
  
  const checkedClasses = checked 
    ? 'bg-primary' 
    : 'bg-input';
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const classes = `${baseClasses} ${checkedClasses} ${disabledClasses} ${className}`;

  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={classes}
      onClick={handleClick}
      {...props}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
});

Switch.displayName = 'Switch';

export { Switch };

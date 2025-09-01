import React from 'react';

const Separator = React.forwardRef(({ 
  className = '', 
  orientation = 'horizontal', 
  decorative = true,
  ...props 
}, ref) => {
  const baseClasses = 'shrink-0 bg-border';
  
  const orientationClasses = orientation === 'horizontal' 
    ? 'h-[1px] w-full' 
    : 'h-full w-[1px]';

  const classes = `${baseClasses} ${orientationClasses} ${className}`;

  if (decorative) {
    return <div ref={ref} role="none" className={classes} {...props} />;
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={classes}
      {...props}
    />
  );
});

Separator.displayName = 'Separator';

export { Separator };


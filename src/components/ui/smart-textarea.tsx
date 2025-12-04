import * as React from "react";
import { cn } from "@/lib/utils";
import { LinkifiedText, containsUrl } from "./linkified-text";

export interface SmartTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showLinksWhenBlurred?: boolean;
}

const SmartTextarea = React.forwardRef<HTMLTextAreaElement, SmartTextareaProps>(
  ({ className, showLinksWhenBlurred = true, value, defaultValue, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const textValue = String(value ?? defaultValue ?? '');
    const hasUrls = containsUrl(textValue);
    
    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current!);
    
    // Show linkified view when not focused and has URLs
    const showLinkifiedView = showLinksWhenBlurred && !isFocused && hasUrls && textValue.length > 0;

    const handleOverlayClick = (e: React.MouseEvent) => {
      // Check if the click was on a link - if so, don't activate edit mode
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' || target.closest('a')) {
        // Let the link handle its own click
        return;
      }
      // Otherwise, focus the textarea
      setIsFocused(true);
      textareaRef.current?.focus();
    };

    return (
      <div className="relative">
        {showLinkifiedView && (
          <div
            className={cn(
              "absolute inset-0 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm overflow-auto cursor-text z-10",
              className
            )}
            onClick={handleOverlayClick}
          >
            <LinkifiedText text={textValue} className="text-sm" />
          </div>
        )}
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            showLinkifiedView && "opacity-0 pointer-events-none",
            className
          )}
          ref={textareaRef}
          value={value}
          defaultValue={defaultValue}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </div>
    );
  }
);

SmartTextarea.displayName = "SmartTextarea";

export { SmartTextarea };

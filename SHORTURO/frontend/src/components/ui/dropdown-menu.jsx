import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils.js";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPortal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[13rem] overflow-hidden rounded-md border bg-white p-1 text-slate-900 shadow-xl outline-none ring-1 ring-black/5 backdrop-blur-none dark:bg-popover dark:text-popover-foreground dark:ring-white/10",
        className
      )}
      {...props}
    />
  </DropdownMenuPortal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuContentResponsive = React.forwardRef(({ className, sideOffset = 10, ...props }, ref) => {
  const isSmall = useMediaQuery("(max-width: 640px)");
  return (
    <DropdownMenuContent
      ref={ref}
      side="bottom"
      align="end"
      sideOffset={sideOffset}
      collisionPadding={12}
      sticky="always"
      className={cn(
        "w-56 max-w-[calc(100vw-24px)] overflow-x-hidden overflow-y-auto [max-height:min(60vh,22rem)]",
        isSmall ? "w-[calc(100vw-24px)]" : null,
        className
      )}
      {...props}
    />
  );
});
DropdownMenuContentResponsive.displayName = "DropdownMenuContentResponsive";

const DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset ? "pl-8" : null,
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuContentResponsive,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup
};

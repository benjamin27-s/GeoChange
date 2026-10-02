import { motion } from "framer-motion";

export default function GlassPanel({
  children,
  className = "",
  as: Component = motion.div,
  ...props
}) {
  return (
    <Component
      className={`glass-panel ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      {...props}
    >
      {children}
    </Component>
  );
}

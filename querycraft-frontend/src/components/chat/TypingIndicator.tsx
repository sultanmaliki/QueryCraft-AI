'use client';

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full flex gap-4"
    >
      <Avatar className="flex-shrink-0">
        <AvatarFallback>
          <Bot />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex items-center space-x-1 p-3">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: "#94a3b8" }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: "#94a3b8" }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
        />
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: "#94a3b8" }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

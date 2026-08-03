"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type MotionShellProps = HTMLMotionProps<"div"> & {
    delay?: number;
};

export function MotionShell({ delay = 0, ...props }: MotionShellProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay }}
            {...props}
        />
    );
}

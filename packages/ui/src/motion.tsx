"use client"

import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@realestategear/tokens"

export type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number
  duration?: number
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.35,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export type StaggerContainerProps = HTMLMotionProps<"div"> & {
  staggerDelay?: number
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.06,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export type StaggerItemProps = HTMLMotionProps<"div">

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.21, 0.47, 0.32, 0.98],
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export type MotionCardProps = HTMLMotionProps<"div">

export function MotionCard({ children, className, ...props }: MotionCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "rounded-xl border border-border/80 bg-card shadow-xs transition-shadow duration-300 hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

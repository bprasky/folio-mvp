"use client";
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";
import { motion } from "framer-motion";
import { useDemoDerived } from "@/lib/demo/demoDerived";
import { springSoft } from "@/lib/demo/anim";

type Point = { date: string; saves: number; tags: number; savesCum?: number };

export function SavesOverTimeDemo({ data }: { data: Point[] }) {
  const { liftScalar, demoMode } = useDemoDerived();

  const d = useMemo(() => {
    if (!demoMode) return data;
    return data.map(p => ({
      ...p,
      saves: Math.round(p.saves * liftScalar),
      tags: Math.round(p.tags * (0.6 + 0.4 * liftScalar)) // tags move, but a bit less
    }));
  }, [data, demoMode, liftScalar]);

  return (
    <motion.div layout transition={springSoft as any}>
      <LineChart width={800} height={260} data={d}>
        <CartesianGrid stroke="#E5E7EB" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v, k) => [v, k === 'saves' ? 'Saves/day' : 'Tags/day']} />
        <Line type="monotone" dataKey="saves" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive />
        <Line type="monotone" dataKey="tags" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive />
        <Area dataKey="savesCum" stroke="none" fill="#3B82F6" fillOpacity={0.08} />
      </LineChart>
    </motion.div>
  );
}

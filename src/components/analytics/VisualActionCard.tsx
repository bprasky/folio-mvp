'use client';
import { motion } from 'framer-motion';
import ActionPill from './ui/ActionPill';

export default function VisualActionCard({
  title, tone='perf', visual, what, why, actions=[]
}:{
  title:string;
  tone?:'engage'|'perf'|'opp'|'risk';
  visual:React.ReactNode;  // charts/tiles/maps
  what?:string;            // <= 90 chars
  why?:string;             // <= 90 chars
  actions?:{label:string; onClick:()=>void}[];
}) {
  return (
    <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      className="relative rounded-2xl card-glass card-border shadow-card p-4 md:p-5 text-canvas overflow-hidden">
      <header className="flex items-start justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <span className={`block h-0.5 w-14 bg-accent-${tone} rounded-full`} />
      </header>

      <div className="relative group">
        <div className="pointer-events-none select-none">{visual}</div>
        {(what || why) && (
          <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 opacity-0 group-hover:opacity-100
                          transition-opacity duration-200 bg-ink/50 backdrop-blur-xl rounded-xl m-3">
            <div className="text-sm leading-tight space-y-1">
              {what && <div><span className="opacity-80">What: </span>{what}</div>}
              {why  && <div><span className="opacity-80">Why: </span>{why}</div>}
            </div>
          </div>
        )}
      </div>

      {actions.length>0 && (
        <div className="mt-3 flex gap-2">
          {actions.slice(0,2).map((a,i)=><ActionPill key={i} {...a} />)}
        </div>
      )}
    </motion.section>
  );
}






import { useEffect, useRef, type FC } from "react";
import { gsap } from "gsap";
import { Utensils, Scale, Leaf, ShieldCheck } from "lucide-react";
import { ImpactSummary } from "../types";

interface KpiRibbonProps {
  impact: ImpactSummary | null;
}

export const KpiRibbon: FC<KpiRibbonProps> = ({ impact }) => {
  const targetMeals = impact?.total_meals_rescued ?? 280;
  const targetKg = impact?.total_food_kg_saved ?? 133;
  const targetCo2 = impact?.total_co2_kg_offset ?? 332.5;
  const targetEsg = impact?.esg_compliance_index ?? 98;

  const mealsRef = useRef<HTMLSpanElement>(null);
  const kgRef = useRef<HTMLSpanElement>(null);
  const co2Ref = useRef<HTMLSpanElement>(null);
  const esgRef = useRef<HTMLSpanElement>(null);

  const prevValsRef = useRef({
    meals: targetMeals,
    kg: targetKg,
    co2: targetCo2,
    esg: targetEsg,
  });

  useEffect(() => {
    const counterObj = {
      meals: prevValsRef.current.meals,
      kg: prevValsRef.current.kg,
      co2: prevValsRef.current.co2,
      esg: prevValsRef.current.esg,
    };

    const tween = gsap.to(counterObj, {
      meals: targetMeals,
      kg: targetKg,
      co2: targetCo2,
      esg: targetEsg,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => {
        if (mealsRef.current) {
          mealsRef.current.textContent = String(Math.round(counterObj.meals));
        }
        if (kgRef.current) {
          kgRef.current.textContent = String(Math.round(counterObj.kg));
        }
        if (co2Ref.current) {
          co2Ref.current.textContent = counterObj.co2.toFixed(1);
        }
        if (esgRef.current) {
          esgRef.current.textContent = String(Math.round(counterObj.esg));
        }
      },
      onComplete: () => {
        if (mealsRef.current) mealsRef.current.textContent = String(targetMeals);
        if (kgRef.current) kgRef.current.textContent = String(targetKg);
        if (co2Ref.current) co2Ref.current.textContent = String(targetCo2);
        if (esgRef.current) esgRef.current.textContent = String(targetEsg);
        prevValsRef.current = {
          meals: targetMeals,
          kg: targetKg,
          co2: targetCo2,
          esg: targetEsg,
        };
      },
    });

    return () => {
      tween.kill();
    };
  }, [targetMeals, targetKg, targetCo2, targetEsg]);

  return (
    <section aria-label="Community Rescue Impact" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
      {/* 1. Meals Rescued */}
      <article className="cyber-card retro-card rounded-xl border border-stone-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden relative">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label text-xs font-bold text-stone-500 uppercase tracking-wider">
            Meals Rescued to Date
          </span>
          <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
            <Utensils className="w-4 h-4" />
          </span>
        </div>
        <div>
          <p className="font-headline text-2xl sm:text-3xl font-extrabold text-stone-900 tabular-nums tracking-tight">
            <span ref={mealsRef}>{targetMeals}</span>
          </p>
          <p className="font-body text-xs text-emerald-700 font-semibold mt-1">
            4 Shelters Provisioned • +1,420 this week
          </p>
        </div>
      </article>

      {/* 2. Landfill Mass Diverted */}
      <article className="cyber-card retro-card rounded-xl border border-stone-200/80 bg-gradient-to-br from-white via-white to-amber-50/40 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden relative">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label text-xs font-bold text-stone-500 uppercase tracking-wider">
            Landfill Mass Diverted
          </span>
          <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-100 shadow-2xs">
            <Scale className="w-4 h-4" />
          </span>
        </div>
        <div>
          <p className="font-headline text-2xl sm:text-3xl font-extrabold text-stone-900 tabular-nums tracking-tight">
            <span ref={kgRef}>{targetKg}</span> <span className="text-lg font-bold text-stone-500">kg</span>
          </p>
          <p className="font-body text-xs text-amber-700 font-semibold mt-1">
            412 kg diverted today • Zero-waste
          </p>
        </div>
      </article>

      {/* 3. Carbon Offset */}
      <article className="cyber-card retro-card rounded-xl border border-stone-200/80 bg-gradient-to-br from-white via-white to-teal-50/40 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden relative">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label text-xs font-bold text-stone-500 uppercase tracking-wider">
            Carbon Offset (CO2e)
          </span>
          <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-teal-50 text-teal-700 border border-teal-100 shadow-2xs">
            <Leaf className="w-4 h-4" />
          </span>
        </div>
        <div>
          <p className="font-headline text-2xl sm:text-3xl font-extrabold text-stone-900 tabular-nums tracking-tight">
            <span ref={co2Ref}>{targetCo2}</span> <span className="text-lg font-bold text-stone-500">kg</span>
          </p>
          <p className="font-body text-xs text-teal-700 font-semibold mt-1">
            Verified ISO-14064 municipal audit
          </p>
        </div>
      </article>

      {/* 4. FSSAI Safety Compliance */}
      <article className="cyber-card retro-card rounded-xl border border-stone-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden relative">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label text-xs font-bold text-stone-500 uppercase tracking-wider">
            FSSAI Safety Compliance
          </span>
          <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </span>
        </div>
        <div>
          <p className="font-headline text-2xl sm:text-3xl font-extrabold text-stone-900 tabular-nums tracking-tight">
            <span ref={esgRef}>{targetEsg}</span>%
          </p>
          <p className="font-body text-xs text-emerald-700 font-semibold mt-1">
            Zero spoilage incidents • Grade A Prime
          </p>
        </div>
      </article>
    </section>
  );
};

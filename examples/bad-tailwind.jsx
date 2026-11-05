import React from 'react';

export function TailwindCard() {
  return (
    // Violations: arbitrary Tailwind spacing and arbitrary colors
    <div className="flex flex-col p-[13px] bg-[#ff5733] rounded-lg">
      <h2 className="text-[23px] font-bold text-[#333333] mb-[7px]">
        Tailwind Violations
      </h2>
      <p className="text-sm gap-[11px] hover:bg-[#123456]">
        Arbitrary values break team design systems.
      </p>

      {/* ucli-disable-next-line TAILWIND-001 */}
      <div className="mt-[17px] p-[16px] bg-slate-100">
        This line has an intentional 17px margin suppressed via comment directive!
      </div>
    </div>
  );
}

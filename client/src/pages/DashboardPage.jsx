import React from 'react';
import AppShell from '../components/layout/AppShell';

const DashboardPage = () => {
  return (
    <AppShell>
      <div className="grid grid-cols-12 gap-lg">
        {/* Header Section */}
        <div className="col-span-12 mb-sm flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">System Overview</h2>
            <p className="font-code-md text-code-md text-on-surface-variant">NODE: PRIMARY // STATUS: NOMINAL // TIME: 08:42:11 UTC</p>
          </div>
          <div className="flex gap-md">
            <button className="bg-primary text-on-primary font-label-caps text-label-caps px-md py-sm rounded hover:bg-primary/90 transition-colors uppercase font-bold tracking-wider shadow-glow-primary">
              Start New Case
            </button>
            <button className="bg-surface-container border border-outline-variant text-on-surface font-label-caps text-label-caps px-md py-sm rounded hover:border-primary transition-colors uppercase">
              Upload Evidence
            </button>
          </div>
        </div>

        {/* Stat Cards (Bento Style) */}
        <div className="col-span-12 grid grid-cols-4 gap-md mb-md">
          {/* Active Cases */}
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Active Cases</span>
              <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">14</div>
              <div className="font-code-md text-code-md text-primary mt-1">+2 since last cycle</div>
            </div>
          </div>

          {/* Total Evidence Items */}
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-tertiary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Evidence Items</span>
              <span className="material-symbols-outlined text-tertiary text-[20px]">data_object</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">8,241</div>
              <div className="font-code-md text-code-md text-tertiary mt-1">452GB indexed</div>
            </div>
          </div>

          {/* Sanitized Disks */}
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Sanitized Disks</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">hard_drive</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">102</div>
              <div className="font-code-md text-code-md text-on-surface-variant mt-1">Last: 2 hrs ago</div>
            </div>
          </div>

          {/* Pending Jobs */}
          <div className="bg-[#1C1C1E] border border-primary/30 p-md rounded flex flex-col relative overflow-hidden shadow-glow-active">
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary anim-pulse inline-block"></span>
                Pending Jobs
              </span>
              <span className="material-symbols-outlined text-primary text-[20px]">pending_actions</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-primary">3</div>
              <div className="font-code-md text-code-md text-on-surface-variant mt-1">Processing queue...</div>
            </div>
          </div>
        </div>

        {/* Left Column: Active Jobs Monitor (8 cols) */}
        <div className="col-span-8 flex flex-col gap-md">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded flex flex-col h-full">
            <div className="p-sm px-md border-b border-[#2C2C2E] flex justify-between items-center bg-[#131315]">
              <h3 className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider">Active Process Monitor</h3>
              <button className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              </button>
            </div>
            <div className="p-md flex-1">
              {/* Job 1 */}
              <div className="mb-lg last:mb-0">
                <div className="flex justify-between items-end mb-xs">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-[16px]">data_exploration</span>
                    <span className="font-code-md text-code-md text-on-surface">Deep Scan // Vol: SYS_C_4402</span>
                  </div>
                  <span className="font-code-md text-code-md text-primary">68%</span>
                </div>
                <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden border border-[#2C2C2E]">
                  <div className="h-full bg-primary relative w-[68%]">
                    <div className="absolute inset-0 bg-white/20 anim-pulse"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">EST: 12m 45s</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant">Sectors: 1.4M / 2.1M</span>
                </div>
              </div>

              {/* Job 2 */}
              <div className="mb-lg last:mb-0">
                <div className="flex justify-between items-end mb-xs">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-error text-[16px]">security</span>
                    <span className="font-code-md text-code-md text-on-surface">DoD 5220.22-M Wipe // EXT_DRIVE_02</span>
                  </div>
                  <span className="font-code-md text-code-md text-error">Pass 2/3 (42%)</span>
                </div>
                {/* Segmented Progress */}
                <div className="w-full flex gap-1 h-1">
                  <div className="h-full bg-error flex-1 rounded-l-full"></div>
                  <div className="h-full bg-surface-container-high relative flex-1 border-y border-[#2C2C2E]">
                    <div className="h-full bg-error w-[42%] relative">
                      <div className="absolute inset-0 bg-white/20 anim-pulse"></div>
                    </div>
                  </div>
                  <div className="h-full bg-surface-container-high flex-1 rounded-r-full border border-[#2C2C2E]"></div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">EST: 4h 12m</span>
                  <span className="font-label-caps text-label-caps text-error">CRITICAL PROCESS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Feed (4 cols) */}
        <div className="col-span-4 flex flex-col gap-md">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded flex flex-col h-[400px]">
            <div className="p-sm px-md border-b border-[#2C2C2E] flex justify-between items-center bg-[#131315]">
              <h3 className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider">System Event Log</h3>
              <span className="material-symbols-outlined text-outline-variant text-[16px]">list_alt</span>
            </div>
            <div className="p-md flex-1 overflow-y-auto space-y-sm font-code-md text-code-md">
              <div className="flex gap-sm items-start border-l-2 border-primary pl-2 opacity-100">
                <span className="text-outline-variant shrink-0 w-16">08:41:02</span>
                <span className="text-on-surface">Evidence extraction completed for image [IMG_4402_A.dd]. SHA-256 hash verified.</span>
              </div>
              <div className="flex gap-sm items-start border-l-2 border-surface-container-high pl-2 opacity-70">
                <span className="text-outline-variant shrink-0 w-16">08:35:14</span>
                <span className="text-secondary">User [J.Doe] authenticated successfully via hardware token.</span>
              </div>
              <div className="flex gap-sm items-start border-l-2 border-surface-container-high pl-2 opacity-70">
                <span className="text-outline-variant shrink-0 w-16">08:12:55</span>
                <span className="text-on-surface">Audit log generated for Case #4401. Exported to /secure/reports.</span>
              </div>
              <div className="flex gap-sm items-start border-l-2 border-surface-container-high pl-2 opacity-70">
                <span className="text-outline-variant shrink-0 w-16">07:50:00</span>
                <span className="text-error">Warning: Unrecognized USB mass storage device connected to terminal #04.</span>
              </div>
              <div className="flex gap-sm items-start border-l-2 border-surface-container-high pl-2 opacity-50">
                <span className="text-outline-variant shrink-0 w-16">07:45:22</span>
                <span className="text-on-surface">System diagnostic check completed. All nodes operating optimally.</span>
              </div>
              <div className="flex gap-sm items-start border-l-2 border-surface-container-high pl-2 opacity-40">
                <span className="text-outline-variant shrink-0 w-16">07:30:00</span>
                <span className="text-on-surface">Automated backup sequence initiated.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;
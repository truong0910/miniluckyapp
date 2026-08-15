import SlotMachine from "@/components/slot-machine";
import Background from "@/components/background";
import Header from "@/components/header";
import { LineSVG } from "@/components/vectors";
import { readProgramRules } from "@/services/campaign.types";
import { Page } from "zmp-ui";

export default function WheelPage() {
  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-slate-950 min-h-screen pb-20"
    >
      <Background />
      <Header />
      <div className="relative max-w-md mx-auto px-4 z-10 space-y-6">
        <TitleSection />
        <WheelSection />
        <RuleNoteSection />
      </div>
    </Page>
  );
}

function TitleSection() {
  return (
    <div className="flex flex-col items-center text-center mt-4">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-extrabold uppercase tracking-widest mb-1 shadow-inner">
        ✨ CHƯƠNG TRÌNH ĐẶC BIỆT
      </div>
      <h1 className="font-black text-center text-3xl sm:text-4xl text-gold-gradient drop-shadow-md">
        VÒNG QUAY MAY MẮN
      </h1>
      <p className="text-xs text-amber-200/80 font-medium">
        Quay ngay để nhận hàng ngàn Voucher giá trị từ BigG!
      </p>
    </div>
  );
}

function RuleNoteSection() {
  const rules = readProgramRules();

  return (
    <div className="glass-card-dark p-5 rounded-3xl border border-amber-500/30 shadow-2xl space-y-3">
      <div className="flex justify-between items-center px-4">
        <LineSVG height={2} />
        <div className="text-base font-black text-gold-gradient uppercase tracking-wider">
          Thể lệ tham gia
        </div>
        <LineSVG height={2} reverseX />
      </div>

      <div className="text-amber-100/90 text-xs space-y-3 leading-relaxed">
        {rules.intro && (
          <p className="bg-amber-950/40 p-3 rounded-2xl border border-amber-500/20 text-amber-200 font-medium leading-relaxed">
            {rules.intro}
          </p>
        )}

        {rules.eligibility?.length > 0 && (
          <div>
            <p className="font-bold text-amber-300">1. Điều kiện tham gia</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-300">
              {rules.eligibility.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rules.rewards?.length > 0 && (
          <div>
            <p className="font-bold text-amber-300">2. Cơ cấu giải thưởng</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-300">
              {rules.rewards.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {rules.usageNotes?.length > 0 && (
          <div>
            <p className="font-bold text-amber-300">3. Quy định sử dụng Voucher</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-300">
              {rules.usageNotes.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function WheelSection() {
  return (
    <div className="flex flex-col items-center relative">
      <SlotMachine />
    </div>
  );
}
